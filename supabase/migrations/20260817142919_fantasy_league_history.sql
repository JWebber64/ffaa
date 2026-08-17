create schema if not exists private;

create or replace function private.set_fantasy_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_fantasy_updated_at() from public, anon, authenticated;

create table if not exists public.fantasy_leagues (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  current_external_league_id text not null,
  name text not null,
  sport text not null default 'nfl',
  format text not null default '',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fantasy_leagues_provider_external_key unique (provider, current_external_league_id)
);

create table if not exists public.fantasy_league_seasons (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.fantasy_leagues(id) on delete cascade,
  provider text not null,
  provider_league_id text not null,
  previous_provider_league_id text,
  season integer not null,
  status text not null default '',
  total_rosters integer not null default 0,
  scoring_settings jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  roster_positions text[] not null default '{}',
  playoff_week_start integer,
  provider_draft_id text,
  raw_provider_payload jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fantasy_league_seasons_provider_id_key unique (provider, provider_league_id),
  constraint fantasy_league_seasons_league_season_key unique (league_id, season)
);

create table if not exists public.fantasy_managers (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_user_id text not null,
  current_username text not null default '',
  display_name text not null default '',
  avatar_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fantasy_managers_provider_user_key unique (provider, provider_user_id)
);

create table if not exists public.fantasy_season_franchises (
  id uuid primary key default gen_random_uuid(),
  league_season_id uuid not null references public.fantasy_league_seasons(id) on delete cascade,
  manager_id uuid references public.fantasy_managers(id) on delete set null,
  provider_roster_id integer not null,
  historical_username text not null default '',
  team_name text not null default '',
  avatar_url text not null default '',
  final_rank integer,
  regular_season_rank integer,
  playoff_seed integer,
  wins integer not null default 0,
  losses integer not null default 0,
  ties integer not null default 0,
  points_for numeric(12, 2) not null default 0,
  points_against numeric(12, 2) not null default 0,
  playoff_finish text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fantasy_season_franchises_roster_key unique (league_season_id, provider_roster_id)
);

create table if not exists public.fantasy_matchups (
  id uuid primary key default gen_random_uuid(),
  league_season_id uuid not null references public.fantasy_league_seasons(id) on delete cascade,
  week integer not null,
  provider_matchup_id text not null,
  franchise_a_id uuid not null references public.fantasy_season_franchises(id) on delete cascade,
  franchise_b_id uuid not null references public.fantasy_season_franchises(id) on delete cascade,
  score_a numeric(12, 2) not null default 0,
  score_b numeric(12, 2) not null default 0,
  is_playoff boolean not null default false,
  playoff_round integer,
  is_championship boolean not null default false,
  winner_franchise_id uuid references public.fantasy_season_franchises(id) on delete set null,
  margin numeric(12, 2) not null default 0,
  is_complete boolean not null default false,
  imported_at timestamptz not null default now(),
  constraint fantasy_matchups_provider_key unique (league_season_id, week, provider_matchup_id),
  constraint fantasy_matchups_distinct_franchises check (franchise_a_id <> franchise_b_id)
);

create table if not exists public.fantasy_weekly_roster_results (
  id uuid primary key default gen_random_uuid(),
  league_season_id uuid not null references public.fantasy_league_seasons(id) on delete cascade,
  franchise_id uuid not null references public.fantasy_season_franchises(id) on delete cascade,
  week integer not null,
  score numeric(12, 2) not null default 0,
  starter_score numeric(12, 2),
  bench_score numeric(12, 2),
  optimal_score numeric(12, 2),
  lineup_efficiency numeric(8, 5),
  points_left_on_bench numeric(12, 2),
  constraint fantasy_weekly_roster_results_key unique (league_season_id, franchise_id, week)
);

create table if not exists public.fantasy_weekly_player_results (
  id uuid primary key default gen_random_uuid(),
  weekly_roster_result_id uuid not null references public.fantasy_weekly_roster_results(id) on delete cascade,
  provider_player_id text not null,
  player_name text not null default '',
  position text not null default '',
  is_starter boolean not null default false,
  fantasy_points numeric(12, 2),
  constraint fantasy_weekly_player_results_key unique (weekly_roster_result_id, provider_player_id)
);

