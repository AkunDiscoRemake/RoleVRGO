-- RoleVRGO — esquema do Supabase (Postgres).
-- Identidade temporária sem senha: cada aparelho gera um id (uuid) + segredo; o banco guarda só o hash do segredo.
-- As tabelas têm RLS ligado e NENHUMA policy: todo acesso passa pelas funções SECURITY DEFINER abaixo.
-- O multiplayer em tempo real (posições, chat, presença, grupos) usa Supabase Realtime e não precisa de tabelas.

create table public.rv_players (
  id uuid primary key,
  secret_hash text not null,
  name text not null default 'Gato',
  friend_code text unique not null,
  look jsonb not null default '{}'::jsonb,
  data jsonb not null default '{}'::jsonb,
  level int not null default 1,
  wins int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create table public.rv_friends (
  a uuid not null references public.rv_players(id) on delete cascade,
  b uuid not null references public.rv_players(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  primary key (a, b)
);
create index rv_friends_b_idx on public.rv_friends(b);
create table public.rv_rooms (
  code text primary key,
  name text not null,
  is_public boolean not null default true,
  owner uuid references public.rv_players(id) on delete set null,
  permanent boolean not null default false,
  created_at timestamptz not null default now(),
  last_active timestamptz not null default now()
);
create index rv_rooms_owner_idx on public.rv_rooms(owner);
create index rv_players_wins_idx on public.rv_players(wins desc);
create index rv_players_level_idx on public.rv_players(level desc);
alter table public.rv_players enable row level security;
alter table public.rv_friends enable row level security;
alter table public.rv_rooms enable row level security;

insert into public.rv_rooms(code, name, is_public, permanent) values
  ('PRACA', 'Praça Central', true, true),
  ('ARENA', 'Clube da Luta', true, true),
  ('MINA', 'Mineradores', true, true);

create or replace function public.rv_check(p_id uuid, p_secret text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.rv_players where id = p_id
      and secret_hash = encode(sha256(convert_to(coalesce(p_secret,''), 'UTF8')), 'hex')) then
    raise exception 'rv_auth_failed';
  end if;
end $$;
revoke all on function public.rv_check(uuid, text) from public, anon, authenticated;

create or replace function public.rv_clean_name(p_name text) returns text
language sql immutable set search_path = '' as $$
  select coalesce(nullif(left(btrim(regexp_replace(coalesce(p_name,''), '[[:cntrl:]<>]', '', 'g')), 16), ''), 'Gato')
$$;

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
    values (p_id, encode(sha256(convert_to(p_secret, 'UTF8')), 'hex'), public.rv_clean_name(p_name), v_code,
            case when pg_column_size(coalesce(p_look,'{}'::jsonb)) < 2000 then coalesce(p_look,'{}'::jsonb) else '{}'::jsonb end)
    returning * into r;
  else
    perform public.rv_check(p_id, p_secret);
    update public.rv_players set last_seen = now() where id = p_id;
  end if;
  return jsonb_build_object('name', r.name, 'look', r.look, 'data', r.data, 'friend_code', r.friend_code, 'now', (extract(epoch from now()) * 1000)::bigint);
end $$;

create or replace function public.rv_save(p_id uuid, p_secret text, p_name text, p_look jsonb, p_data jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.rv_check(p_id, p_secret);
  if pg_column_size(p_data) > 60000 or pg_column_size(p_look) > 2000 then raise exception 'rv_too_big'; end if;
  update public.rv_players set
    name = public.rv_clean_name(p_name), look = coalesce(p_look, look), data = coalesce(p_data, data),
    level = least(999, greatest(1, coalesce((p_data->>'level')::int, level))),
    wins = least(1000000, greatest(0, coalesce((p_data->'stats'->>'ko')::int, wins))),
    updated_at = now(), last_seen = now()
  where id = p_id;
end $$;

create or replace function public.rv_friend_add(p_id uuid, p_secret text, p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.rv_players;
begin
  perform public.rv_check(p_id, p_secret);
  select * into t from public.rv_players where friend_code = upper(btrim(p_code));
  if not found or t.id = p_id then return jsonb_build_object('ok', false); end if;
  if exists (select 1 from public.rv_friends where a = t.id and b = p_id) then
    update public.rv_friends set status = 'accepted' where a = t.id and b = p_id;
    return jsonb_build_object('ok', true, 'id', t.id, 'name', t.name, 'status', 'accepted');
  end if;
  if (select count(*) from public.rv_friends where a = p_id) >= 100 then return jsonb_build_object('ok', false); end if;
  insert into public.rv_friends(a, b) values (p_id, t.id) on conflict do nothing;
  return jsonb_build_object('ok', true, 'id', t.id, 'name', t.name, 'status', 'pending');
end $$;

create or replace function public.rv_friend_accept(p_id uuid, p_secret text, p_other uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.rv_check(p_id, p_secret);
  update public.rv_friends set status = 'accepted' where a = p_other and b = p_id;
end $$;

create or replace function public.rv_friend_remove(p_id uuid, p_secret text, p_other uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.rv_check(p_id, p_secret);
  delete from public.rv_friends where (a = p_id and b = p_other) or (a = p_other and b = p_id);
end $$;

create or replace function public.rv_friends(p_id uuid, p_secret text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform public.rv_check(p_id, p_secret);
  return coalesce((select jsonb_agg(x) from (
    select p.id, p.name, p.level, p.look,
      case when f.status = 'accepted' then 'accepted' when f.a = p_id then 'outgoing' else 'incoming' end as status,
      (extract(epoch from p.last_seen) * 1000)::bigint as seen
    from public.rv_friends f join public.rv_players p on p.id = case when f.a = p_id then f.b else f.a end
    where f.a = p_id or f.b = p_id order by p.name limit 200) x), '[]'::jsonb);
end $$;

create or replace function public.rv_rooms_list() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select code, name, permanent from public.rv_rooms
    where is_public and (permanent or last_active > now() - interval '6 hours')
    order by permanent desc, last_active desc limit 30) x
$$;

create or replace function public.rv_room_create(p_id uuid, p_secret text, p_name text, p_public boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_code text; v_name text;
begin
  perform public.rv_check(p_id, p_secret);
  delete from public.rv_rooms where not permanent and last_active < now() - interval '2 days';
  if (select count(*) from public.rv_rooms where owner = p_id and last_active > now() - interval '1 hour') >= 5 then raise exception 'rv_room_limit'; end if;
  loop
    v_code := upper(substr(translate(md5(random()::text || clock_timestamp()::text), '01', 'XZ'), 1, 5));
    exit when not exists (select 1 from public.rv_rooms where code = v_code);
  end loop;
  v_name := coalesce(nullif(left(btrim(regexp_replace(coalesce(p_name,''), '[[:cntrl:]<>]', '', 'g')), 24), ''), 'Sala ' || v_code);
  insert into public.rv_rooms(code, name, is_public, owner) values (v_code, v_name, coalesce(p_public, false), p_id);
  return jsonb_build_object('code', v_code, 'name', v_name, 'is_public', coalesce(p_public, false));
end $$;

create or replace function public.rv_room_get(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.rv_rooms;
begin
  update public.rv_rooms set last_active = now() where code = upper(btrim(p_code)) returning * into r;
  if not found then return null; end if;
  return jsonb_build_object('code', r.code, 'name', r.name, 'is_public', r.is_public);
end $$;

create or replace function public.rv_leaderboard() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'wins', coalesce((select jsonb_agg(x) from (select name, wins, level from public.rv_players where wins > 0 order by wins desc, updated_at limit 10) x), '[]'::jsonb),
    'level', coalesce((select jsonb_agg(x) from (select name, wins, level from public.rv_players order by level desc, updated_at limit 10) x), '[]'::jsonb))
$$;

revoke all on function public.rv_login(uuid, text, text, jsonb), public.rv_save(uuid, text, text, jsonb, jsonb),
  public.rv_friend_add(uuid, text, text), public.rv_friend_accept(uuid, text, uuid), public.rv_friend_remove(uuid, text, uuid),
  public.rv_friends(uuid, text), public.rv_rooms_list(), public.rv_room_create(uuid, text, text, boolean),
  public.rv_room_get(text), public.rv_leaderboard(), public.rv_clean_name(text) from public;
grant execute on function public.rv_login(uuid, text, text, jsonb), public.rv_save(uuid, text, text, jsonb, jsonb),
  public.rv_friend_add(uuid, text, text), public.rv_friend_accept(uuid, text, uuid), public.rv_friend_remove(uuid, text, uuid),
  public.rv_friends(uuid, text), public.rv_rooms_list(), public.rv_room_create(uuid, text, text, boolean),
  public.rv_room_get(text), public.rv_leaderboard() to anon, authenticated;
grant execute on function public.rv_clean_name(text) to anon, authenticated;
