-- RoleVRGO — mapas da comunidade (Criador de Mapas). Rode este arquivo no SQL Editor do Supabase.
create table if not exists public.rv_maps (
  id text primary key,
  owner uuid not null references public.rv_players(id) on delete cascade,
  name text not null,
  author text not null default 'Gato',
  data jsonb not null,
  is_public boolean not null default false,
  plays int not null default 0,
  likes int not null default 0,
  objects int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rv_maps_owner_idx on public.rv_maps(owner);
create index if not exists rv_maps_public_idx on public.rv_maps(is_public, updated_at desc);
create table if not exists public.rv_map_likes (
  map_id text not null references public.rv_maps(id) on delete cascade,
  player_id uuid not null references public.rv_players(id) on delete cascade,
  primary key (map_id, player_id)
);
create index if not exists rv_map_likes_player_idx on public.rv_map_likes(player_id);
alter table public.rv_maps enable row level security;
alter table public.rv_map_likes enable row level security;

create or replace function public.rv_map_save(p_id uuid, p_secret text, p_map_id text, p_name text, p_data jsonb, p_public boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id text; v_name text; v_author text;
begin
  perform public.rv_check(p_id, p_secret);
  if p_data is null or pg_column_size(p_data) > 950000 then raise exception 'rv_map_too_big'; end if;
  v_name := coalesce(nullif(left(btrim(regexp_replace(coalesce(p_name,''), '[[:cntrl:]<>]', '', 'g')), 28), ''), 'Mapa sem nome');
  select name into v_author from public.rv_players where id = p_id;
  if p_map_id is not null and exists (select 1 from public.rv_maps where id = p_map_id and owner = p_id) then
    update public.rv_maps set name = v_name, author = v_author, data = p_data, is_public = coalesce(p_public, false),
      objects = coalesce(jsonb_array_length(p_data->'objs'), 0), updated_at = now() where id = p_map_id;
    return jsonb_build_object('id', p_map_id);
  end if;
  if (select count(*) from public.rv_maps where owner = p_id) >= 20 then raise exception 'rv_map_limit'; end if;
  loop
    v_id := upper(substr(translate(md5(random()::text || clock_timestamp()::text), '01', 'XZ'), 1, 6));
    exit when not exists (select 1 from public.rv_maps where id = v_id);
  end loop;
  insert into public.rv_maps(id, owner, name, author, data, is_public, objects)
  values (v_id, p_id, v_name, v_author, p_data, coalesce(p_public, false), coalesce(jsonb_array_length(p_data->'objs'), 0));
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.rv_map_list(p_sort text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select id, name, author, plays, likes, objects, (extract(epoch from updated_at) * 1000)::bigint as updated
    from public.rv_maps where is_public
    order by case when p_sort = 'top' then likes * 3 + plays else 0 end desc, updated_at desc limit 60) x
$$;

create or replace function public.rv_map_mine(p_id uuid, p_secret text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform public.rv_check(p_id, p_secret);
  return coalesce((select jsonb_agg(x) from (
    select id, name, is_public, plays, likes, objects, (extract(epoch from updated_at) * 1000)::bigint as updated
    from public.rv_maps where owner = p_id order by updated_at desc) x), '[]'::jsonb);
end $$;

-- qualquer um com o código pode abrir (mapas privados são compartilhados pelo código)
create or replace function public.rv_map_get(p_map_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.rv_maps;
begin
  update public.rv_maps set plays = plays + 1 where id = upper(btrim(p_map_id)) returning * into r;
  if not found then return null; end if;
  return jsonb_build_object('id', r.id, 'name', r.name, 'author', r.author, 'owner', r.owner, 'is_public', r.is_public, 'plays', r.plays, 'likes', r.likes, 'data', r.data);
end $$;

create or replace function public.rv_map_like(p_id uuid, p_secret text, p_map_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  perform public.rv_check(p_id, p_secret);
  insert into public.rv_map_likes(map_id, player_id) values (p_map_id, p_id) on conflict do nothing;
  select count(*) into v_n from public.rv_map_likes where map_id = p_map_id;
  update public.rv_maps set likes = v_n where id = p_map_id;
  return jsonb_build_object('likes', v_n);
end $$;

create or replace function public.rv_map_delete(p_id uuid, p_secret text, p_map_id text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.rv_check(p_id, p_secret);
  delete from public.rv_maps where id = p_map_id and owner = p_id;
end $$;

revoke all on function public.rv_map_save(uuid, text, text, text, jsonb, boolean), public.rv_map_list(text), public.rv_map_mine(uuid, text),
  public.rv_map_get(text), public.rv_map_like(uuid, text, text), public.rv_map_delete(uuid, text, text) from public;
grant execute on function public.rv_map_save(uuid, text, text, text, jsonb, boolean), public.rv_map_list(text), public.rv_map_mine(uuid, text),
  public.rv_map_get(text), public.rv_map_like(uuid, text, text), public.rv_map_delete(uuid, text, text) to anon, authenticated;