create table if not exists public.fantasy_playoff_matches (
  id uuid primary key default gen_random_uuid(),
  league_season_id uuid not null references public.fantasy_league_seasons(id) on delete cascade,
  bracket_type text not null check (bracket_type in ('winners', 'losers')),
  provider_match_id text not null,
  round integer not null,
  placement integer,
  franchise_a_id uuid references public.fantasy_season_franchises(id) on delete set null,
  franchise_b_id uuid references public.fantasy_season_franchises(id) on delete set null,
  winner_franchise_id uuid references public.fantasy_season_franchises(id) on delete set null,
  loser_franchise_id uuid references public.fantasy_season_franchises(id) on delete set null,
  constraint fantasy_playoff_matches_provider_key unique (league_season_id, bracket_type, provider_match_id)
);

create table if not exists public.fantasy_drafts (
  id uuid primary key default gen_random_uuid(),
  league_season_id uuid not null references public.fantasy_league_seasons(id) on delete cascade,
  provider_draft_id text not null,
  draft_type text not null default '',
  status text not null default '',
  budget numeric(12, 2),
  rounds integer,
  started_at timestamptz,
  completed_at timestamptz,
  settings jsonb not null default '{}'::jsonb,
  raw_provider_payload jsonb not null default '{}'::jsonb,
  constraint fantasy_drafts_provider_key unique (provider_draft_id)
);

create table if not exists public.fantasy_draft_picks (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.fantasy_drafts(id) on delete cascade,
  franchise_id uuid references public.fantasy_season_franchises(id) on delete set null,
  provider_pick_id text not null,
  provider_player_id text not null default '',
  player_name text not null default '',
  position text not null default '',
  nfl_team text not null default '',
  pick_number integer not null,
  round integer not null,
  draft_slot integer not null,
  auction_price numeric(12, 2),
  is_keeper boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  constraint fantasy_draft_picks_provider_key unique (draft_id, provider_pick_id)
);

create table if not exists public.fantasy_traded_picks (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.fantasy_drafts(id) on delete cascade,
  provider_asset_key text not null,
  season integer not null,
  round integer not null,
  original_franchise_id uuid references public.fantasy_season_franchises(id) on delete set null,
  previous_owner_franchise_id uuid references public.fantasy_season_franchises(id) on delete set null,
  owner_franchise_id uuid references public.fantasy_season_franchises(id) on delete set null,
  constraint fantasy_traded_picks_provider_key unique (draft_id, provider_asset_key)
);

create table if not exists public.fantasy_transactions (
  id uuid primary key default gen_random_uuid(),
  league_season_id uuid not null references public.fantasy_league_seasons(id) on delete cascade,
  provider_transaction_id text not null,
  transaction_type text not null,
  status text not null default '',
  week integer,
  creator_provider_user_id text not null default '',
  faab_bid numeric(12, 2),
  occurred_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  raw_provider_payload jsonb not null default '{}'::jsonb,
  constraint fantasy_transactions_provider_key unique (league_season_id, provider_transaction_id)
);

create table if not exists public.fantasy_transaction_assets (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.fantasy_transactions(id) on delete cascade,
  provider_asset_key text not null,
  asset_type text not null check (asset_type in ('player', 'faab', 'draft_pick')),
  provider_player_id text not null default '',
  player_name text not null default '',
  from_franchise_id uuid references public.fantasy_season_franchises(id) on delete set null,
  to_franchise_id uuid references public.fantasy_season_franchises(id) on delete set null,
  faab_amount numeric(12, 2),
  draft_season integer,
  draft_round integer,
  metadata jsonb not null default '{}'::jsonb,
  constraint fantasy_transaction_assets_provider_key unique (transaction_id, provider_asset_key)
);

