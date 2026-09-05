# Route and overlay coverage

Archived pre-implementation audit. Statuses below describe the original evidence, not the finished implementation. See [layout and navigation contract](../../LAYOUT_NAVIGATION.md) for changes, new rendered checks, and remaining release acceptance.

Baseline: 05822b7891cf4fbde08e79f5d4a05395866414fa. This is a complete registered-route/import inventory, not a claim that every populated screen was rendered. Generated records include wrappers and aliases. Source inventory: 402 reachable files, 91 route declarations, 127 popup/control use sites. The five Tools child destinations are resolved inside Tools.tsx rather than Route declarations.

## Current findings inherited by page family

| Family | Shared layout owners audited | Required correction/acceptance |
| --- | --- | --- |
| Product homepage | App.tsx, AppShellV2, LandingV2 | Restore reachable Home for connected managers; preserve feature imagery; fresh unconnected visual acceptance remains. |
| My Teams | MyTeams, my-teams.css | Remove duplicated queue; compact status and account-sync bands; mobile first-team visibility. |
| League connections and management | LeagueHQ, league-hq.css, NativeLeagueFoundationPanel | Compact explanatory/setup material; preserve role/authority and native identities; native-account populated states pending. |
| Standalone Stats and seven tab modes | StatsExplorer, globals.css, refinement.css | Compact intro/source/controls; verify Leaders, Draft, Values, Opportunity, Trends, Matchups, Teams/DST. |
| Auction Values, source detail and print | AuctionValuesPage, auction-values.css | Natural-height header and table-first hierarchy; source detail/print acceptance still pending. |
| Analytics and its modes | AnalyticsLab, globals.css, refinement.css | Shared compact heading; charts retain useful height; populated per-mode/chart/legend checks pending. |
| Tools hub and all five tools | Tools.tsx, ToolLayout, tools.css | Compact headings, retain actual tool work and existing imagery; preserve wide preparation-card packing. |
| Connected league Team/Roster/Matchups | LeagueWorkspaceLayout, LeagueTeam/Lineup/Matchups, my-hq/team CSS | One context control; keep roster-first rows; populated roster/matchup data acceptance pending where loading was captured. |
| Connected League Players | LeaguePlayers plus embedded StatsExplorer | Avoid full standalone research hero inside another workspace; keep verified ownership distinctions. |
| League standings, schedule and all teams | LeagueOverview/Schedule/Teams plus workspace shell | Compact inherited chrome; retain primary tables, team selectors and schedule rows. |
| Native home, waivers, scoring, standings, schedule, trades, draft, pulse | Native feature branches plus workspace shell | Source branches traced; roles/data create different content. Do not claim empty/public states verify native operation. |
| League rules, invitations, commissioner and managers | LeagueRules/InvitationAccept/Manage, settings and membership workspaces | Compact read-only state and forms; invitation/role-sensitive acceptance pending; no writes performed. |
| All history routes | LeagueHistoryLayout, league-history.css | Compact nested masthead; correct overview scoreboard packing; child-page detail rendering remains in acceptance matrix. |
| Draft order | DraftOrderShowdown, draft-order.css, ResultDialog | Compact ordinary hero; preserve countdown, board geometry and bounded results body. |
| Offline and online draft entry | OfflineDraftV2, HostSetupV2, HostLobbyV2, JoinLobbyV2 | Source audited; populated setup/room states need fixture; do not mutate user drafts. |
| Live drafts and results | DraftRoomV2/ResultsV2 | Preserve interaction density and controls; populated live/result visual tests pending. |
| Legacy surfaces still routed | LegacyFrame, TopNav, legacy screen components | Source traced separately. Shared token/modal changes must not break them; no current screenshot endorsement. |

## Every Route declaration

