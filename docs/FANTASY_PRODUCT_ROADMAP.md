# Fantasy Football Product Roadmap

This roadmap extends the product around three jobs: run the draft, win the week, and preserve league history. Priorities assume Sleeper remains the league host; GameHQ adds decision support, presentation, analysis, and durable league memory. No item should present modeled advice as live fact without a visible source and freshness state.

Complexity is relative: **S** (days), **M** (one to two focused iterations), **L** (multi-system project), **XL** (program of work). Suggested order is the dependency-aware sequence within each priority.

## Delivered data-trust foundation

- History Health persists and renders per-season coverage for franchises, manager mapping, matchups, weekly player results, drafts, and transactions. It is the prerequisite for all historical draft and manager analytics.
- Draft Receipts and Manager Draft DNA deliver the supported historical portion of opponent budget and roster tendencies: budget-normalized spend structure, repeat targets, and observed returns on the drafting franchise.
- Nomination patterns, bid timing, injury-adjusted value, grades, and live DraftRoom recommendations remain blocked until nomination/order evidence and a separately approved consumer methodology exist.

## P0 — Trustworthy decisions and draft-room continuity

| Order | Feature | User problem | Proposed solution | Data requirements | Technical dependencies | Complexity |
|---:|---|---|---|---|---|:---:|
| 1 | Lineup alerts | Managers miss empty slots, byes, and injury designations. | Persistent, explainable alert rules in This Week with source timestamps and Sleeper deep links. | Active manager roster, starters, NFL week, bye and status data. | Manager identity mapping, alert rule engine, freshness UI. | M |
| 2 | Start/sit explanations | A projection difference does not explain why one player is preferred. | Compare opportunity, role, opponent, floor, ceiling, and availability; state uncertainty. | Weekly projections, usage, opponent context, injury status. | Player identity map, scoring-aware comparison model. | L |
| 3 | Dynamic inflation and deflation | Static auction values become wrong as money leaves the room. | Recalculate position and overall market inflation after every sale. | Remaining budgets, roster slots, available player values, completed sales. | Live draft event stream, valuation service, deterministic tests. | L |
| 4 | Adjusted fair value | Managers cannot translate a baseline value into the current room economy. | Show baseline value, league adjustment, inflation adjustment, and resulting fair value separately. | Scoring, roster demand, team count, budget, live inflation. | League profile, dynamic inflation, source-aware values. | M |
| 5 | Target price | Managers need a practical bid plan, not a single abstract value. | Recommend a value-conscious target with assumptions and range. | Adjusted fair value, roster need, tier depth, remaining budget. | Adjusted fair value, roster construction model. | M |
| 6 | Maximum recommended price | Managers need a hard stop that protects the rest of the roster. | Calculate a ceiling that reserves enough money for required slots and alternatives. | Budget, open slots, minimum bids, tier alternatives. | Target price, legal-roster solver. | M |
| 7 | Manager buying power | The room cannot see who can still win a player or control a tier. | Rank maximum bids and open-slot pressure for every team. | Team budgets, roster slots, minimum-bid rules. | Shared live draft state, roster legality. | S |
| 8 | Reconnect to claimed team | A refresh or device switch can strand a manager outside the room. | Issue a recoverable claim token and rebind the device after identity verification. | Draft ID, team claim, session identity, claim history. | Auth/session hardening, claim-token lifecycle, audit events. | L |
| 9 | Separate host, manager, and public displays | One interface cannot serve control, bidding, and presentation well. | Explicit role-specific routes sharing one authoritative draft state. | Draft state and role permissions. | Role model, route guards, real-time synchronization. | L |
| 10 | Audit log | Commissioners need to explain corrections and disputed changes. | Append-only record of picks, bids, corrections, claims, pauses, and settings changes. | Actor, timestamp, before/after values, event type. | Server-side event ledger, commissioner identity. | L |
| 11 | Versioned constitution | Rules drift across documents and seasons. | Store published rule versions with effective season and immutable history. | Rule sections, versions, authors, effective dates. | Authenticated commissioner storage, history schema. | L |
| 12 | QR joining | Entering room codes on phones creates avoidable friction. | Render a QR code for the real join URL with room code embedded. | Public join URL and room code. | Stable room route, presentation-safe QR component. | S |