create table if not exists public.fantasy_league_awards (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.fantasy_leagues(id) on delete cascade,
  league_season_id uuid references public.fantasy_league_seasons(id) on delete cascade,
  week integer,
  manager_id uuid references public.fantasy_managers(id) on delete set null,
  provider_player_id text,
  award_type text not null,
  title text not null,
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.fantasy_league_moments (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.fantasy_leagues(id) on delete cascade,
  league_season_id uuid references public.fantasy_league_seasons(id) on delete cascade,
  moment_type text not null,
  title text not null,
  description text not null default '',
  occurred_at timestamptz,
  source_type text,
  source_id uuid,
  is_manual boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fantasy_import_runs (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references public.fantasy_leagues(id) on delete set null,
  provider text not null,
  requested_external_league_id text not null,
  status text not null check (status in ('running', 'complete', 'failed')),
  seasons_imported integer not null default 0,
  progress jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists fantasy_league_seasons_league_idx on public.fantasy_league_seasons(league_id, season desc);
create index if not exists fantasy_season_franchises_manager_idx on public.fantasy_season_franchises(manager_id, league_season_id);
create index if not exists fantasy_matchups_season_week_idx on public.fantasy_matchups(league_season_id, week);
create index if not exists fantasy_matchups_franchise_a_idx on public.fantasy_matchups(franchise_a_id);
create index if not exists fantasy_matchups_franchise_b_idx on public.fantasy_matchups(franchise_b_id);
create index if not exists fantasy_weekly_results_franchise_idx on public.fantasy_weekly_roster_results(franchise_id, week);
create index if not exists fantasy_playoff_matches_season_idx on public.fantasy_playoff_matches(league_season_id, round);
create index if not exists fantasy_drafts_season_idx on public.fantasy_drafts(league_season_id);
create index if not exists fantasy_transactions_season_time_idx on public.fantasy_transactions(league_season_id, occurred_at desc);
create index if not exists fantasy_transaction_assets_player_idx on public.fantasy_transaction_assets(provider_player_id) where provider_player_id <> '';
create index if not exists fantasy_awards_league_idx on public.fantasy_league_awards(league_id, league_season_id);
create index if not exists fantasy_moments_league_time_idx on public.fantasy_league_moments(league_id, occurred_at desc);

drop trigger if exists fantasy_leagues_updated_at on public.fantasy_leagues;
create trigger fantasy_leagues_updated_at before update on public.fantasy_leagues
for each row execute function private.set_fantasy_updated_at();
drop trigger if exists fantasy_league_seasons_updated_at on public.fantasy_league_seasons;
create trigger fantasy_league_seasons_updated_at before update on public.fantasy_league_seasons
for each row execute function private.set_fantasy_updated_at();
drop trigger if exists fantasy_managers_updated_at on public.fantasy_managers;
create trigger fantasy_managers_updated_at before update on public.fantasy_managers
for each row execute function private.set_fantasy_updated_at();
drop trigger if exists fantasy_season_franchises_updated_at on public.fantasy_season_franchises;
create trigger fantasy_season_franchises_updated_at before update on public.fantasy_season_franchises
for each row execute function private.set_fantasy_updated_at();
drop trigger if exists fantasy_league_moments_updated_at on public.fantasy_league_moments;
create trigger fantasy_league_moments_updated_at before update on public.fantasy_league_moments
for each row execute function private.set_fantasy_updated_at();

alter table public.fantasy_leagues enable row level security;
alter table public.fantasy_league_seasons enable row level security;
alter table public.fantasy_managers enable row level security;
alter table public.fantasy_season_franchises enable row level security;
alter table public.fantasy_matchups enable row level security;
alter table public.fantasy_weekly_roster_results enable row level security;
alter table public.fantasy_weekly_player_results enable row level security;
alter table public.fantasy_playoff_matches enable row level security;
alter table public.fantasy_drafts enable row level security;
alter table public.fantasy_draft_picks enable row level security;
alter table public.fantasy_traded_picks enable row level security;
alter table public.fantasy_transactions enable row level security;
alter table public.fantasy_transaction_assets enable row level security;
alter table public.fantasy_league_awards enable row level security;
alter table public.fantasy_league_moments enable row level security;
alter table public.fantasy_import_runs enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'fantasy_leagues', 'fantasy_league_seasons', 'fantasy_managers', 'fantasy_season_franchises',
    'fantasy_matchups', 'fantasy_weekly_roster_results', 'fantasy_weekly_player_results',
    'fantasy_playoff_matches', 'fantasy_drafts', 'fantasy_draft_picks', 'fantasy_traded_picks',
    'fantasy_transactions', 'fantasy_transaction_assets', 'fantasy_league_awards', 'fantasy_league_moments'
  ] loop
    execute format('drop policy if exists "Public league history is readable" on public.%I', table_name);
    execute format('create policy "Public league history is readable" on public.%I for select to anon, authenticated using (true)', table_name);
    execute format('grant select on public.%I to anon, authenticated', table_name);
  end loop;
end;
$$;

revoke all on public.fantasy_import_runs from anon, authenticated;

create or replace function public.import_fantasy_league_history(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_provider text := payload ->> 'provider';
  v_requested_id text := payload ->> 'requestedExternalLeagueId';
  v_current_id text := payload #>> '{league,currentExternalLeagueId}';
  v_imported_at timestamptz := coalesce(nullif(payload ->> 'importedAt', '')::timestamptz, now());
  v_league_id uuid;
  v_season_id uuid;
  v_manager_id uuid;
  v_franchise_id uuid;
  v_weekly_id uuid;
  v_draft_id uuid;
  v_transaction_id uuid;
  v_import_run_id uuid;
  v_season jsonb;
  v_item jsonb;
  v_child jsonb;
  v_asset jsonb;
  v_is_current boolean;
  v_seasons_imported integer := 0;
begin
  if coalesce(v_provider, '') = '' or coalesce(v_current_id, '') = '' then
    raise exception 'provider and league.currentExternalLeagueId are required';
  end if;

  insert into public.fantasy_import_runs(provider, requested_external_league_id, status)
  values (v_provider, coalesce(v_requested_id, v_current_id), 'running')
  returning id into v_import_run_id;

  begin
    select seasons.league_id into v_league_id
    from public.fantasy_league_seasons seasons
    where seasons.provider = v_provider
      and seasons.provider_league_id in (
        select value ->> 'externalLeagueId'
        from jsonb_array_elements(coalesce(payload -> 'seasons', '[]'::jsonb))
      )
    limit 1;

    if v_league_id is null then
      select leagues.id into v_league_id
      from public.fantasy_leagues leagues
      where leagues.provider = v_provider
        and leagues.current_external_league_id = v_current_id
      limit 1;
    end if;

    if v_league_id is null then
      insert into public.fantasy_leagues(provider, current_external_league_id, name, sport, format, settings)
      values (
        v_provider,
        v_current_id,
        coalesce(payload #>> '{league,name}', v_current_id),
        coalesce(nullif(payload #>> '{league,sport}', ''), 'nfl'),
        coalesce(payload #>> '{league,format}', ''),
        coalesce(payload #> '{league,settings}', '{}'::jsonb)
      ) returning id into v_league_id;
    else
      update public.fantasy_leagues
      set current_external_league_id = v_current_id,
          name = coalesce(payload #>> '{league,name}', name),
          sport = coalesce(nullif(payload #>> '{league,sport}', ''), sport),
          format = coalesce(payload #>> '{league,format}', format),
          settings = coalesce(payload #> '{league,settings}', settings)
      where id = v_league_id;
    end if;

    update public.fantasy_import_runs set league_id = v_league_id where id = v_import_run_id;

    for v_season in select value from jsonb_array_elements(coalesce(payload -> 'seasons', '[]'::jsonb)) loop
      v_is_current := (v_season ->> 'externalLeagueId') = v_current_id;
      insert into public.fantasy_league_seasons(
        league_id, provider, provider_league_id, previous_provider_league_id, season, status,
        total_rosters, scoring_settings, settings, roster_positions, playoff_week_start,
        provider_draft_id, raw_provider_payload, imported_at
      ) values (
        v_league_id,
        v_provider,
        v_season ->> 'externalLeagueId',
        nullif(v_season ->> 'previousExternalLeagueId', ''),
        (v_season ->> 'season')::integer,
        coalesce(v_season ->> 'status', ''),
        coalesce((v_season ->> 'totalRosters')::integer, 0),
        coalesce(v_season -> 'scoringSettings', '{}'::jsonb),
        coalesce(v_season -> 'settings', '{}'::jsonb),
        coalesce(array(select jsonb_array_elements_text(coalesce(v_season -> 'rosterPositions', '[]'::jsonb))), '{}'),
        nullif(v_season ->> 'playoffWeekStart', '')::integer,
        nullif(v_season ->> 'providerDraftId', ''),
        coalesce(v_season -> 'raw', '{}'::jsonb),
        v_imported_at
      )
      on conflict (provider, provider_league_id) do update set
        league_id = excluded.league_id,
        previous_provider_league_id = excluded.previous_provider_league_id,
        season = excluded.season,
        status = excluded.status,
        total_rosters = excluded.total_rosters,
        scoring_settings = excluded.scoring_settings,
        settings = excluded.settings,
        roster_positions = excluded.roster_positions,
        playoff_week_start = excluded.playoff_week_start,
        provider_draft_id = excluded.provider_draft_id,
        raw_provider_payload = excluded.raw_provider_payload,
        imported_at = excluded.imported_at
      returning id into v_season_id;

      for v_item in select value from jsonb_array_elements(coalesce(v_season -> 'franchises', '[]'::jsonb)) loop
        v_manager_id := null;
        if nullif(v_item #>> '{manager,providerUserId}', '') is not null then
          insert into public.fantasy_managers(provider, provider_user_id, current_username, display_name, avatar_url)
          values (
            v_provider,
            v_item #>> '{manager,providerUserId}',
            coalesce(v_item #>> '{manager,currentUsername}', ''),
            coalesce(v_item #>> '{manager,displayName}', ''),
            coalesce(v_item #>> '{manager,avatarUrl}', '')
          )
          on conflict (provider, provider_user_id) do update set
            current_username = case when v_is_current then excluded.current_username else public.fantasy_managers.current_username end,
            display_name = case when v_is_current then excluded.display_name else public.fantasy_managers.display_name end,
            avatar_url = case when v_is_current then excluded.avatar_url else public.fantasy_managers.avatar_url end
          returning id into v_manager_id;
        end if;

        insert into public.fantasy_season_franchises(
          league_season_id, manager_id, provider_roster_id, historical_username, team_name,
          avatar_url, final_rank, regular_season_rank, playoff_seed, wins, losses, ties,
          points_for, points_against, playoff_finish
        ) values (
          v_season_id,
          v_manager_id,
          (v_item ->> 'providerRosterId')::integer,
          coalesce(v_item ->> 'historicalUsername', ''),
          coalesce(v_item ->> 'teamName', ''),
          coalesce(v_item ->> 'avatarUrl', ''),
          nullif(v_item ->> 'finalRank', '')::integer,
          nullif(v_item ->> 'regularSeasonRank', '')::integer,
          nullif(v_item ->> 'playoffSeed', '')::integer,
          coalesce((v_item ->> 'wins')::integer, 0),
          coalesce((v_item ->> 'losses')::integer, 0),
          coalesce((v_item ->> 'ties')::integer, 0),
          coalesce((v_item ->> 'pointsFor')::numeric, 0),
          coalesce((v_item ->> 'pointsAgainst')::numeric, 0),
          coalesce(v_item ->> 'playoffFinish', '')
        )
        on conflict (league_season_id, provider_roster_id) do update set
          manager_id = excluded.manager_id,
          historical_username = excluded.historical_username,
          team_name = excluded.team_name,
          avatar_url = excluded.avatar_url,
          final_rank = excluded.final_rank,
          regular_season_rank = excluded.regular_season_rank,
          playoff_seed = excluded.playoff_seed,
          wins = excluded.wins,
          losses = excluded.losses,
          ties = excluded.ties,
          points_for = excluded.points_for,
          points_against = excluded.points_against,
          playoff_finish = excluded.playoff_finish;
      end loop;

      for v_item in select value from jsonb_array_elements(coalesce(v_season -> 'weeklyResults', '[]'::jsonb)) loop
        select id into v_franchise_id from public.fantasy_season_franchises
        where league_season_id = v_season_id and provider_roster_id = (v_item ->> 'providerRosterId')::integer;
        if v_franchise_id is null then continue; end if;
        insert into public.fantasy_weekly_roster_results(
          league_season_id, franchise_id, week, score, starter_score
        ) values (
          v_season_id, v_franchise_id, (v_item ->> 'week')::integer,
          coalesce((v_item ->> 'score')::numeric, 0), nullif(v_item ->> 'starterScore', '')::numeric
        )
        on conflict (league_season_id, franchise_id, week) do update set
          score = excluded.score, starter_score = excluded.starter_score
        returning id into v_weekly_id;

        for v_child in select value from jsonb_array_elements(coalesce(v_item -> 'players', '[]'::jsonb)) loop
          insert into public.fantasy_weekly_player_results(
            weekly_roster_result_id, provider_player_id, player_name, position, is_starter, fantasy_points
          ) values (
            v_weekly_id, v_child ->> 'providerPlayerId', coalesce(v_child ->> 'playerName', ''),
            coalesce(v_child ->> 'position', ''), coalesce((v_child ->> 'isStarter')::boolean, false),
            nullif(v_child ->> 'fantasyPoints', '')::numeric
          )
          on conflict (weekly_roster_result_id, provider_player_id) do update set
            player_name = excluded.player_name,
            position = excluded.position,
            is_starter = excluded.is_starter,
            fantasy_points = excluded.fantasy_points;
        end loop;
      end loop;

      for v_item in select value from jsonb_array_elements(coalesce(v_season -> 'matchups', '[]'::jsonb)) loop
        insert into public.fantasy_matchups(
          league_season_id, week, provider_matchup_id, franchise_a_id, franchise_b_id,
          score_a, score_b, is_playoff, playoff_round, is_championship,
          winner_franchise_id, margin, is_complete, imported_at
        ) values (
          v_season_id,
          (v_item ->> 'week')::integer,
          v_item ->> 'providerMatchupId',
          (select id from public.fantasy_season_franchises where league_season_id = v_season_id and provider_roster_id = (v_item ->> 'rosterAId')::integer),
          (select id from public.fantasy_season_franchises where league_season_id = v_season_id and provider_roster_id = (v_item ->> 'rosterBId')::integer),
          coalesce((v_item ->> 'scoreA')::numeric, 0),
          coalesce((v_item ->> 'scoreB')::numeric, 0),
          coalesce((v_item ->> 'isPlayoff')::boolean, false),
          nullif(v_item ->> 'playoffRound', '')::integer,
          coalesce((v_item ->> 'isChampionship')::boolean, false),
          (select id from public.fantasy_season_franchises where league_season_id = v_season_id and provider_roster_id = nullif(v_item ->> 'winnerRosterId', '')::integer),
          coalesce((v_item ->> 'margin')::numeric, 0),
          coalesce((v_item ->> 'isComplete')::boolean, false),
          v_imported_at
        )
        on conflict (league_season_id, week, provider_matchup_id) do update set
          franchise_a_id = excluded.franchise_a_id,
          franchise_b_id = excluded.franchise_b_id,
          score_a = excluded.score_a,
          score_b = excluded.score_b,
          is_playoff = excluded.is_playoff,
          playoff_round = excluded.playoff_round,
          is_championship = excluded.is_championship,
          winner_franchise_id = excluded.winner_franchise_id,
          margin = excluded.margin,
          is_complete = excluded.is_complete,
          imported_at = excluded.imported_at;
      end loop;

      for v_item in select value from jsonb_array_elements(coalesce(v_season -> 'playoffMatches', '[]'::jsonb)) loop
        insert into public.fantasy_playoff_matches(
          league_season_id, bracket_type, provider_match_id, round, placement,
          franchise_a_id, franchise_b_id, winner_franchise_id, loser_franchise_id
        ) values (
          v_season_id, v_item ->> 'bracketType', v_item ->> 'providerMatchId',
          (v_item ->> 'round')::integer, nullif(v_item ->> 'placement', '')::integer,
          (select id from public.fantasy_season_franchises where league_season_id = v_season_id and provider_roster_id = nullif(v_item ->> 'rosterAId', '')::integer),
          (select id from public.fantasy_season_franchises where league_season_id = v_season_id and provider_roster_id = nullif(v_item ->> 'rosterBId', '')::integer),
          (select id from public.fantasy_season_franchises where league_season_id = v_season_id and provider_roster_id = nullif(v_item ->> 'winnerRosterId', '')::integer),
          (select id from public.fantasy_season_franchises where league_season_id = v_season_id and provider_roster_id = nullif(v_item ->> 'loserRosterId', '')::integer)
        )
        on conflict (league_season_id, bracket_type, provider_match_id) do update set
          round = excluded.round,
          placement = excluded.placement,
          franchise_a_id = excluded.franchise_a_id,
          franchise_b_id = excluded.franchise_b_id,
          winner_franchise_id = excluded.winner_franchise_id,
          loser_franchise_id = excluded.loser_franchise_id;
      end loop;

      for v_item in select value from jsonb_array_elements(coalesce(v_season -> 'drafts', '[]'::jsonb)) loop
        insert into public.fantasy_drafts(
          league_season_id, provider_draft_id, draft_type, status, budget, rounds,
          started_at, completed_at, settings, raw_provider_payload
        ) values (
          v_season_id, v_item ->> 'providerDraftId', coalesce(v_item ->> 'draftType', ''),
          coalesce(v_item ->> 'status', ''), nullif(v_item ->> 'budget', '')::numeric,
          nullif(v_item ->> 'rounds', '')::integer, nullif(v_item ->> 'startedAt', '')::timestamptz,
          nullif(v_item ->> 'completedAt', '')::timestamptz, coalesce(v_item -> 'settings', '{}'::jsonb),
          coalesce(v_item -> 'raw', '{}'::jsonb)
        )
        on conflict (provider_draft_id) do update set
          league_season_id = excluded.league_season_id,
          draft_type = excluded.draft_type,
          status = excluded.status,
          budget = excluded.budget,
          rounds = excluded.rounds,
          started_at = excluded.started_at,
          completed_at = excluded.completed_at,
          settings = excluded.settings,
          raw_provider_payload = excluded.raw_provider_payload
        returning id into v_draft_id;

        for v_child in select value from jsonb_array_elements(coalesce(v_item -> 'picks', '[]'::jsonb)) loop
          insert into public.fantasy_draft_picks(
            draft_id, franchise_id, provider_pick_id, provider_player_id, player_name,
            position, nfl_team, pick_number, round, draft_slot, auction_price, is_keeper, metadata
          ) values (
            v_draft_id,
            (select id from public.fantasy_season_franchises where league_season_id = v_season_id and provider_roster_id = nullif(v_child ->> 'providerRosterId', '')::integer),
            v_child ->> 'providerPickId', coalesce(v_child ->> 'providerPlayerId', ''),
            coalesce(v_child ->> 'playerName', ''), coalesce(v_child ->> 'position', ''),
            coalesce(v_child ->> 'nflTeam', ''), (v_child ->> 'pickNumber')::integer,
            (v_child ->> 'round')::integer, (v_child ->> 'draftSlot')::integer,
            nullif(v_child ->> 'auctionPrice', '')::numeric, coalesce((v_child ->> 'isKeeper')::boolean, false),
            coalesce(v_child -> 'metadata', '{}'::jsonb)
          )
          on conflict (draft_id, provider_pick_id) do update set
            franchise_id = excluded.franchise_id,
            provider_player_id = excluded.provider_player_id,
            player_name = excluded.player_name,
            position = excluded.position,
            nfl_team = excluded.nfl_team,
            pick_number = excluded.pick_number,
            round = excluded.round,
            draft_slot = excluded.draft_slot,
            auction_price = excluded.auction_price,
            is_keeper = excluded.is_keeper,
            metadata = excluded.metadata;
        end loop;

        for v_child in select value from jsonb_array_elements(coalesce(v_item -> 'tradedPicks', '[]'::jsonb)) loop
          insert into public.fantasy_traded_picks(
            draft_id, provider_asset_key, season, round, original_franchise_id,
            previous_owner_franchise_id, owner_franchise_id
          ) values (
            v_draft_id, v_child ->> 'providerAssetKey', (v_child ->> 'season')::integer,
            (v_child ->> 'round')::integer,
            (select id from public.fantasy_season_franchises where league_season_id = v_season_id and provider_roster_id = (v_child ->> 'originalRosterId')::integer),
            (select id from public.fantasy_season_franchises where league_season_id = v_season_id and provider_roster_id = (v_child ->> 'previousOwnerRosterId')::integer),
            (select id from public.fantasy_season_franchises where league_season_id = v_season_id and provider_roster_id = (v_child ->> 'ownerRosterId')::integer)
          )
          on conflict (draft_id, provider_asset_key) do update set
            season = excluded.season,
            round = excluded.round,
            original_franchise_id = excluded.original_franchise_id,
            previous_owner_franchise_id = excluded.previous_owner_franchise_id,
            owner_franchise_id = excluded.owner_franchise_id;
        end loop;
      end loop;

      for v_item in select value from jsonb_array_elements(coalesce(v_season -> 'transactions', '[]'::jsonb)) loop
        insert into public.fantasy_transactions(
          league_season_id, provider_transaction_id, transaction_type, status, week,
          creator_provider_user_id, faab_bid, occurred_at, metadata, raw_provider_payload
        ) values (
          v_season_id, v_item ->> 'providerTransactionId', v_item ->> 'transactionType',
          coalesce(v_item ->> 'status', ''), nullif(v_item ->> 'week', '')::integer,
          coalesce(v_item ->> 'creatorProviderUserId', ''), nullif(v_item ->> 'faabBid', '')::numeric,
          nullif(v_item ->> 'occurredAt', '')::timestamptz, coalesce(v_item -> 'metadata', '{}'::jsonb),
          coalesce(v_item -> 'raw', '{}'::jsonb)
        )
        on conflict (league_season_id, provider_transaction_id) do update set
          transaction_type = excluded.transaction_type,
          status = excluded.status,
          week = excluded.week,
          creator_provider_user_id = excluded.creator_provider_user_id,
          faab_bid = excluded.faab_bid,
          occurred_at = excluded.occurred_at,
          metadata = excluded.metadata,
          raw_provider_payload = excluded.raw_provider_payload
        returning id into v_transaction_id;

        for v_asset in select value from jsonb_array_elements(coalesce(v_item -> 'assets', '[]'::jsonb)) loop
          insert into public.fantasy_transaction_assets(
            transaction_id, provider_asset_key, asset_type, provider_player_id, player_name,
            from_franchise_id, to_franchise_id, faab_amount, draft_season, draft_round, metadata
          ) values (
            v_transaction_id, v_asset ->> 'providerAssetKey', v_asset ->> 'assetType',
            coalesce(v_asset ->> 'providerPlayerId', ''), coalesce(v_asset ->> 'playerName', ''),
            (select id from public.fantasy_season_franchises where league_season_id = v_season_id and provider_roster_id = nullif(v_asset ->> 'fromRosterId', '')::integer),
            (select id from public.fantasy_season_franchises where league_season_id = v_season_id and provider_roster_id = nullif(v_asset ->> 'toRosterId', '')::integer),
            nullif(v_asset ->> 'faabAmount', '')::numeric, nullif(v_asset ->> 'draftSeason', '')::integer,
            nullif(v_asset ->> 'draftRound', '')::integer, coalesce(v_asset -> 'metadata', '{}'::jsonb)
          )
          on conflict (transaction_id, provider_asset_key) do update set
            asset_type = excluded.asset_type,
            provider_player_id = excluded.provider_player_id,
            player_name = excluded.player_name,
            from_franchise_id = excluded.from_franchise_id,
            to_franchise_id = excluded.to_franchise_id,
            faab_amount = excluded.faab_amount,
            draft_season = excluded.draft_season,
            draft_round = excluded.draft_round,
            metadata = excluded.metadata;
        end loop;
      end loop;

      v_seasons_imported := v_seasons_imported + 1;
      update public.fantasy_import_runs
      set progress = jsonb_build_object('lastSeason', v_season ->> 'season', 'lastExternalLeagueId', v_season ->> 'externalLeagueId')
      where id = v_import_run_id;
    end loop;

    update public.fantasy_import_runs
    set status = 'complete', seasons_imported = v_seasons_imported, completed_at = now()
    where id = v_import_run_id;

    return jsonb_build_object(
      'status', 'complete',
      'leagueId', v_league_id,
      'importRunId', v_import_run_id,
      'seasonsImported', v_seasons_imported
    );
  exception when others then
    update public.fantasy_import_runs
    set status = 'failed', seasons_imported = v_seasons_imported,
        error_message = sqlerrm, completed_at = now()
    where id = v_import_run_id;
    return jsonb_build_object(
      'status', 'failed',
      'leagueId', v_league_id,
      'importRunId', v_import_run_id,
      'seasonsImported', v_seasons_imported,
      'error', sqlerrm
    );
  end;
end;
$$;

revoke all on function public.import_fantasy_league_history(jsonb) from public, anon, authenticated;
grant execute on function public.import_fantasy_league_history(jsonb) to service_role;