| Route/family | Rendered element | Source owner | Coverage |
| --- | --- | --- | --- |
| `(layout wrapper)` | `{<LeagueHistoryLayout />}` | src/features/league-history/ui/LeagueHistoryApp.tsx:178 | Shared owner audited |
| `/league/:leagueId/history` | `{<LeagueDashboardPage />}` | src/features/league-history/ui/LeagueHistoryApp.tsx:179 | Live DOM snapshot; see evidence limits |
| `/league/:leagueId/history/week` | `{<WeekPage />}` | src/features/league-history/ui/LeagueHistoryApp.tsx:180 | Source path traced; rendered acceptance outstanding |
| `/league/:leagueId/history/managers` | `{<ManagersPage />}` | src/features/league-history/ui/LeagueHistoryApp.tsx:181 | Source path traced; rendered acceptance outstanding |
| `/league/:leagueId/history/managers/:managerId` | `{<ManagerProfilePage />}` | src/features/league-history/ui/LeagueHistoryApp.tsx:182 | Source path traced; rendered acceptance outstanding |
| `/league/:leagueId/history/h2h` | `{<HeadToHeadMatrixPage />}` | src/features/league-history/ui/LeagueHistoryApp.tsx:183 | Source path traced; rendered acceptance outstanding |
| `/league/:leagueId/history/rivalries/:managerAId/:managerBId` | `{<RivalryPage />}` | src/features/league-history/ui/LeagueHistoryApp.tsx:184 | Source path traced; rendered acceptance outstanding |
| `/league/:leagueId/history/archive` | `{<HistoryPage />}` | src/features/league-history/ui/LeagueHistoryApp.tsx:185 | Source path traced; rendered acceptance outstanding |
| `/league/:leagueId/history/champions` | `{<ChampionsPage />}` | src/features/league-history/ui/LeagueHistoryApp.tsx:186 | Source path traced; rendered acceptance outstanding |
| `/league/:leagueId/history/records` | `{<RecordsPage />}` | src/features/league-history/ui/LeagueHistoryApp.tsx:187 | Source path traced; rendered acceptance outstanding |
| `/league/:leagueId/history/seasons` | `{<SeasonsPage />}` | src/features/league-history/ui/LeagueHistoryApp.tsx:188 | Source path traced; rendered acceptance outstanding |
| `/league/:leagueId/history/seasons/:season` | `{<SeasonArchivePage />}` | src/features/league-history/ui/LeagueHistoryApp.tsx:189 | Source path traced; rendered acceptance outstanding |
| `/league/:leagueId/history/leaderboards` | `{<LeaderboardsPage />}` | src/features/league-history/ui/LeagueHistoryApp.tsx:190 | Source path traced; rendered acceptance outstanding |
| `/league/:leagueId/history/drafts` | `{<DraftHistoryPage />}` | src/features/league-history/ui/LeagueHistoryApp.tsx:191 | Source path traced; rendered acceptance outstanding |
| `/league/:leagueId/history/payouts` | `{<PayoutsPage />}` | src/features/league-history/ui/LeagueHistoryApp.tsx:192 | Source path traced; rendered acceptance outstanding |
| `/league/:leagueId/history/transactions` | `{<TransactionHistoryPage />}` | src/features/league-history/ui/LeagueHistoryApp.tsx:193 | Source path traced; rendered acceptance outstanding |
| `/league/:leagueId/history/trades` | `{<TransactionHistoryPage defaultType="trade" />}` | src/features/league-history/ui/LeagueHistoryApp.tsx:194 | Source path traced; rendered acceptance outstanding |
| `/league/:leagueId/history/waivers` | `{<TransactionHistoryPage defaultType="waiver" />}` | src/features/league-history/ui/LeagueHistoryApp.tsx:195 | Source path traced; rendered acceptance outstanding |
| `/league/:leagueId/history/*` | `{<LeagueHistoryRouteFallback />}` | src/features/league-history/ui/LeagueHistoryApp.tsx:197 | Redirect/fallback source traced |
| `(layout wrapper)` | `{<AppShellV2 />}` | src/routes/AuthenticatedApp.tsx:98 | Shared owner audited |
| `/` | `{<LandingV2 />}` | src/routes/AuthenticatedApp.tsx:99 | Source path traced; rendered acceptance outstanding |
| `/host/setup` | `{<HostSetupV2 />}` | src/routes/AuthenticatedApp.tsx:100 | Source path traced; rendered acceptance outstanding |
| `/host` | `{<HostLobbyV2 />}` | src/routes/AuthenticatedApp.tsx:101 | Source path traced; rendered acceptance outstanding |
| `/join` | `{<JoinLobbyV2 />}` | src/routes/AuthenticatedApp.tsx:102 | Source path traced; rendered acceptance outstanding |
| `/draft/:draftId` | `{<DraftRoomV2 />}` | src/routes/AuthenticatedApp.tsx:103 | Source path traced; rendered acceptance outstanding |
| `/results/:draftId` | `{<ResultsV2 />}` | src/routes/AuthenticatedApp.tsx:104 | Source path traced; rendered acceptance outstanding |
| `/legacy` | `{<LegacyFrame><Home /></LegacyFrame>}` | src/routes/AuthenticatedApp.tsx:107 | Source path traced; rendered acceptance outstanding |
| `/legacy/host` | `{<LegacyFrame><LobbyHost /></LegacyFrame>}` | src/routes/AuthenticatedApp.tsx:108 | Source path traced; rendered acceptance outstanding |
| `/legacy/join` | `{<LegacyFrame><LobbyJoin /></LegacyFrame>}` | src/routes/AuthenticatedApp.tsx:109 | Source path traced; rendered acceptance outstanding |
| `/legacy/ping` | `{<LegacyFrame><PingTest /></LegacyFrame>}` | src/routes/AuthenticatedApp.tsx:110 | Source path traced; rendered acceptance outstanding |
| `/legacy/setup` | `{<LegacyFrame><Setup /></LegacyFrame>}` | src/routes/AuthenticatedApp.tsx:111 | Source path traced; rendered acceptance outstanding |
| `/legacy/player-pool` | `{<LegacyFrame><RequireConfiguredDraft><PlayerPool /></RequireConfiguredDraft></LegacyFrame>}` | src/routes/AuthenticatedApp.tsx:112 | Source path traced; rendered acceptance outstanding |
| `/legacy/stats` | `{<LegacyFrame><StatsExplorer /></LegacyFrame>}` | src/routes/AuthenticatedApp.tsx:116 | Source path traced; rendered acceptance outstanding |
| `/legacy/board` | `{<LegacyFrame><RequireConfiguredDraft><DraftBoard /></RequireConfiguredDraft></LegacyFrame>}` | src/routes/AuthenticatedApp.tsx:117 | Source path traced; rendered acceptance outstanding |
| `/legacy/auctioneer` | `{<LegacyFrame><RequireConfiguredDraft><Auctioneer /></RequireConfiguredDraft></LegacyFrame>}` | src/routes/AuthenticatedApp.tsx:121 | Source path traced; rendered acceptance outstanding |
| `/legacy/results` | `{<LegacyFrame><RequireConfiguredDraft><Results teams={teams} /></RequireConfiguredDraft></LegacyFrame>}` | src/routes/AuthenticatedApp.tsx:125 | Source path traced; rendered acceptance outstanding |
| `*` | `{<Navigate to="/host" replace />}` | src/routes/AuthenticatedApp.tsx:130 | Redirect/fallback source traced |
| `(layout wrapper)` | `{<AppShellV2 />}` | src/App.tsx:102 | Shared owner audited |
| `/` | `{<ConnectedHome />}` | src/App.tsx:103 | Source path traced; rendered acceptance outstanding |
| `/teams` | `{<MyTeams />}` | src/App.tsx:104 | Live DOM snapshot; see evidence limits |
| `/leagues` | `{<LeagueHQ />}` | src/App.tsx:105 | Live DOM snapshot; see evidence limits |
| `/stats` | `{<StatsExplorer />}` | src/App.tsx:106 | Live DOM snapshot; see evidence limits |
| `/auction-values` | `{<AuctionValuesPage />}` | src/App.tsx:107 | Live DOM snapshot; see evidence limits |
| `/auction-values/source/:sourceId` | `{<AuctionValuesPage />}` | src/App.tsx:108 | Source path traced; rendered acceptance outstanding |
| `/auction-values/print` | `{<AuctionValuesPage />}` | src/App.tsx:109 | Source path traced; rendered acceptance outstanding |
| `/analytics` | `{<AnalyticsLab />}` | src/App.tsx:110 | Live DOM snapshot; see evidence limits |
| `/tools/*` | `{<Tools />}` | src/App.tsx:111 | Source path traced; rendered acceptance outstanding |
| `/league` | `{<Navigate to="/leagues" replace />}` | src/App.tsx:112 | Redirect/fallback source traced |
| `/league/teams` | `{<ActiveLeagueRedirect destination="teams" />}` | src/App.tsx:113 | Redirect/fallback source traced |
| `/league/teams/:teamId` | `{<ActiveLeagueTeamRedirect />}` | src/App.tsx:114 | Redirect/fallback source traced |
| `/league/matchups` | `{<ActiveLeagueRedirect destination="matchups" />}` | src/App.tsx:115 | Redirect/fallback source traced |
| `/league/lineup` | `{<ActiveLeagueRedirect destination="team/roster" />}` | src/App.tsx:116 | Redirect/fallback source traced |
| `/my-hq` | `{<ActiveLeagueRedirect destination="team" />}` | src/App.tsx:117 | Redirect/fallback source traced |
| `/draft-order` | `{<DraftOrderShowdown />}` | src/App.tsx:118 | Source path traced; rendered acceptance outstanding |
| `/league/:leagueId` | `{<LeagueWorkspaceLayout />}` | src/App.tsx:119 | Source path traced; rendered acceptance outstanding |
| `/league/:leagueId` | `{<LeagueHome />}` | src/App.tsx:120 | Source path traced; rendered acceptance outstanding |
| `/league/:leagueId/team` | `{<LeagueTeam />}` | src/App.tsx:121 | Live DOM snapshot; see evidence limits |
| `/league/:leagueId/team/roster` | `{<LeagueLineup />}` | src/App.tsx:122 | Source path traced; rendered acceptance outstanding |
| `/league/:leagueId/team/matchup` | `{<LeagueMatchups personalOnly />}` | src/App.tsx:123 | Source path traced; rendered acceptance outstanding |
| `/league/:leagueId/matchup` | `{<LeagueMatchups personalOnly />}` | src/App.tsx:124 | Live loading state only; populated state unverified |
| `/league/:leagueId/players` | `{<LeaguePlayers />}` | src/App.tsx:125 | Live DOM snapshot; see evidence limits |
| `/league/:leagueId/standings` | `{<LeagueOverview />}` | src/App.tsx:126 | Live DOM snapshot; see evidence limits |
| `/league/:leagueId/teams` | `{<LeagueTeams />}` | src/App.tsx:127 | Live DOM snapshot; see evidence limits |
| `/league/:leagueId/teams/:teamId` | `{<LeagueTeams />}` | src/App.tsx:128 | Source path traced; rendered acceptance outstanding |
| `/league/:leagueId/matchups` | `{<LeagueMatchups />}` | src/App.tsx:129 | Source path traced; rendered acceptance outstanding |
| `/league/:leagueId/schedule` | `{<LeagueSchedule />}` | src/App.tsx:130 | Live DOM snapshot; see evidence limits |
| `/league/:leagueId/transactions` | `{<LeagueTransactions />}` | src/App.tsx:131 | Source path traced; rendered acceptance outstanding |
| `/league/:leagueId/history/*` | `{<LeagueHistory />}` | src/App.tsx:132 | Source path traced; rendered acceptance outstanding |
| `/league/:leagueId/rules` | `{<LeagueRules />}` | src/App.tsx:133 | Source path traced; rendered acceptance outstanding |
| `/league/:leagueId/draft` | `{<LeagueDraft />}` | src/App.tsx:134 | Source path traced; rendered acceptance outstanding |
| `/league/:leagueId/pulse` | `{<LeaguePulse />}` | src/App.tsx:135 | Source path traced; rendered acceptance outstanding |
| `/league/:leagueId/join` | `{<LeagueInvitationAccept />}` | src/App.tsx:136 | Source path traced; rendered acceptance outstanding |
| `/league/:leagueId/manage` | `{<LeagueManage />}` | src/App.tsx:137 | Source path traced; rendered acceptance outstanding |
| `/league/:leagueId/commissioner/*` | `{<LeagueManage />}` | src/App.tsx:138 | Source path traced; rendered acceptance outstanding |
| `/league/:leagueId/managers/*` | `{<LegacyHistoryRedirect section="managers" />}` | src/App.tsx:139 | Redirect/fallback source traced |
| `/league/:leagueId/h2h/*` | `{<LegacyHistoryRedirect section="h2h" />}` | src/App.tsx:140 | Redirect/fallback source traced |
| `/league/:leagueId/records/*` | `{<LegacyHistoryRedirect section="records" />}` | src/App.tsx:141 | Redirect/fallback source traced |
| `/league/:leagueId/seasons/*` | `{<LegacyHistoryRedirect section="seasons" />}` | src/App.tsx:142 | Redirect/fallback source traced |
| `/league/:leagueId/week/*` | `{<LegacyHistoryRedirect section="week" />}` | src/App.tsx:143 | Redirect/fallback source traced |
| `/league/:leagueId/leaderboards/*` | `{<LegacyHistoryRedirect section="leaderboards" />}` | src/App.tsx:144 | Redirect/fallback source traced |
| `/league/:leagueId/drafts/*` | `{<LegacyHistoryRedirect section="drafts" />}` | src/App.tsx:145 | Redirect/fallback source traced |
| `/league/:leagueId/payouts/*` | `{<LegacyHistoryRedirect section="payouts" />}` | src/App.tsx:146 | Redirect/fallback source traced |
| `/league/:leagueId/trades` | `{<LeagueTransactions />}` | src/App.tsx:147 | Source path traced; rendered acceptance outstanding |
| `/league/:leagueId/trades/*` | `{<LegacyHistoryRedirect section="trades" />}` | src/App.tsx:148 | Redirect/fallback source traced |
| `/league/:leagueId/waivers/*` | `{<LegacyHistoryRedirect section="waivers" />}` | src/App.tsx:149 | Redirect/fallback source traced |
| `/league/:leagueId/rivalries/*` | `{<LegacyHistoryRedirect section="rivalries" />}` | src/App.tsx:150 | Redirect/fallback source traced |
| `/league/:leagueId/transactions/*` | `{<LegacyHistoryRedirect section="transactions" />}` | src/App.tsx:151 | Redirect/fallback source traced |
| `*` | `{<Navigate to={publicFallback} replace />}` | src/App.tsx:154 | Redirect/fallback source traced |
| `(layout wrapper)` | `{<AppShellV2 />}` | src/App.tsx:165 | Shared owner audited |
| `/offline-draft` | `{<OfflineDraftV2 />}` | src/App.tsx:166 | Source path traced; rendered acceptance outstanding |
| `*` | `{<Navigate to="/offline-draft" replace />}` | src/App.tsx:168 | Redirect/fallback source traced |

