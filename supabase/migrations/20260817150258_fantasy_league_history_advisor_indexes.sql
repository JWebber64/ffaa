create index if not exists fantasy_draft_picks_franchise_idx on app.fantasy_draft_picks(franchise_id);
create index if not exists fantasy_import_runs_league_idx on app.fantasy_import_runs(league_id);
create index if not exists fantasy_awards_season_idx on app.fantasy_league_awards(league_season_id);
create index if not exists fantasy_awards_manager_idx on app.fantasy_league_awards(manager_id);
create index if not exists fantasy_moments_season_idx on app.fantasy_league_moments(league_season_id);
create index if not exists fantasy_matchups_winner_idx on app.fantasy_matchups(winner_franchise_id);
create index if not exists fantasy_playoffs_franchise_a_idx on app.fantasy_playoff_matches(franchise_a_id);
create index if not exists fantasy_playoffs_franchise_b_idx on app.fantasy_playoff_matches(franchise_b_id);
create index if not exists fantasy_playoffs_winner_idx on app.fantasy_playoff_matches(winner_franchise_id);
create index if not exists fantasy_playoffs_loser_idx on app.fantasy_playoff_matches(loser_franchise_id);
create index if not exists fantasy_traded_picks_original_idx on app.fantasy_traded_picks(original_franchise_id);
create index if not exists fantasy_traded_picks_previous_idx on app.fantasy_traded_picks(previous_owner_franchise_id);
create index if not exists fantasy_traded_picks_owner_idx on app.fantasy_traded_picks(owner_franchise_id);
create index if not exists fantasy_transaction_assets_from_idx on app.fantasy_transaction_assets(from_franchise_id);
create index if not exists fantasy_transaction_assets_to_idx on app.fantasy_transaction_assets(to_franchise_id);

drop policy if exists "Service role manages fantasy imports" on app.fantasy_import_runs;
create policy "Service role manages fantasy imports"
on app.fantasy_import_runs
for all
to service_role
using (true)
with check (true);
