alter table app.fantasy_draft_picks
  alter column pick_number drop not null,
  alter column round drop not null,
  alter column draft_slot drop not null;

comment on column app.fantasy_draft_picks.pick_number is
  'Provider pick number when known; null when a supplemental source did not preserve sale order.';

comment on column app.fantasy_draft_picks.round is
  'Provider draft round when known; null for unordered historical auction ledgers.';

comment on column app.fantasy_draft_picks.draft_slot is
  'Provider draft slot when known; null for unordered historical auction ledgers.';

