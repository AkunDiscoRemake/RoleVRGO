-- Casas customizáveis: a casa fica dentro de rv_players.data->'home' (salva junto com o progresso).
-- Esta função deixa outro jogador VISITAR a casa respeitando o cadeado escolhido pelo dono:
--   lock 0 = aberta para todos, 1 = só amigos, 2 = trancada (só o dono).
create or replace function public.rv_home_get(p_id uuid, p_secret text, p_owner uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.rv_players; lk int;
begin
  perform public.rv_check(p_id, p_secret);
  select * into t from public.rv_players where id = p_owner;
  if not found then return null; end if;
  lk := coalesce((t.data->'home'->>'lock')::int, 0);
  if p_id <> p_owner then
    if lk >= 2 then return jsonb_build_object('locked', true, 'name', t.name); end if;
    if lk = 1 and not exists (select 1 from public.rv_friends f where f.status = 'accepted' and ((f.a = p_id and f.b = p_owner) or (f.a = p_owner and f.b = p_id))) then
      return jsonb_build_object('locked', true, 'friends', true, 'name', t.name);
    end if;
  end if;
  return jsonb_build_object('name', t.name, 'home', coalesce(t.data->'home', '{}'::jsonb));
end $$;
revoke all on function public.rv_home_get(uuid, text, uuid) from public;
grant execute on function public.rv_home_get(uuid, text, uuid) to anon, authenticated;