## P1 — Auction intelligence, weekly action, and public presentation

| Order | Feature | User problem | Proposed solution | Data requirements | Technical dependencies | Complexity |
|---:|---|---|---|---|---|:---:|
| 1 | Tier-cliff alerts | Managers do not notice when the last comparable player is being sold. | Warn when a nomination sits at the edge of a meaningful position tier. | Player tiers, available pool, roster demand. | Tier model, live availability, alert prioritization. | M |
| 2 | Position-run alerts | A fast run changes scarcity before a manager reacts. | Detect accelerated same-position purchases and quantify remaining supply. | Timestamped sales, positions, remaining tiers. | Draft event stream, rolling-window analytics. | M |
| 3 | Nominate-to-buy | Managers waste nominations when trying to acquire a target. | Recommend attainable targets that fit budget, need, and room behavior. | Target values, opponent buying power, roster needs. | Target price, tendency model, nomination engine. | L |
| 4 | Nominate-to-drain | Managers need nominations that consume opponents' money without harming their plan. | Rank desirable non-targets by opponent need and likely spend. | Opponent rosters, budgets, preferences, player demand. | Buying power, tendency model, transparent strategy rules. | L |
| 5 | Opponent budget and roster tendencies | Managers cannot quickly infer who will bid and why. | Show team-level spend pace, position demand, nomination pattern, and historical tendencies. | Live rosters/budgets plus stored draft history. | Manager identity, draft-history normalization. | L |
| 6 | Player survival estimate | Managers do not know whether a target is likely to return before their next chance. | Estimate survival using tier depth, opponent needs, nomination order, and room pace; show confidence. | Available players, nomination order, rosters, sales pace. | Probabilistic model, calibrated historical evaluation. | XL |
| 7 | Alternative player bundles | Managers overpay because they compare one star only to one alternative. | Present two- or three-player constructions with total cost and roster tradeoff. | Values, open slots, position needs, tier alternatives. | Roster solver, adjusted fair values. | L |
| 8 | Public presentation mode | Draft parties need a readable board without controls or private details. | Large-format, auto-updating presentation route optimized for TVs. | Public draft state, league branding. | Public role, responsive board, wake-lock handling. | M |
| 9 | Spectator link | Remote viewers need safe read-only access. | Signed or public read-only URL with no management capabilities. | Public-safe draft state. | Permission model, rate limits, route metadata policy. | M |
| 10 | Full-screen board | Hosts need maximum board density on a dedicated display. | Fullscreen-capable board with adaptable columns and legible sale states. | Draft board state. | Presentation mode, viewport presets. | M |
| 11 | Recent sales ticker | Viewers lose context as picks leave the main focus. | Compact chronological ticker of completed sales or picks. | Recent draft events, price/pick/team. | Audit/event stream, presentation components. | S |
| 12 | Waiver recommendations | Managers need the best available upgrades for their actual roster. | Rank confirmed free agents by need, rest-of-season value, role change, and schedule. | League rosters, waiver availability, projections, usage, FAAB. | Current player map, availability verification, recommendation explanations. | XL |
| 13 | FAAB planner | Managers struggle to price waiver bids relative to season and league economy. | Suggest ranges based on replacement value, need, budget distribution, and week. | FAAB balances, bids when available, roster needs, player value. | Waiver recommendations, league budget model. | L |
| 14 | Drop recommendations | Adding a player is easy; identifying the lowest-cost cut is not. | Rank cut candidates with role, depth, bye, and replacement consequences. | Full roster, status, projections, league replacement pool. | Roster evaluator, waiver availability. | L |
| 15 | Polls and ballots | League decisions disappear into chat threads. | Structured proposals with options, deadlines, eligibility, and durable results. | Members, proposal text, votes, deadlines. | Manager auth, commissioner permissions, notifications. | L |
| 16 | Announcement feed | Important commissioner messages are fragmented. | League-scoped feed with pinned, scheduled, and acknowledged posts. | Author, league members, message state. | Auth, notification delivery, moderation rules. | M |

## P2 — League operations, multi-league management, and deeper weekly strategy