## Tools nested destinations

| Destination | Owner | Coverage |
| --- | --- | --- |
| /tools/auction-builder | AuctionTeamBuilder.tsx; ToolLayout | Source traced; visual timeout, no pass. |
| /tools/team-rater | TeamRater.tsx; ToolLayout | Live custom/empty roster AX snapshot; selected-team and populated states pending. |
| /tools/player-compare | PlayerCompare.tsx; ToolLayout | Live populated two-player AX snapshot; mobile/source expansion acceptance pending. |
| /tools/schedule | ScheduleLab.tsx; ToolLayout | Source traced; live sweep timeout, no pass. |
| /tools/offensive-line | OffensiveLineEnvironment.tsx; ToolLayout | Source traced; live sweep timeout, no pass. |

## Every popup/control family

Counts below are rendered component call sites, not unique popup implementations. UniversalSelect, Tooltip, and ProductMenu are intentionally included in the requested “etc.” scope.

| Type | Reachable call sites | Visual/source coverage |
| --- | --- | --- |
| aside | 2 | Source traced; role/data-dependent visual acceptance pending |
| UniversalSelect | 99 | Shared placement/height logic source audited; option/edge extremes pending |
| StatsPlayerDrawer | 2 | Overview and News opened at 390px; other states pending |
| div | 3 | Source traced; role/data-dependent visual acceptance pending |
| ProductMenu | 2 | Source traced; mobile More separately verified |
| DebugDrawer | 1 | Source traced; role/data-dependent visual acceptance pending |
| section | 1 | Source traced; role/data-dependent visual acceptance pending |
| CommissionerStudio | 1 | Source traced; role/data-dependent visual acceptance pending |
| ResultDialog | 1 | Bounded source layout inspected; live results fixture pending |
| Tooltip | 7 | Reachable source inventory; no spacing defect established |
| AlertDialog | 1 | Source sizing audited; long/short populated states pending |
| Modal | 4 | Source sizing audited; long/short populated states pending |
| DropdownMenu | 1 | Source traced; role/data-dependent visual acceptance pending |
| ModalLite | 1 | Source sizing audited; long/short populated states pending |
| TeamRosterDrawer | 1 | Source traced; role/data-dependent visual acceptance pending |

