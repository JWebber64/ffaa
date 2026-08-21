alter table app.fantasy_weekly_roster_results
  add column if not exists actual_starting_player_ids text[] not null default '{}',
  add column if not exists optimal_starting_player_ids text[] not null default '{}',
  add column if not exists best_missed_substitution jsonb,
  add column if not exists optimal_starters_used integer,
  add column if not exists analytics_status text,
  add column if not exists analytics_reason text not null default '',
  add column if not exists unsupported_slots text[] not null default '{}',
  add column if not exists missing_slots text[] not null default '{}',
  add column if not exists calculation_version text,
  add column if not exists analytics_locked boolean not null default false,
  add column if not exists analytics_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'app.fantasy_weekly_roster_results'::regclass
      and conname = 'fantasy_weekly_roster_analytics_status_check'
  ) then
    alter table app.fantasy_weekly_roster_results
      add constraint fantasy_weekly_roster_analytics_status_check
      check (analytics_status is null or analytics_status in ('valid', 'incomplete', 'unsupported'));
  end if;
end;
$$;

alter table app.fantasy_league_awards
  add column if not exists franchise_id uuid references app.fantasy_season_franchises(id) on delete set null,
  add column if not exists weekly_roster_result_id uuid references app.fantasy_weekly_roster_results(id) on delete set null,
  add column if not exists source_matchup_id uuid references app.fantasy_matchups(id) on delete set null,
  add column if not exists player_name text not null default '',
  add column if not exists numeric_value numeric(14, 5),
  add column if not exists source_type text not null default '',
  add column if not exists source_key text,
  add column if not exists calculation_version text,
  add column if not exists is_manual boolean not null default false;

alter table app.fantasy_league_moments
  add column if not exists week integer,
  add column if not exists manager_ids uuid[] not null default '{}',
  add column if not exists provider_player_id text,
  add column if not exists player_name text not null default '',
  add column if not exists previous_value numeric(14, 5),
  add column if not exists new_value numeric(14, 5),
  add column if not exists source_key text,
  add column if not exists calculation_version text;

create unique index if not exists fantasy_league_awards_source_key_unique
  on app.fantasy_league_awards(league_id, source_key)
  where source_key is not null;
create unique index if not exists fantasy_league_moments_source_key_unique
  on app.fantasy_league_moments(league_id, source_key)
  where source_key is not null;
create index if not exists fantasy_weekly_results_season_week_idx
  on app.fantasy_weekly_roster_results(league_season_id, week);
create index if not exists fantasy_weekly_players_roster_idx
  on app.fantasy_weekly_player_results(weekly_roster_result_id);
create index if not exists fantasy_awards_season_week_idx
  on app.fantasy_league_awards(league_season_id, week);
create index if not exists fantasy_moments_season_week_idx
  on app.fantasy_league_moments(league_season_id, week);

