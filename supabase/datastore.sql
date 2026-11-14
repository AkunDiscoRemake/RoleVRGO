-- RoleVRGO — DataStore dos mapas da comunidade (DataStoreService:GetDataStore / GetOrderedDataStore).
-- Rode depois de schema.sql e maps.sql. Cada mapa publicado tem o seu espaço de dados (map_id + store + key).
-- Quem grava é o jogador que está hospedando o servidor do mapa; o valor é texto JSON (até 16 KB).
create table if not exists public.rv_datastore (
  map_id text not null references public.rv_maps(id) on delete cascade,
  store text not null,
  key text not null,
  value text not null,
  num double precision,                      -- valor numérico (para OrderedDataStore), quando o valor é um número
  updated_by uuid references public.rv_players(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (map_id, store, key)
);
create index if not exists rv_datastore_ord on public.rv_datastore(map_id, store, num);
create index if not exists rv_datastore_writer on public.rv_datastore(updated_by, updated_at desc);
alter table public.rv_datastore enable row level security; -- sem políticas: só a função abaixo acessa

create or replace function public.rv_ds(p_id uuid, p_secret text, p_map text, p_store text, p_key text, p_op text, p_value text, p_asc boolean, p_limit int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v text; n double precision;
begin
  perform public.rv_check(p_id, p_secret);
  if p_map is null or not exists (select 1 from public.rv_maps where id = p_map) then raise exception 'rv_ds_no_map'; end if;
  p_store := left(coalesce(p_store, ''), 60); p_key := left(coalesce(p_key, ''), 60);
  if p_op = 'get' then
    select value into v from public.rv_datastore where map_id = p_map and store = p_store and key = p_key;
    return case when v is null then null else to_jsonb(v) end;
  elsif p_op = 'set' then
    if p_value is null or length(p_value) > 16000 then raise exception 'rv_ds_too_big'; end if;
    if (select count(*) from public.rv_datastore where updated_by = p_id and updated_at > now() - interval '1 minute') >= 120 then raise exception 'rv_ds_rate'; end if;
    if not exists (select 1 from public.rv_datastore where map_id = p_map and store = p_store and key = p_key)
       and (select count(*) from public.rv_datastore where map_id = p_map) >= 20000 then raise exception 'rv_ds_full'; end if;
    n := case when p_value ~ '^-?[0-9]+(\.[0-9]+)?([eE][-+]?[0-9]+)?$' then p_value::double precision else null end;
    insert into public.rv_datastore(map_id, store, key, value, num, updated_by, updated_at) values (p_map, p_store, p_key, p_value, n, p_id, now())
    on conflict (map_id, store, key) do update set value = excluded.value, num = excluded.num, updated_by = excluded.updated_by, updated_at = now();
    return null;
  elsif p_op = 'del' then
    delete from public.rv_datastore where map_id = p_map and store = p_store and key = p_key; return null;
  elsif p_op = 'list' then
    return coalesce((select jsonb_agg(jsonb_build_object('key', x.key, 'value', x.num)) from (
      select key, num from public.rv_datastore where map_id = p_map and store = p_store and num is not null
      order by case when p_asc then num end asc, case when not p_asc then num end desc limit greatest(1, least(coalesce(p_limit, 10), 100))) x), '[]'::jsonb);
  end if;
  raise exception 'rv_ds_bad_op';
end $$;
revoke all on function public.rv_ds(uuid, text, text, text, text, text, text, boolean, int) from public;
grant execute on function public.rv_ds(uuid, text, text, text, text, text, text, boolean, int) to anon, authenticated;
