-- RoleVRGO — painel de admin. Rode no SQL Editor do Supabase.
-- ANTES DE RODAR: troque TROQUE_PELA_SENHA (no fim do arquivo) pela senha de admin.
-- A senha fica só como hash bcrypt; o aparelho que fizer login vira admin permanente.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.rv_admin_cfg (k text primary key, v text not null);
create table if not exists public.rv_admins (player_id uuid primary key references public.rv_players(id) on delete cascade, created_at timestamptz not null default now());
create table if not exists public.rv_admin_tries (player_id uuid not null, at timestamptz not null default now());
create index if not exists rv_admin_tries_idx on public.rv_admin_tries(player_id, at);
create table if not exists public.rv_admin_events (
  id bigserial primary key,
  kind text not null,
  target text not null default 'all',
  data jsonb not null default '{}'::jsonb,
  author text not null default 'admin',
  created_at timestamptz not null default now(),
  ends_at timestamptz not null default now()
);
create index if not exists rv_admin_events_ends_idx on public.rv_admin_events(ends_at desc);
alter table public.rv_admin_cfg enable row level security;
alter table public.rv_admins enable row level security;
alter table public.rv_admin_tries enable row level security;
alter table public.rv_admin_events enable row level security;
-- os eventos são públicos (todos os jogadores precisam recebê-los em tempo real); só o servidor escreve
drop policy if exists rv_admin_events_read on public.rv_admin_events;
create policy rv_admin_events_read on public.rv_admin_events for select to anon, authenticated using (true);
do $$ begin
  alter publication supabase_realtime add table public.rv_admin_events;
exception when duplicate_object then null; end $$;

create or replace function public.rv_is_admin(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$ select exists (select 1 from public.rv_admins where player_id = p_id) $$;
revoke all on function public.rv_is_admin(uuid) from public, anon, authenticated;

-- nome "hark" reservado para admins
create or replace function public.rv_safe_name(p_id uuid, p_name text) returns text
language sql stable security definer set search_path = '' as $$
  select case when lower(public.rv_clean_name(p_name)) like 'hark%' and not public.rv_is_admin(p_id) then 'Gato' else public.rv_clean_name(p_name) end
$$;
revoke all on function public.rv_safe_name(uuid, text) from public, anon, authenticated;

create or replace function public.rv_login(p_id uuid, p_secret text, p_name text, p_look jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.rv_players; v_code text;
begin
  if p_secret is null or length(p_secret) < 16 then raise exception 'rv_bad_secret'; end if;
  select * into r from public.rv_players where id = p_id;
  if not found then
    loop
      v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
      exit when not exists (select 1 from public.rv_players where friend_code = v_code);
    end loop;
    insert into public.rv_players(id, secret_hash, name, friend_code, look)
    values (p_id, encode(sha256(convert_to(p_secret, 'UTF8')), 'hex'), public.rv_safe_name(p_id, p_name), v_code,
            case when pg_column_size(coalesce(p_look,'{}'::jsonb)) < 2000 then coalesce(p_look,'{}'::jsonb) else '{}'::jsonb end)
    returning * into r;
  else
    perform public.rv_check(p_id, p_secret);
    update public.rv_players set last_seen = now() where id = p_id;
  end if;
  return jsonb_build_object('name', r.name, 'look', r.look, 'data', r.data, 'friend_code', r.friend_code, 'now', (extract(epoch from now()) * 1000)::bigint, 'admin', public.rv_is_admin(p_id));
end $$;

create or replace function public.rv_save(p_id uuid, p_secret text, p_name text, p_look jsonb, p_data jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.rv_check(p_id, p_secret);
  if pg_column_size(p_data) > 60000 or pg_column_size(p_look) > 2000 then raise exception 'rv_too_big'; end if;
  update public.rv_players set
    name = public.rv_safe_name(p_id, p_name), look = coalesce(p_look, look), data = coalesce(p_data, data),
    level = least(999, greatest(1, coalesce((p_data->>'level')::int, level))),
    wins = least(1000000, greatest(0, coalesce((p_data->'stats'->>'ko')::int, wins))),
    updated_at = now(), last_seen = now()
  where id = p_id;
end $$;

-- login de admin: no máximo 5 tentativas erradas a cada 15 minutos por aparelho
create or replace function public.rv_admin_login(p_id uuid, p_secret text, p_password text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_hash text;
begin
  perform public.rv_check(p_id, p_secret);
  if public.rv_is_admin(p_id) then return jsonb_build_object('ok', true); end if;
  delete from public.rv_admin_tries where at < now() - interval '1 day';
  if (select count(*) from public.rv_admin_tries where player_id = p_id and at > now() - interval '15 minutes') >= 5 then return jsonb_build_object('ok', false, 'wait', true); end if;
  select v into v_hash from public.rv_admin_cfg where k = 'pass';
  if v_hash is null or extensions.crypt(coalesce(p_password, ''), v_hash) <> v_hash then
    insert into public.rv_admin_tries(player_id) values (p_id); return jsonb_build_object('ok', false);
  end if;
  insert into public.rv_admins(player_id) values (p_id) on conflict do nothing;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.rv_admin_send(p_id uuid, p_secret text, p_kind text, p_target text, p_data jsonb, p_secs int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.rv_admin_events; v_name text;
begin
  perform public.rv_check(p_id, p_secret);
  if not public.rv_is_admin(p_id) then raise exception 'rv_not_admin'; end if;
  if pg_column_size(p_data) > 4000 or length(coalesce(p_kind, '')) > 24 or length(coalesce(p_target, '')) > 64 then raise exception 'rv_too_big'; end if;
  select name into v_name from public.rv_players where id = p_id;
  delete from public.rv_admin_events where ends_at < now() - interval '1 day';
  insert into public.rv_admin_events(kind, target, data, author, ends_at)
  values (p_kind, coalesce(p_target, 'all'), coalesce(p_data, '{}'::jsonb), coalesce(v_name, 'admin'), now() + make_interval(secs => least(3600, greatest(0, coalesce(p_secs, 0)))))
  returning * into r;
  return jsonb_build_object('id', r.id);
end $$;

-- eventos/efeitos globais ainda ativos (para quem entra no meio) e lista de admins (selo de coroa)
create or replace function public.rv_admin_active() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'events', coalesce((select jsonb_agg(x order by x.id) from (select id, kind, target, data, author, created_at, ends_at from public.rv_admin_events where ends_at > now() and kind in ('event', 'effect', 'stop') order by id desc limit 20) x), '[]'::jsonb),
    'admins', coalesce((select jsonb_agg(player_id) from public.rv_admins), '[]'::jsonb))
$$;

revoke all on function public.rv_admin_login(uuid, text, text), public.rv_admin_send(uuid, text, text, text, jsonb, int), public.rv_admin_active() from public;
grant execute on function public.rv_admin_login(uuid, text, text), public.rv_admin_send(uuid, text, text, text, jsonb, int), public.rv_admin_active() to anon, authenticated;

-- SENHA DE ADMIN (troque antes de rodar):
insert into public.rv_admin_cfg(k, v) values ('pass', extensions.crypt('TROQUE_PELA_SENHA', extensions.gen_salt('bf', 10)))
on conflict (k) do update set v = excluded.v;