create or replace function app.import_fantasy_weekly_derivations(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_provider text := payload ->> 'provider';
  v_league_id uuid;
  v_season jsonb;
  v_season_id uuid;
  v_item jsonb;
  v_franchise_id uuid;
  v_manager_id uuid;
  v_weekly_id uuid;
  v_source_id uuid;
  v_manager_ids uuid[];
  v_rows integer;
  v_weekly_updated integer := 0;
  v_awards_upserted integer := 0;
  v_moments_upserted integer := 0;
begin
  select id into v_league_id
  from app.fantasy_leagues
  where provider = v_provider
    and current_external_league_id = payload #>> '{league,currentExternalLeagueId}'
  limit 1;

  if v_league_id is null then
    select league_id into v_league_id
    from app.fantasy_league_seasons
    where provider = v_provider
      and provider_league_id = payload ->> 'requestedExternalLeagueId'
    limit 1;
  end if;
  if v_league_id is null then
    raise exception 'League must be imported before weekly derivations are stored.';
  end if;

  for v_season in select value from jsonb_array_elements(coalesce(payload -> 'seasons', '[]'::jsonb)) loop
    select id into v_season_id
    from app.fantasy_league_seasons
    where league_id = v_league_id
      and provider = v_provider
      and provider_league_id = v_season ->> 'externalLeagueId'
    limit 1;
    if v_season_id is null then continue; end if;

    for v_item in select value from jsonb_array_elements(coalesce(v_season -> 'weeklyResults', '[]'::jsonb)) loop
      select id into v_franchise_id
      from app.fantasy_season_franchises
      where league_season_id = v_season_id
        and provider_roster_id = (v_item ->> 'providerRosterId')::integer;
      if v_franchise_id is null then continue; end if;

      update app.fantasy_weekly_roster_results
      set starter_score = nullif(v_item ->> 'starterScore', '')::numeric,
          bench_score = nullif(v_item ->> 'benchScore', '')::numeric,
          optimal_score = nullif(v_item ->> 'optimalScore', '')::numeric,
          lineup_efficiency = nullif(v_item ->> 'lineupEfficiency', '')::numeric,
          points_left_on_bench = nullif(v_item ->> 'pointsLeftOnBench', '')::numeric,
          actual_starting_player_ids = coalesce(array(select jsonb_array_elements_text(coalesce(v_item -> 'actualStartingPlayerIds', '[]'::jsonb))), '{}'),
          optimal_starting_player_ids = coalesce(array(select jsonb_array_elements_text(coalesce(v_item -> 'optimalStartingPlayerIds', '[]'::jsonb))), '{}'),
          best_missed_substitution = v_item -> 'bestMissedSubstitution',
          optimal_starters_used = nullif(v_item ->> 'optimalStartersUsed', '')::integer,
          analytics_status = nullif(v_item ->> 'analyticsStatus', ''),
          analytics_reason = coalesce(v_item ->> 'analyticsReason', ''),
          unsupported_slots = coalesce(array(select jsonb_array_elements_text(coalesce(v_item -> 'unsupportedSlots', '[]'::jsonb))), '{}'),
          missing_slots = coalesce(array(select jsonb_array_elements_text(coalesce(v_item -> 'missingSlots', '[]'::jsonb))), '{}'),
          calculation_version = nullif(v_item ->> 'calculationVersion', ''),
          analytics_updated_at = now()
      where league_season_id = v_season_id
        and franchise_id = v_franchise_id
        and week = (v_item ->> 'week')::integer
        and not analytics_locked
      returning id into v_weekly_id;
      get diagnostics v_rows = row_count;
      v_weekly_updated := v_weekly_updated + v_rows;
    end loop;

    for v_item in select value from jsonb_array_elements(coalesce(v_season -> 'awards', '[]'::jsonb)) loop
      select id, manager_id into v_franchise_id, v_manager_id
      from app.fantasy_season_franchises
      where league_season_id = v_season_id
        and provider_roster_id = (v_item ->> 'providerRosterId')::integer;
      select id into v_weekly_id
      from app.fantasy_weekly_roster_results
      where league_season_id = v_season_id
        and franchise_id = v_franchise_id
        and week = (v_item ->> 'week')::integer;
      v_source_id := null;
      if v_item ->> 'sourceType' = 'matchup' then
        select id into v_source_id
        from app.fantasy_matchups
        where league_season_id = v_season_id
          and week = (v_item ->> 'week')::integer
          and provider_matchup_id = v_item ->> 'sourceProviderMatchupId';
      end if;

      insert into app.fantasy_league_awards(
        league_id, league_season_id, week, franchise_id, manager_id,
        weekly_roster_result_id, source_matchup_id, provider_player_id, player_name,
        award_type, title, description, numeric_value, source_type, source_key,
        calculation_version, is_manual, metadata
      ) values (
        v_league_id, v_season_id, (v_item ->> 'week')::integer, v_franchise_id, v_manager_id,
        v_weekly_id, v_source_id, nullif(v_item ->> 'providerPlayerId', ''), coalesce(v_item ->> 'playerName', ''),
        v_item ->> 'awardType', v_item ->> 'title', coalesce(v_item ->> 'description', ''),
        nullif(v_item ->> 'numericValue', '')::numeric, coalesce(v_item ->> 'sourceType', ''),
        v_item ->> 'sourceKey', nullif(v_item ->> 'calculationVersion', ''), false,
        jsonb_build_object(
          'season', (v_season ->> 'season')::integer,
          'providerRosterId', (v_item ->> 'providerRosterId')::integer,
          'sourceProviderMatchupId', v_item ->> 'sourceProviderMatchupId'
        )
      )
      on conflict (league_id, source_key) where source_key is not null do update set
        league_season_id = excluded.league_season_id,
        week = excluded.week,
        franchise_id = excluded.franchise_id,
        manager_id = excluded.manager_id,
        weekly_roster_result_id = excluded.weekly_roster_result_id,
        source_matchup_id = excluded.source_matchup_id,
        provider_player_id = excluded.provider_player_id,
        player_name = excluded.player_name,
        award_type = excluded.award_type,
        title = excluded.title,
        description = excluded.description,
        numeric_value = excluded.numeric_value,
        source_type = excluded.source_type,
        calculation_version = excluded.calculation_version,
        metadata = excluded.metadata
      where not app.fantasy_league_awards.is_manual;
      get diagnostics v_rows = row_count;
      v_awards_upserted := v_awards_upserted + v_rows;
    end loop;

    for v_item in select value from jsonb_array_elements(coalesce(v_season -> 'moments', '[]'::jsonb)) loop
      select coalesce(array_agg(franchise.manager_id) filter (where franchise.manager_id is not null), '{}')
      into v_manager_ids
      from jsonb_array_elements_text(coalesce(v_item -> 'providerRosterIds', '[]'::jsonb)) roster_id
      join app.fantasy_season_franchises franchise
        on franchise.league_season_id = v_season_id
       and franchise.provider_roster_id = roster_id.value::integer;
      v_source_id := null;
      if v_item ->> 'sourceType' = 'matchup' then
        select id into v_source_id
        from app.fantasy_matchups
        where league_season_id = v_season_id
          and week = nullif(v_item ->> 'week', '')::integer
          and provider_matchup_id = v_item ->> 'sourceProviderMatchupId';
      elsif v_item ->> 'sourceType' = 'weekly_roster_result' then
        select weekly.id into v_source_id
        from app.fantasy_weekly_roster_results weekly
        join app.fantasy_season_franchises franchise on franchise.id = weekly.franchise_id
        where weekly.league_season_id = v_season_id
          and weekly.week = nullif(v_item ->> 'week', '')::integer
          and franchise.provider_roster_id = (v_item #>> '{providerRosterIds,0}')::integer;
      elsif v_item ->> 'sourceType' = 'season' then
        v_source_id := v_season_id;
      end if;

      insert into app.fantasy_league_moments(
        league_id, league_season_id, week, moment_type, title, description, occurred_at,
        source_type, source_id, manager_ids, provider_player_id, player_name,
        previous_value, new_value, source_key, calculation_version, is_manual, metadata
      ) values (
        v_league_id, v_season_id, nullif(v_item ->> 'week', '')::integer,
        v_item ->> 'momentType', v_item ->> 'title', coalesce(v_item ->> 'description', ''), null,
        coalesce(v_item ->> 'sourceType', ''), v_source_id, coalesce(v_manager_ids, '{}'),
        nullif(v_item ->> 'providerPlayerId', ''), coalesce(v_item ->> 'playerName', ''),
        nullif(v_item ->> 'previousValue', '')::numeric, nullif(v_item ->> 'newValue', '')::numeric,
        v_item ->> 'sourceKey', nullif(v_item ->> 'calculationVersion', ''), false,
        jsonb_build_object(
          'season', (v_season ->> 'season')::integer,
          'week', nullif(v_item ->> 'week', '')::integer,
          'providerRosterIds', coalesce(v_item -> 'providerRosterIds', '[]'::jsonb),
          'sourceProviderMatchupId', v_item ->> 'sourceProviderMatchupId'
        )
      )
      on conflict (league_id, source_key) where source_key is not null do update set
        league_season_id = excluded.league_season_id,
        week = excluded.week,
        moment_type = excluded.moment_type,
        title = excluded.title,
        description = excluded.description,
        occurred_at = excluded.occurred_at,
        source_type = excluded.source_type,
        source_id = excluded.source_id,
        manager_ids = excluded.manager_ids,
        provider_player_id = excluded.provider_player_id,
        player_name = excluded.player_name,
        previous_value = excluded.previous_value,
        new_value = excluded.new_value,
        calculation_version = excluded.calculation_version,
        metadata = excluded.metadata
      where not app.fantasy_league_moments.is_manual;
      get diagnostics v_rows = row_count;
      v_moments_upserted := v_moments_upserted + v_rows;
    end loop;
  end loop;

  return jsonb_build_object(
    'status', 'complete',
    'leagueId', v_league_id,
    'weeklyRowsUpdated', v_weekly_updated,
    'awardsUpserted', v_awards_upserted,
    'momentsUpserted', v_moments_upserted
  );
end;
$$;

revoke all on function app.import_fantasy_weekly_derivations(jsonb) from public, anon, authenticated;
grant execute on function app.import_fantasy_weekly_derivations(jsonb) to service_role;
