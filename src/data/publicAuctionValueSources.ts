import { VALUE_SOURCE_WEIGHTS } from "../config/valueSourceWeights";

type PublicAuctionScoring = "standard" | "halfPpr" | "ppr";

export type PublicAuctionSourceAccess =
  | "full-board"
  | "public-preview"
  | "public-dynamic"
  | "custom-generator"
  | "derived-workbook"
  | "subscription-limited";

export type PublicAuctionValueSource = {
  id: string;
  label: string;
  shortLabel: string;
  url: string;
  access: PublicAuctionSourceAccess;
  note: string;
  weight: number;
  budget?: number;
  scoring?: PublicAuctionScoring;
  includedInConsensus: boolean;
};

// Public means the cited page or download can be reached without an account.
// It does not imply that every row is machine-readable or safe to republish.
export const PUBLIC_AUCTION_VALUE_SOURCES: readonly PublicAuctionValueSource[] = [
  {
    id: "espn",
    label: "ESPN salary-cap values",
    shortLabel: "ESPN",
    url: "https://g.espncdn.com/s/ffldraftkit/26/NFL26_CS_PPR300.pdf?adddata=2026CS_PPR300",
    access: "full-board",
    note: "Official 2026 PPR 300 PDF; 10-team, $200 salary cap.",
    weight: VALUE_SOURCE_WEIGHTS.espnSalaryCap,
    budget: 200,
    scoring: "ppr",
    includedInConsensus: true,
  },
  {
    id: "fftoday",
    label: "FFToday auction values",
    shortLabel: "FFToday",
    url: "https://www.fftoday.com/rankings/26-av-ppr.html",
    access: "full-board",
    note: "Complete public $200 boards for PPR, half-PPR, and standard scoring.",
    weight: VALUE_SOURCE_WEIGHTS.ffTodayAuction,
    budget: 200,
    includedInConsensus: true,
  },
  {
    id: "sports-illustrated",
    label: "Sports Illustrated auction values",
    shortLabel: "SI",
    url: "https://www.si.com/fantasy/2026-football-rankings-player-profiles-projections",
    access: "full-board",
    note: "Public 2026 position tables with auction dollars.",
    weight: VALUE_SOURCE_WEIGHTS.sportsIllustratedAuction,
    budget: 200,
    scoring: "ppr",
    includedInConsensus: true,
  },
  {
    id: "rtsports-aav",
    label: "RT Sports actual auction AAV",
    shortLabel: "RT AAV",
    url: "https://www.freedraftguide.com/football/draft-guide-average-pdf.php?AAV=YES",
    access: "full-board",
    note: "Average winning bids from completed public RT Sports auctions; mixed league settings.",
    weight: VALUE_SOURCE_WEIGHTS.rtSportsActualAav,
    budget: 200,
    includedInConsensus: true,
  },
  {
    id: "yafsb-aav",
    label: "YAFSB Sleeper auction AAV",
    shortLabel: "YAFSB",
    url: "https://yafsb.com/fantasy-football/auction-draft-values/?scoring_type=half_ppr&league_size=12&is_superflex=False&is_dynasty=False&is_rookies=False",
    access: "public-dynamic",
    note: "Actual 12-team half-PPR, 1-QB redraft prices from public Sleeper auction drafts; the PPR combination currently has no sample.",
    weight: VALUE_SOURCE_WEIGHTS.yafsbActualAav,
    budget: 200,
    scoring: "halfPpr",
    includedInConsensus: true,
  },
  {
    id: "yahoo",
    label: "Yahoo salary-cap draft analysis",
    shortLabel: "Yahoo",
    url: "https://football.fantasysports.yahoo.com/f1/draftanalysis?type=salcap",
    access: "public-dynamic",
    note: "Public page is reachable, but its current player rows are rendered client-side.",
    weight: VALUE_SOURCE_WEIGHTS.yahooImport,
    budget: 200,
    includedInConsensus: true,
  },
  {
    id: "fantasypros",
    label: "FantasyPros auction calculator",
    shortLabel: "FPros",
    url: "https://www.fantasypros.com/nfl/auction-values/calculator.php",
    access: "public-dynamic",
    note: "Public calculator; values depend on interactive league settings.",
    weight: VALUE_SOURCE_WEIGHTS.fantasyProsImport,
    budget: 200,
    scoring: "ppr",
    includedInConsensus: true,
  },
  {
    id: "fantasy-life",
    label: "Fantasy Life auction values",
    shortLabel: "FLife",
    url: "https://www.fantasylife.com/fantasy-football-auction-values",
    access: "public-dynamic",
    note: "Public paginated app; server metadata still identifies the board as 2025, so it is not blended into 2026 values.",
    weight: 0,
    includedInConsensus: false,
  },
  {
    id: "elboberto",
    label: "ElBoberto auction generator",
    shortLabel: "Boberto",
    url: "https://www.reddit.com/r/fantasyfootball/comments/1uttmpp/elbobertos_custom_auction_value_generator_2026/",
    access: "derived-workbook",
    note: "Free customizable workbook derived from FantasyPros consensus projections; cataloged to avoid double counting.",
    weight: 0,
    includedInConsensus: false,
  },
  {
    id: "sportsbrackets",
    label: "SportsBrackets consensus board",
    shortLabel: "SBrkt",
    url: "https://sportsbrackets.net/2026/07/24/2026-fantasy-football-auction-values-printable/",
    access: "full-board",
    note: "Free 12-team, $200 PPR printable informed by the consensus pool; display-only to avoid correlated weighting.",
    weight: VALUE_SOURCE_WEIGHTS.sportsBracketsDisplayOnly,
    budget: 200,
    scoring: "ppr",
    includedInConsensus: false,
  },
  {
    id: "always-auctions",
    label: "Always Auctions mock AAV",
    shortLabel: "Always",
    url: "https://www.reddit.com/r/fantasyfootball/comments/1vawv4l/ff_auction_ama/",
    access: "public-dynamic",
    note: "Public manually entered mock-auction dashboard; useful market evidence, but no stable machine-readable export.",
    weight: 0,
    includedInConsensus: false,
  },
  {
    id: "iron-tuna",
    label: "Iron Tuna custom auction values",
    shortLabel: "IronTuna",
    url: "https://irontuna.com/fantasy-football-auction-values",
    access: "custom-generator",
    note: "Free no-login custom generator; no single canonical board exists to import.",
    weight: 0,
    includedInConsensus: false,
  },
  {
    id: "draftsharks",
    label: "Draft Sharks auction values",
    shortLabel: "DSharks",
    url: "https://www.draftsharks.com/auction-values",
    access: "public-preview",
    note: "Only the public top 25 is imported; no subscriber rows are requested.",
    weight: VALUE_SOURCE_WEIGHTS.draftSharksPublicPreview,
    budget: 200,
    scoring: "ppr",
    includedInConsensus: true,
  },
  {
    id: "footballguys",
    label: "Footballguys salary-cap values",
    shortLabel: "FBGuys",
    url: "https://www.footballguys.com/salary-cap-auction-values?pos=all",
    access: "public-preview",
    note: "Only rows present in the unauthenticated public table are imported.",
    weight: VALUE_SOURCE_WEIGHTS.footballguysPublicPreview,
    budget: 200,
    scoring: "ppr",
    includedInConsensus: true,
  },
  {
    id: "fantasynerds",
    label: "FantasyNerds public auction values",
    shortLabel: "FNerds",
    url: "https://www.fantasynerds.com/nfl/auction?teams=12&budget=200&format=ppr",
    access: "public-preview",
    note: "Only the public top 10 is imported; the subscriber-only remainder is not requested.",
    weight: VALUE_SOURCE_WEIGHTS.fantasyNerdsPublicPreview,
    budget: 200,
    scoring: "ppr",
    includedInConsensus: true,
  },
  {
    id: "rotowire",
    label: "RotoWire auction customizer",
    shortLabel: "RWire",
    url: "https://www.rotowire.com/football/auction-values.php",
    access: "subscription-limited",
    note: "Public methodology page is monitored; subscriber-only table rows are not scraped.",
    weight: 0,
    includedInConsensus: false,
  },
  {
    id: "fftoolbox",
    label: "FullTime Fantasy / FFToolbox values",
    shortLabel: "FFTool",
    url: "https://fftoolbox.fulltimefantasy.com/football/auction-values.cfm",
    access: "public-dynamic",
    note: "Public surface is cataloged; no reliable current 2026 rows were exposed to the importer.",
    weight: VALUE_SOURCE_WEIGHTS.ffToolboxAuction,
    budget: 200,
    includedInConsensus: true,
  },
  {
    id: "csg",
    label: "CSG auction workbook",
    shortLabel: "CSG",
    url: "https://www.reddit.com/r/fantasyfootball/comments/1vi45bv/csg_fantasy_football_spreadsheets_v140_2026/",
    access: "derived-workbook",
    note: "Free workbook combines ESPN, Yahoo, NFL, and ElBoberto inputs; cataloged but excluded as a duplicate aggregate.",
    weight: 0,
    includedInConsensus: false,
  },
  {
    id: "fantasy-football-helper",
    label: "Fantasy Football Helper Auction Value Edge",
    shortLabel: "FFHelp",
    url: "https://fantasyfootballhelper.com/auction-values/",
    access: "subscription-limited",
    note: "Public description is cataloged; the full comparison tool requires access and is not scraped.",
    weight: 0,
    includedInConsensus: false,
  },
  {
    id: "fantasy-on-draft",
    label: "Fantasy on Draft auction demo",
    shortLabel: "FoDraft",
    url: "https://fantasyondraft.com/",
    access: "public-preview",
    note: "Demo values rely on commercial FantasyData inputs; they are not republished or independently weighted.",
    weight: 0,
    includedInConsensus: false,
  },
  {
    id: "draftstrategy",
    label: "DraftStrategy auction values",
    shortLabel: "DStrategy",
    url: "https://draftstrategy.com/fantasy-football-auction-values/",
    access: "public-dynamic",
    note: "Public calculator is cataloged; its current static response contains no player rows.",
    weight: 0,
    includedInConsensus: false,
  },
  {
    id: "draftexpert-pro",
    label: "DraftExpert Pro auction demo",
    shortLabel: "DExpert",
    url: "https://www.draftexpertpro.com/fantasy-football-auction-values",
    access: "public-preview",
    note: "The public examples are illustrative rather than a complete current board.",
    weight: 0,
    includedInConsensus: false,
  },
] as const;

export const PUBLIC_AUCTION_SOURCE_BY_ID = new Map(
  PUBLIC_AUCTION_VALUE_SOURCES.map((source) => [source.id, source]),
);
