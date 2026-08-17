-- Sleeper's consolation bracket numbers its own placements from 1. Those are
-- not league-wide finishes and must never be presented as championships.
with loser_franchises as (
  select franchise_a_id as franchise_id
  from app.fantasy_playoff_matches
  where bracket_type = 'losers' and franchise_a_id is not null
  union
  select franchise_b_id
  from app.fantasy_playoff_matches
  where bracket_type = 'losers' and franchise_b_id is not null
), winner_franchises as (
  select franchise_a_id as franchise_id
  from app.fantasy_playoff_matches
  where bracket_type = 'winners' and franchise_a_id is not null
  union
  select franchise_b_id
  from app.fantasy_playoff_matches
  where bracket_type = 'winners' and franchise_b_id is not null
)
update app.fantasy_season_franchises as franchise
set final_rank = null,
    playoff_finish = ''
where franchise.id in (select franchise_id from loser_franchises)
  and franchise.id not in (select franchise_id from winner_franchises);
