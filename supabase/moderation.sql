-- RoleVRGO — moderação: banimentos (valem no servidor) e denúncias. Rode depois de schema.sql e admin.sql.
create table if not exists public.rv_bans (
  player_id uuid primary key references public.rv_players(id) on delete cascade,
  reason text not null default '',
  by_name text not null default 'admin',
  until timestamptz,                       -- null = permanente
  created_at timestamptz not null default now()
);
create table if not exists public.rv_reports (
  id bigserial primary key,
  reporter uuid not null references public.rv_players(id) on delete cascade,
  target uuid not null references public.rv_players(id) on delete cascade,
  reason text not null,
  details text not null default '',
  map text not null default '',
  chat jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now()
);
create index if not exists rv_reports_open on public.rv_reports(status, created_at desc);
create index if not exists rv_reports_reporter on public.rv_reports(reporter, created_at desc);
alter table public.rv_bans enable row level security;
alter table public.rv_reports enable row level security;

-- autenticação pura (o antigo rv_check) e rv_check agora também barra banidos em TODAS as funções
create or replace function public.rv_auth(p_id uuid, p_secret text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.rv_players where id = p_id
      and secret_hash = encode(sha256(convert_to(coalesce(p_secret,''), 'UTF8')), 'hex')) then
    raise exception 'rv_auth_failed';
  end if;
end $$;
create or replace function public.rv_ban_of(p_id uuid) returns public.rv_bans
language sql stable security definer set search_path = '' as $$
  select * from public.rv_bans where player_id = p_id and (until is null or until > now())