Additional CSS-owned surfaces: mobile More, league navigation disclosure, history navigation disclosures, PlayerSearch result/details menu, and floating toast/status UI. The mobile More clipping is verified. Source disclosure dismissal and anchored-menu placement were examined; not every long-content/keyboard case was exercised. Browser-owned confirmation, Google sign-in, and system sharing are separate from app CSS. DeviceModal has no runtime import path from App and is excluded from active product findings.

## Every popup/control call site

| Type | Source | Label/class hint |
| --- | --- | --- |
| aside | src/components/stats/StatsPlayerDrawer.tsx:327 | "stats-player-drawer" |
| UniversalSelect | src/components/stats/StatsPlayerDrawer.tsx:332 | "Game log season" |
| StatsPlayerDrawer | src/features/player-profile/PlayerProfileProvider.tsx:34 | See owning component |
| div | src/components/DebugDrawer.tsx:39 | {cn(           "absolute right-0 top-0 h-full w-[92vw] max-w-[420px] transform transition-transform",           isOpen ? "translate-x-0" : "translate-x-full"         )} |
| ProductMenu | src/layouts/AppShellV2.tsx:192 | "Research" |
| ProductMenu | src/layouts/AppShellV2.tsx:193 | "Draft" |
| UniversalSelect | src/layouts/AppShellV2.tsx:200 | "league-context-select" |
| UniversalSelect | src/layouts/AppShellV2.tsx:246 | "mobile-more-league-select" |
| DebugDrawer | src/layouts/AppShellV2.tsx:263 | See owning component |
| UniversalSelect | src/ui/SelectWrapper.tsx:31 | {cn("select-trigger", className)} |
| StatsPlayerDrawer | src/screens/StatsExplorer.tsx:2691 | See owning component |
| UniversalSelect | src/features/auction-values/PrintSettingsPanel.tsx:48 | "ffaa-control" |
| UniversalSelect | src/features/auction-values/PrintSettingsPanel.tsx:49 | "ffaa-control" |
| UniversalSelect | src/features/auction-values/PrintSettingsPanel.tsx:50 | "ffaa-control" |
| UniversalSelect | src/features/auction-values/PrintSettingsPanel.tsx:51 | "ffaa-control" |
| UniversalSelect | src/features/auction-values/SourceDirectory.tsx:70 | "ffaa-control" |
| UniversalSelect | src/features/auction-values/SourceDirectory.tsx:82 | "ffaa-control" |
| UniversalSelect | src/features/auction-values/AuctionValuesPage.tsx:239 | "ffaa-control" |
| UniversalSelect | src/screens/tools/OffensiveLineEnvironment.tsx:171 | See owning component |
| UniversalSelect | src/screens/tools/AuctionTeamBuilder.tsx:204 | See owning component |
| UniversalSelect | src/screens/tools/AuctionTeamBuilder.tsx:206 | See owning component |
| UniversalSelect | src/screens/tools/AuctionTeamBuilder.tsx:207 | See owning component |
| UniversalSelect | src/components/tools/ToolPlayerPicker.tsx:31 | See owning component |
| UniversalSelect | src/screens/tools/PlayerCompare.tsx:100 | See owning component |
| UniversalSelect | src/screens/tools/ScheduleLab.tsx:105 | See owning component |
| UniversalSelect | src/screens/tools/ScheduleLab.tsx:111 | See owning component |
| UniversalSelect | src/screens/tools/ScheduleLab.tsx:119 | See owning component |
| UniversalSelect | src/screens/tools/ScheduleLab.tsx:125 | See owning component |
| UniversalSelect | src/screens/tools/ScheduleLab.tsx:164 | See owning component |
| UniversalSelect | src/screens/tools/TeamRater.tsx:364 | See owning component |
| UniversalSelect | src/screens/tools/TeamRater.tsx:381 | See owning component |
| UniversalSelect | src/screens/tools/TeamRater.tsx:484 | See owning component |
| section | src/features/league-hq/CommissionerStudio.tsx:165 | "commissioner-studio" |
| UniversalSelect | src/screens/LeagueHQ.tsx:445 | "league-sync-select" |
| UniversalSelect | src/screens/LeagueHQ.tsx:506 | "league-season-select" |
| UniversalSelect | src/screens/LeagueHQ.tsx:760 | "league-record-sort-select" |
| UniversalSelect | src/screens/LeagueHQ.tsx:906 | "league-ballot-select" |
| UniversalSelect | src/screens/LeagueHQ.tsx:907 | "league-ballot-select" |
| CommissionerStudio | src/screens/LeagueHQ.tsx:915 | See owning component |
| UniversalSelect | src/features/native-scoring/NativeLiveMatchupWorkspace.tsx:116 | "Live scoring week" |
| UniversalSelect | src/features/native-scoring/NativeLiveMatchupWorkspace.tsx:116 | "Live matchup" |
| UniversalSelect | src/features/native-scoring/NativeLiveMatchupWorkspace.tsx:120 | {`Matchup ${index + 1} away team`} |
| UniversalSelect | src/features/native-scoring/NativeLiveMatchupWorkspace.tsx:120 | {`Matchup ${index + 1} home team`} |
| UniversalSelect | src/features/native-scoring/NativeLiveMatchupWorkspace.tsx:121 | "Scoring event player" |
| UniversalSelect | src/features/native-scoring/NativeLiveMatchupWorkspace.tsx:121 | "Scoring game state" |
| UniversalSelect | src/features/native-scoring/NativeLiveMatchupWorkspace.tsx:121 | "Normalized scoring statistic" |
| UniversalSelect | src/screens/LeagueMatchups.tsx:211 | "League week" |
| UniversalSelect | src/features/native-competition/NativeScheduleWorkspace.tsx:109 | "Protected home team" |
| UniversalSelect | src/features/native-competition/NativeScheduleWorkspace.tsx:109 | "Protected away team" |
| UniversalSelect | src/features/native-competition/NativeScheduleWorkspace.tsx:109 | "Scheduled bye team" |
| UniversalSelect | src/features/native-competition/NativeScheduleWorkspace.tsx:113 | "Schedule week" |
| UniversalSelect | src/features/native-competition/NativeScheduleWorkspace.tsx:113 | {`Home team for ${game.id}`} |
| UniversalSelect | src/features/native-competition/NativeScheduleWorkspace.tsx:113 | {`Away team for ${game.id}`} |
| UniversalSelect | src/features/native-lineup/NativeLineupWorkspace.tsx:251 | "Native lineup week" |
| UniversalSelect | src/features/native-lineup/NativeLineupWorkspace.tsx:252 | "Native lineup team" |
| UniversalSelect | src/features/native-lineup/NativeLineupWorkspace.tsx:268 | {`${slot.key} starter`} |
| UniversalSelect | src/features/native-lineup/NativeLineupWorkspace.tsx:280 | {`${group.label} game status`} |
| UniversalSelect | src/features/native-lineup/NativeLineupWorkspace.tsx:284 | "Emergency reopened player" |
| UniversalSelect | src/screens/LeagueLineup.tsx:311 | "League week" |
| UniversalSelect | src/screens/LeagueLineup.tsx:314 | "Manage team" |
| UniversalSelect | src/screens/LeagueLineup.tsx:343 | {`${slot.label} starter`} |
| UniversalSelect | src/features/native-waivers/NativeWaiverWorkspace.tsx:125 | See owning component |
| UniversalSelect | src/features/native-waivers/NativeWaiverWorkspace.tsx:134 | See owning component |
| UniversalSelect | src/features/native-waivers/NativeWaiverWorkspace.tsx:142 | {`Alternative ${index + 1} add player`} |
| UniversalSelect | src/features/native-waivers/NativeWaiverWorkspace.tsx:143 | {`Alternative ${index + 1} conditional drop`} |
| UniversalSelect | src/features/native-trades/NativeTradeWorkspace.tsx:66 | "Sending team" |
| UniversalSelect | src/features/native-trades/NativeTradeWorkspace.tsx:66 | "Receiving team" |
| UniversalSelect | src/features/league-membership/CommissionerPeopleWorkspace.tsx:249 | "Invitation role" |
| UniversalSelect | src/features/league-membership/CommissionerPeopleWorkspace.tsx:250 | "Invitation team" |
| UniversalSelect | src/features/native-draft/NativeDraftBoard.tsx:128 | "Auction bidding team" |
| UniversalSelect | src/features/native-draft/CommissionerDraftWorkspace.tsx:90 | "Native draft format" |
| UniversalSelect | src/features/native-draft/CommissionerDraftWorkspace.tsx:91 | "Native draft clock mode" |
| UniversalSelect | src/features/native-draft/CommissionerDraftWorkspace.tsx:96 | {`Draft position ${index + 1}`} |
| UniversalSelect | src/features/league-settings/AdvancedLeagueSettingsSection.tsx:19 | "Keeper cost method" |
| UniversalSelect | src/features/league-settings/CommissionerSeasonLifecycle.tsx:95 | "Champion" |
| UniversalSelect | src/features/league-settings/CommissionerSeasonLifecycle.tsx:96 | "Runner-up" |
| UniversalSelect | src/features/league-settings/CommissionerSettingsWorkspace.tsx:287 | "League type" |
| UniversalSelect | src/features/league-settings/CommissionerSettingsWorkspace.tsx:309 | "Draft format" |
| UniversalSelect | src/features/league-settings/CommissionerSettingsWorkspace.tsx:311 | "Scoring preset" |
| UniversalSelect | src/features/league-settings/CommissionerSettingsWorkspace.tsx:324 | "Schedule balance" |
| UniversalSelect | src/features/league-settings/CommissionerSettingsWorkspace.tsx:328 | "Playoff round length" |
| UniversalSelect | src/features/league-settings/CommissionerSettingsWorkspace.tsx:330 | "Waiver mode" |
| UniversalSelect | src/features/league-settings/CommissionerSettingsWorkspace.tsx:336 | "Waiver tiebreaker" |
| UniversalSelect | src/features/league-settings/CommissionerSettingsWorkspace.tsx:338 | "Trade review" |
| UniversalSelect | src/features/league-settings/CommissionerSettingsWorkspace.tsx:340 | "Post-trade roster policy" |
| UniversalSelect | src/features/league-settings/CommissionerSettingsWorkspace.tsx:342 | "Commissioner trade conflict policy" |
| UniversalSelect | src/features/league-settings/CommissionerSettingsWorkspace.tsx:343 | "Lineup lock policy" |
| UniversalSelect | src/features/league-settings/CommissionerSettingsWorkspace.tsx:344 | "Postponed game lineup policy" |
| UniversalSelect | src/features/league-settings/CommissionerSettingsWorkspace.tsx:345 | "Canceled game lineup policy" |
| UniversalSelect | src/features/league-settings/CommissionerSettingsWorkspace.tsx:346 | "Inactive player substitution policy" |
| UniversalSelect | src/features/league-settings/CommissionerSettingsWorkspace.tsx:347 | "Automatic lineup mode" |
| UniversalSelect | src/features/native-pulse/NativeLeaguePulseWorkspace.tsx:356 | "Pulse post type" |
| UniversalSelect | src/features/native-pulse/NativeLeaguePulseWorkspace.tsx:466 | "Voting threshold" |
| aside | src/features/player-sheet/LeaguePlayerSheet.tsx:45 | "league-player-sheet" |
| UniversalSelect | src/layouts/LeagueWorkspaceLayout.tsx:117 | "Switch fantasy team and league" |
| UniversalSelect | src/features/draft-order/ParticipantSetup.tsx:70 | "participant-league-select" |
| div | src/features/draft-order/ResultDialog.tsx:50 | "showdown-result-dialog" |
| ResultDialog | src/features/draft-order/DraftOrderShowdown.tsx:401 | See owning component |
| UniversalSelect | src/features/league-history/ui/pages/HeadToHeadPage.tsx:44 | See owning component |
| UniversalSelect | src/features/league-history/ui/pages/HeadToHeadPage.tsx:45 | See owning component |
| UniversalSelect | src/features/league-history/ui/pages/SeasonsPage.tsx:254 | "Filter auction manager" |
| UniversalSelect | src/features/league-history/ui/pages/SeasonsPage.tsx:255 | "Filter auction position" |
| UniversalSelect | src/features/league-history/ui/pages/SeasonsPage.tsx:256 | "Sort auction players" |
| UniversalSelect | src/features/league-history/ui/pages/ActivityPage.tsx:120 | See owning component |
| UniversalSelect | src/features/league-history/ui/pages/ActivityPage.tsx:121 | See owning component |
| UniversalSelect | src/features/league-history/ui/pages/ActivityPage.tsx:123 | See owning component |
| UniversalSelect | src/features/league-history/ui/pages/ActivityPage.tsx:229 | See owning component |
| UniversalSelect | src/features/league-history/ui/week/WeekHeader.tsx:52 | "Select season" |
| UniversalSelect | src/features/league-history/ui/week/WeekHeader.tsx:58 | "Select completed week" |
| UniversalSelect | src/screens_v2/OfflineDraftV2.tsx:2291 | "offline-roster-slot-select" |
| UniversalSelect | src/ui/custom.tsx:936 | {cx("cui-select", extracted.className, className)} |
| Tooltip | src/components/AppFooter.tsx:36 | {formatVersionFull(versionInfo)} |
| Tooltip | src/components/AuctionTimer.tsx:111 | {         isInAntiSnipeWindow            ? `Anti-snipe active! Timer extended to ${format(remaining)}`            : `High bid: $${highBid}${highBidder ? ` by Team ${highBidder}` : ''}`       } |
| AlertDialog | src/components/auction/ResetDraftButton.tsx:44 | See owning component |
| Modal | src/screens/Home.tsx:100 | See owning component |
| Modal | src/components/unified/PlayerSearch.tsx:417 | See owning component |
| Modal | src/components/modals/PositionPickerModal.tsx:65 | See owning component |
| Modal | src/components/AuctionSettings.tsx:97 | See owning component |
| Tooltip | src/screens/Auctioneer.tsx:335 | {tooltipLabel} |
| Tooltip | src/screens/Auctioneer.tsx:413 | {tooltipLabel} |
| Tooltip | src/screens/Auctioneer.tsx:548 | "Auction Settings" |
| Tooltip | src/screens/Auctioneer.tsx:557 | {!playersLoaded ? 'Load players first' : adpLoaded ? 'Reload ADP data' : 'Load ADP data'} |
| Tooltip | src/components/PlayerPool.tsx:284 | {onlyUndrafted ? 'Show all players' : 'Show undrafted only'} |
| DropdownMenu | src/screens_v2/DraftRoomV2.tsx:1281 | "draft-header-menu draft-controls-menu" |
| ModalLite | src/screens_v2/DraftRoomV2.tsx:1733 | "Force Nominate" |
| TeamRosterDrawer | src/screens_v2/DraftRoomV2.tsx:1775 | See owning component |
| div | src/screens_v2/DraftRoomV2.tsx:1842 | "team-detail-layer" |

