-- Ranking das corridas (Autódromo das Patas e Corrida nas Nuvens): guarda só o melhor tempo de cada jogador por pista.
create table if not exists public.rv_race_times (
  player_id uuid not null references public.rv_players(id) on delete cascade,
  track text not null check (track in ('track', 'sky')),
  ms int not null check (ms between 5000 and 3600000),
  mount text not null default '',
  at timestamptz not null default now(),
  primary key (player_id, track)
);
create index if not exists rv_race_times_track_ms on public.rv_race_times(track, ms);
alter table public.rv_race_times enable row level security;

create or replace function public.rv_race_submit(p_id uuid, p_secret text, p_track text, p_ms int, p_mount text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare best int;
begin
  perform public.rv_check(p_id, p_secret);
  if p_track not in ('track', 'sky') or p_ms < 5000 or p_ms > 3600000 then return jsonb_build_object('ok', false); end if;
  insert into public.rv_race_times(player_id, track, ms, mount) values (p_id, p_track, p_ms, left(coalesce(p_mount, ''), 16))
  on conflict (player_id, track) do update set ms = excluded.ms, mount = excluded.mount, at = now() where excluded.ms < public.rv_race_times.ms;
  select ms into best from public.rv_race_times where player_id = p_id and track = p_track;
  return jsonb_build_object('ok', true, 'best', best, 'rank', (select count(*) + 1 from public.rv_race_times where track = p_track and ms < best));
end $$;

create or replace function public.rv_race_top(p_track text) returns jsonb
language sql security definer set search_path = '' stable as $$
  select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select p.name, t.ms, t.mount, p.level from public.rv_race_times t join public.rv_players p on p.id = t.player_id
    where t.track = p_track order by t.ms asc limit 10) x;
$$;
revoke all on function public.rv_race_submit(uuid, text, text, int, text) from public;
revoke all on function public.rv_race_top(text) from public;
grant execute on function public.rv_race_submit(uuid, text, text, int, text) to anon, authenticated;
grant execute on function public.rv_race_top(text) to anon, authenticated;
