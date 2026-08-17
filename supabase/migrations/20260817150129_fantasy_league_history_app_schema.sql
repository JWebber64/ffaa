create schema if not exists app;
grant usage on schema app to anon, authenticated, service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'fantasy_leagues', 'fantasy_league_seasons', 'fantasy_managers', 'fantasy_season_franchises',
    'fantasy_matchups', 'fantasy_weekly_roster_results', 'fantasy_weekly_player_results',
    'fantasy_playoff_matches', 'fantasy_drafts', 'fantasy_draft_picks', 'fantasy_traded_picks',
    'fantasy_transactions', 'fantasy_transaction_assets', 'fantasy_league_awards',
    'fantasy_league_moments', 'fantasy_import_runs'
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null
      and to_regclass(format('app.%I', table_name)) is null then
      execute format('alter table public.%I set schema app', table_name);
    end if;
  end loop;
end;
$$;

do $$
declare
  function_definition text;
begin
  if to_regprocedure('public.import_fantasy_league_history(jsonb)') is not null then
    select pg_get_functiondef('public.import_fantasy_league_history(jsonb)'::regprocedure)
    into function_definition;
    function_definition := replace(
      function_definition,
      'CREATE OR REPLACE FUNCTION public.import_fantasy_league_history',
      'CREATE OR REPLACE FUNCTION app.import_fantasy_league_history'
    );
    function_definition := replace(function_definition, 'public.fantasy_', 'app.fantasy_');
    execute function_definition;
    drop function public.import_fantasy_league_history(jsonb);
  end if;
end;
$$;

revoke all on function app.import_fantasy_league_history(jsonb) from public, anon, authenticated;
grant execute on function app.import_fantasy_league_history(jsonb) to service_role;