$$;
create or replace function public.rv_check(p_id uuid, p_secret text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.rv_auth(p_id, p_secret);
  if (public.rv_ban_of(p_id)).player_id is not null then raise exception 'rv_banned'; end if;
end $$;
revoke all on function public.rv_auth(uuid, text), public.rv_ban_of(uuid), public.rv_check(uuid, text) from public, anon, authenticated;

-- login: igual ao anterior, mas o banido recebe o motivo e o prazo em vez de entrar
create or replace function public.rv_login(p_id uuid, p_secret text, p_name text, p_look jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.rv_players; v_code text; b public.rv_bans;
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
    perform public.rv_auth(p_id, p_secret);
    b := public.rv_ban_of(p_id);
    if b.player_id is not null then return jsonb_build_object('banned', true, 'reason', b.reason, 'until', b.until, 'by', b.by_name); end if;
    update public.rv_players set last_seen = now() where id = p_id;
  end if;
  return jsonb_build_object('name', r.name, 'look', r.look, 'data', r.data, 'friend_code', r.friend_code, 'now', (extract(epoch from now()) * 1000)::bigint, 'admin', public.rv_is_admin(p_id));
end $$;

-- ids banidos agora (os jogos escondem esses jogadores)
create or replace function public.rv_banned_ids() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(player_id), '[]'::jsonb) from public.rv_bans where until is null or until > now()
$$;

-- denúncia: no máximo 5 por hora por jogador e 1 por alvo a cada 10 minutos
create or replace function public.rv_report(p_id uuid, p_secret text, p_target uuid, p_reason text, p_details text, p_map text, p_chat jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform public.rv_check(p_id, p_secret);
  if p_target = p_id or not exists (select 1 from public.rv_players where id = p_target) then return jsonb_build_object('ok', false, 'why', 'alvo'); end if;
  if (select count(*) from public.rv_reports where reporter = p_id and created_at > now() - interval '1 hour') >= 5 then return jsonb_build_object('ok', false, 'why', 'limite'); end if;
  if exists (select 1 from public.rv_reports where reporter = p_id and target = p_target and created_at > now() - interval '10 minutes') then return jsonb_build_object('ok', false, 'why', 'repetida'); end if;
  insert into public.rv_reports(reporter, target, reason, details, map, chat)
  values (p_id, p_target, left(coalesce(p_reason, ''), 40), left(coalesce(p_details, ''), 200), left(coalesce(p_map, ''), 40),
          case when jsonb_typeof(p_chat) = 'array' and pg_column_size(p_chat) < 2000 then p_chat else '[]'::jsonb end);
  return jsonb_build_object('ok', true);
end $$;

-- ---------- funções do admin ----------
create or replace function public.rv_admin_ban(p_id uuid, p_secret text, p_target uuid, p_minutes int, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_name text; v_tname text; v_until timestamptz;
begin
  perform public.rv_check(p_id, p_secret);
  if not public.rv_is_admin(p_id) then raise exception 'rv_not_admin'; end if;
  if public.rv_is_admin(p_target) then return jsonb_build_object('ok', false, 'why', 'admin'); end if;
  select name into v_tname from public.rv_players where id = p_target; if v_tname is null then return jsonb_build_object('ok', false, 'why', 'alvo'); end if;
  select name into v_name from public.rv_players where id = p_id;
  v_until := case when coalesce(p_minutes, 0) <= 0 then null else now() + make_interval(mins => least(p_minutes, 525600)) end;
  insert into public.rv_bans(player_id, reason, by_name, until) values (p_target, left(coalesce(p_reason, ''), 120), coalesce(v_name, 'admin'), v_until)
  on conflict (player_id) do update set reason = excluded.reason, by_name = excluded.by_name, until = excluded.until, created_at = now();
  update public.rv_reports set status = 'done' where target = p_target and status = 'open';
  insert into public.rv_admin_events(kind, target, data, author, ends_at) values ('ban', 'all', jsonb_build_object('id', p_target, 'name', v_tname, 'reason', left(coalesce(p_reason, ''), 120), 'until', v_until), coalesce(v_name, 'admin'), now() + interval '10 minutes');
  return jsonb_build_object('ok', true, 'name', v_tname, 'until', v_until);
end $$;

create or replace function public.rv_admin_unban(p_id uuid, p_secret text, p_target uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  perform public.rv_check(p_id, p_secret);
  if not public.rv_is_admin(p_id) then raise exception 'rv_not_admin'; end if;
  delete from public.rv_bans where player_id = p_target;
  select name into v_name from public.rv_players where id = p_id;
  insert into public.rv_admin_events(kind, target, data, author, ends_at) values ('unban', 'all', jsonb_build_object('id', p_target), coalesce(v_name, 'admin'), now() + interval '10 minutes');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.rv_admin_bans(p_id uuid, p_secret text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform public.rv_check(p_id, p_secret);
  if not public.rv_is_admin(p_id) then raise exception 'rv_not_admin'; end if;
  return coalesce((select jsonb_agg(x) from (select b.player_id as id, p.name, b.reason, b.by_name, b.until, b.created_at from public.rv_bans b join public.rv_players p on p.id = b.player_id
    where b.until is null or b.until > now() order by b.created_at desc limit 50) x), '[]'::jsonb);
end $$;

create or replace function public.rv_admin_reports(p_id uuid, p_secret text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform public.rv_check(p_id, p_secret);
  if not public.rv_is_admin(p_id) then raise exception 'rv_not_admin'; end if;
  return coalesce((select jsonb_agg(x) from (select r.id, r.target, t.name as target_name, rp.name as reporter_name, r.reason, r.details, r.map, r.chat, r.created_at,
      (select count(*) from public.rv_reports o where o.target = r.target and o.status = 'open') as n
    from public.rv_reports r join public.rv_players t on t.id = r.target join public.rv_players rp on rp.id = r.reporter
    where r.status = 'open' order by r.created_at desc limit 40) x), '[]'::jsonb);
end $$;

create or replace function public.rv_admin_report_close(p_id uuid, p_secret text, p_report bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.rv_check(p_id, p_secret);
  if not public.rv_is_admin(p_id) then raise exception 'rv_not_admin'; end if;
  update public.rv_reports set status = 'done' where id = p_report;
end $$;

revoke all on function public.rv_login(uuid, text, text, jsonb), public.rv_banned_ids(), public.rv_report(uuid, text, uuid, text, text, text, jsonb),
  public.rv_admin_ban(uuid, text, uuid, int, text), public.rv_admin_unban(uuid, text, uuid), public.rv_admin_bans(uuid, text), public.rv_admin_reports(uuid, text), public.rv_admin_report_close(uuid, text, bigint) from public;
grant execute on function public.rv_login(uuid, text, text, jsonb), public.rv_banned_ids(), public.rv_report(uuid, text, uuid, text, text, text, jsonb),
  public.rv_admin_ban(uuid, text, uuid, int, text), public.rv_admin_unban(uuid, text, uuid), public.rv_admin_bans(uuid, text), public.rv_admin_reports(uuid, text), public.rv_admin_report_close(uuid, text, bigint) to anon, authenticated;