| Order | Feature | User problem | Proposed solution | Data requirements | Technical dependencies | Complexity |
|---:|---|---|---|---|---|:---:|
| 1 | Trade analyzer | Managers need a scoring- and roster-aware view of both sides. | Compare rest-of-season value, lineup impact, depth risk, and schedule; avoid a false universal winner. | Rosters, scoring, projections, schedule, player values. | Identity map, roster solver, explanation layer. | XL |
| 2 | Trade finder | Managers know a need but not which league mate can satisfy it. | Match complementary roster strengths and generate balanced starting frameworks. | Every roster, needs, values, preferences if saved. | Trade analyzer, search/optimization service. | XL |
| 3 | Playoff odds | Standings alone do not show postseason probability. | Simulate remaining schedule with transparent assumptions and scenario ranges. | Schedule, standings, team strength distribution, tiebreakers. | Simulation engine, league-rule parsing. | L |
| 4 | Game-day matchup center | Managers must jump among apps to understand live fantasy swings. | Live matchup view with NFL game state, player scoring, win-impact events, and alerts. | Licensed or public live scoring feed, lineups, league scoring. | Low-latency ingestion, provider terms, event matching. | XL |
| 5 | Schedule builder | Commissioners manually assemble league schedules and constraints. | Generate balanced schedules with rivalry, rematch, and bye constraints. | Teams, weeks, divisions, constraints. | Constraint solver, commissioner controls. | L |
| 6 | Rivalry-week scheduler | Rivalries should be intentional rather than accidental. | Suggest rivalry pairs from history and place them in a selected week. | Head-to-head history, manager identities, schedule. | Schedule builder, rivalry analytics. | M |
| 7 | Playoff simulator | Commissioners need to test bracket and tiebreaker rules before publishing. | Interactive bracket simulator with edge cases and rule explanations. | Seeds, playoff format, tiebreakers, reseeding rules. | Versioned rules, deterministic bracket engine. | L |
| 8 | Keeper declarations | Keeper choices are scattered and hard to audit. | Deadline-based declarations with eligibility, cost, and commissioner approval. | Rosters, prior draft cost, rules, deadlines. | Manager auth, versioned constitution, notifications. | L |
| 9 | Dues and payout tracking | League finances lack a transparent ledger. | Track obligations, receipts, prize rules, and payouts without moving money. | Member obligations, payment status, prize configuration. | Secure finance ledger, permissions, export. | L |
| 10 | Award history | Weekly and season awards disappear after presentation. | Persist normalized awards and show manager/player timelines. | Award definitions, winners, source week/season. | Weekly award engine, history storage. | M |
| 11 | League calendar | Drafts, waivers, votes, keepers, and payouts lack one schedule. | Unified league timeline with deadlines and subscription export. | Events, recurrence, owners, league timezone. | Auth, calendar model, notifications. | M |
| 12 | Portfolio dashboard | Multi-league managers cannot see all urgent decisions together. | Cross-league weekly overview sorted by impact and deadline. | All connected leagues, identities, lineups, schedules. | Reliable active identities, multi-league ingestion. | XL |
| 13 | Player exposure | Managers unknowingly concentrate too much risk in a few players. | Show roster percentage and value exposure across leagues. | Every connected roster and league context. | Portfolio data model, canonical player IDs. | M |
| 14 | Injury exposure | One NFL injury can damage many teams at once. | Aggregate injured/questionable player exposure and replacement urgency. | Player statuses, exposure, league availability. | Player exposure, alert engine. | M |
| 15 | Bye-week concentration | Several leagues can require simultaneous replacement work. | Calendar view of lineup and roster exposure by bye week. | Rosters, NFL byes, lineup requirements. | Portfolio model, player schedule. | M |
| 16 | Pending decisions | Weekly tasks disappear across league tabs. | One queue for lineup, waiver, trade, and commissioner actions with deadlines. | Alerts, transactions, league deadlines. | Portfolio dashboard, task state. | L |
| 17 | Cross-league waiver opportunities | A player available in one league may be overlooked because they are rostered elsewhere. | Compare canonical player availability and need across every connection. | League rosters/free agents, needs, scoring. | Multi-league ingestion, waiver recommendations. | L |
| 18 | Shared free agents | Managers repeatedly search the same player in each league. | Player-centric availability matrix with league-specific fit. | Availability, rosters, scoring, team needs. | Cross-league waiver engine. | M |
| 19 | Multi-league notifications | Alerts from many leagues become noise. | Deduplicated, impact-ranked notifications with per-league controls. | Pending decisions, deadlines, user preferences. | Notification service, portfolio queue. | L |

