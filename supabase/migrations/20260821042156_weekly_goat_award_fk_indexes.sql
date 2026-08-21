create index if not exists fantasy_awards_franchise_idx
  on app.fantasy_league_awards(franchise_id);

create index if not exists fantasy_awards_weekly_result_idx
  on app.fantasy_league_awards(weekly_roster_result_id);

create index if not exists fantasy_awards_source_matchup_idx
  on app.fantasy_league_awards(source_matchup_id);