## Live snapshots captured

| Route | Capture | Headings/state |
| --- | --- | --- |
| `/teams` | desktop-my-teams | My teams; 2 teams need a look; Extra ChroMahomes |
| `/leagues` | desktop-leagues | GameHQ owns league identity and permissions; G.O.A.T. League; League Pulse |
| `/stats` | desktop-stats | Stats Hub; 2026 projected leaders |
| `/auction-values` | desktop-auction-values | Fantasy Football Auction Values; Set the board; Comparison |
| `/analytics` | desktop-analytics | Analytics Lab |
| `/tools` | desktop-tools | Start with the problem.; Build before the pressure arrives; Build a Team |
| `/auction-values` | desktop-auction-values-settled | Fantasy Football Auction Values; Set the board; Comparison |
| `/league/1385319428408774656/history` | desktop-history | G.O.A.T. League; The all-time board; Every meeting matters |
| `/league/1385319428408774656/team` | desktop-team | Better call Hall; Starters; What needs your attention |
| `/league/1385319428408774656/matchup` | desktop-league-matchup | Loading both lineups… |
| `/league/1385319428408774656/players` | desktop-league-players | League Players; 2026 projected leaders |
| `/league/1385319428408774656/standings` | desktop-league-standings | G.O.A.T. League |
| `/league/1385319428408774656/teams` | desktop-league-teams | Every roster from the saved draft; Joel; Starters and depth |
| `/league/1385319428408774656/schedule` | desktop-league-schedule | Week 1 matchups |
| `/tools/team-rater` | audit-rater | 17 heading Rate My Team, Value: 1; 43 heading Enter roster positions, Value: 2, ID: team-rater-settings-title; 93 heading Search and sort players, Value: 2, ID: team-player-search-title |
| `/tools/player-compare` | audit-compare | 18 heading Player Compare, Value: 1; 33 heading Jahmyr Gibbs, Value: 2; 40 heading Bijan Robinson, Value: 2 |

Additional reviewed mobile screenshots are linked from README.md: My Teams identity-needed state, More popup, player Overview, and player News loading. Raw screenshots are not automatically passed or reviewed; several first navigations captured transitional frames.

## Acceptance still required

- Every current route family at desktop, narrow desktop/tablet, portrait mobile, and short landscape.
- All Stats views, Analytics modes, selected/custom tool states, source/print views and dropdown/search extremes.
- Live and native draft states with test data; history detail paths with actual IDs; manager/commissioner roles, rules, and invitation states.
- Dialog short/long content, empty/error/loading, keyboard open, close control visibility, top/bottom reachability, scrolling, outside/Escape/selection dismissal.
- One document scroller on ordinary pages, intentional overlay scrolling, usable tables, stable global Home, and preserved position-color computed fills/foregrounds.

No code, test suite, build, or production release was represented as completed by this audit.