## P3 — Advanced presentation, keeper, and dynasty systems

| Order | Feature | User problem | Proposed solution | Data requirements | Technical dependencies | Complexity |
|---:|---|---|---|---|---|:---:|
| 1 | Stream overlay | Live draft broadcasts need a transparent, composable graphics source. | Browser-source overlays for clock, nomination, recent sales, and standings. | Public draft events and branding. | Presentation mode, stable overlay API, chroma/transparency QA. | L |
| 2 | Team and league branding | Draft displays do not feel owned by the league. | Uploadable marks, colors, typography-safe themes, and default fallbacks. | Brand assets and theme choices. | Storage, image validation, accessible color checks. | M |
| 3 | Multiple display URLs | Different screens need board, ticker, and nomination views simultaneously. | Stable view-specific public URLs sharing one draft state. | Public draft state. | Spectator permissions, presentation components. | M |
| 4 | Keeper round penalties | Keeper value cannot be modeled without league-specific round cost. | Persist earned cost, escalation rules, and affected picks. | Prior drafts, keeper rules, current picks. | Versioned rules, keeper declarations, draft engine changes. | L |
| 5 | Salary escalation | Salary leagues need automatic year-over-year cost growth. | Rule-driven salary updates with preview and audit trail. | Contracts, prior salary, escalation rules. | Contract ledger, versioned rules, audit log. | L |
| 6 | Contracts | Dynasty salary leagues need term, value, and expiration management. | Contract ledger with validation, extension, release, and history. | Player, manager, salary, term, status. | Auth, durable storage, salary-cap rules. | XL |
| 7 | Franchise tags | Leagues need controlled retention outside normal contracts. | Configurable tag types with cost calculation and deadlines. | Contracts, market salary, rules. | Contract system, league calendar. | L |
| 8 | Rookie drafts | Dynasty leagues require a draft pool and pick ownership distinct from redraft. | Rookie-only snake/linear draft mode with traded picks. | Rookie player pool, order, pick ownership. | Draft engine abstraction, future-pick ledger. | XL |
| 9 | Future draft picks | Trades need durable pick assets across seasons. | Pick ledger with ownership chain, protections, and audit history. | Seasons, rounds, original/current owner. | Transaction normalization, dynasty league model. | L |
| 10 | Taxi squads | Dynasty managers need separate eligibility and activation rules. | Taxi roster section with experience rules, deadlines, and promotion audit. | Player experience, roster state, league rules. | Dynasty roster model, rules engine. | L |
| 11 | Contender/rebuilder analysis | Dynasty recommendations fail without team horizon. | Score present strength, age curve, picks, depth, and market value with explainable classifications. | Multi-year projections, age, picks, rosters, market values. | Dynasty valuation model, future-pick values. | XL |
| 12 | Pick value curves | Managers lack league-aware values for rookie picks. | Curves by format, team count, scoring, class strength, and time to draft. | Historical rookie outcomes, ADP, league settings. | Research dataset, calibrated valuation model. | XL |
| 13 | Orphan-team analysis | Commissioners struggle to explain an abandoned roster's strengths and liabilities. | Shareable audit of roster, picks, contracts, cap, and rebuild paths. | Full dynasty assets and league context. | Dynasty portfolio model, sharing system. | L |
| 14 | Dispersal drafts | Multiple orphan teams need a fair, traceable asset redistribution process. | Dedicated draft mode over eligible players, picks, and contracts. | Orphan assets, participants, dispersal rules. | Draft engine abstraction, contract/pick ledgers, audit log. | XL |

## Recommended implementation sequence

1. Complete P0 data trust: identity, freshness, alert rules, and audit events.
2. Add the auction value chain in dependency order: inflation → adjusted fair value → target price → maximum price → alerts and nomination strategy.
3. Establish public/read-only roles before expanding presentation views or streaming overlays.
4. Build waiver/drop support before FAAB, trade discovery, or a multi-league decision queue.
5. Version league rules before schedule, keeper, payout, or dynasty workflows depend on them.
6. Treat contracts, picks, and rookie drafts as one dynasty data program rather than isolated screens.
