import { rostershipSchema, type BriefEdition, type BriefPlatform, type RostershipSnapshot } from "../../src/features/daily-brief/model.js";
import { csvRecords, type SourceReader } from "./fetchSource.js";

type Row = Record<string, unknown>;
const object = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const nameKey = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").replace(/[.'’_-]/gu, "").trim().replace(/\s+/g, " ").toLowerCase();
const position = (value: string) => ({ L: "LW", R: "RW" }[value] ?? value);
const teamKey = (value: string) => ({ TB: "TBL", LA: "LAK", SJ: "SJS", NJ: "NJD", MON: "MTL", UTAH: "UTA" }[value] ?? value);
function percentage(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}
const idsUrl = "https://raw.githubusercontent.com/dynastyprocess/data/master/files/db_playerids.csv";
export function rosterSeason(edition: BriefEdition) {
  const year = Number(edition.date.slice(0, 4)), month = Number(edition.date.slice(5, 7));
  return String(edition.sport === "hockey" ? month >= 7 ? year + 1 : year : month < 3 ? year - 1 : year);
}
export function mapFootballEspnIds(text: string) {
  const values = new Map<string, Set<string>>();
  for (const row of csvRecords(text)) {
    if (!/^00-\d+$/.test(row.gsis_id ?? "") || !/^\d+$/.test(row.espn_id ?? "")) continue;
    const found = values.get(row.gsis_id!) ?? new Set<string>(); found.add(row.espn_id!); values.set(row.gsis_id!, found);
  }
  const reverse = new Map<string, number>();
  for (const found of values.values()) for (const id of found) reverse.set(id, (reverse.get(id) ?? 0) + 1);
  return new Map([...values].flatMap(([id, found]) => found.size === 1 && reverse.get([...found][0]!) === 1 ? [[id, [...found][0]!]] : []));
}
export function joinEspnPercentages(edition: BriefEdition, payload: unknown, teams: Map<string, string>, footballIds: Map<string, string>) {
  if (!Array.isArray(payload) || !payload.length) throw new Error("Invalid ESPN player pool");
  const rows = payload.map(object), positions = new Map(edition.sport === "hockey" ? [[1, "C"], [2, "LW"], [3, "RW"], [4, "D"], [5, "G"]] : [[1, "QB"], [2, "RB"], [3, "WR"], [4, "TE"]]);
  const byId = new Map<string, Row[]>(), byIdentity = new Map<string, Row[]>();
  for (const row of rows) {
    const id = String(row.id ?? ""), key = [nameKey(String(row.fullName ?? "")), teamKey(teams.get(String(row.proTeamId)) ?? ""), positions.get(Number(row.defaultPositionId)) ?? ""].join(":");
    byId.set(id, [...(byId.get(id) ?? []), row]); byIdentity.set(key, [...(byIdentity.get(key) ?? []), row]);
  }
  const latest = new Map<string, BriefEdition["observations"][number]>();
  for (const row of edition.observations) if (!latest.has(row.id) || latest.get(row.id)!.date < row.date) latest.set(row.id, row);
  const localKeys = new Map<string, number>();
  for (const row of latest.values()) {
    const key = [nameKey(row.name), teamKey(row.team), position(row.position)].join(":"); localKeys.set(key, (localKeys.get(key) ?? 0) + 1);
  }
  const entries: RostershipSnapshot["entries"] = [];
  for (const row of latest.values()) {
    const key = [nameKey(row.name), teamKey(row.team), position(row.position)].join(":");
    const candidates = edition.sport === "football" ? byId.get(footballIds.get(row.id) ?? "") : localKeys.get(key) === 1 ? byIdentity.get(key) : undefined;
    if (candidates?.length !== 1) continue;
    const found = candidates[0]!, percent = percentage(object(found.ownership).percentOwned);
    if (percent === null) continue;
    entries.push({ id: row.id, providerId: String(found.id), percent, match: edition.sport === "football" ? "provider-id" : "exact-name-team-position" });
  }
  return entries;
}
function unsupported(edition: BriefEdition, platform: BriefPlatform): RostershipSnapshot {
  const note = platform === "yahoo" ? "Yahoo percentage ingestion needs an authorized provider connection; a shared public feed is not configured."
    : platform === "cbs" ? "CBS automated percentage access has not been verified."
    : "Sleeper hockey percentage coverage is not supported.";
  return { platform, season: rosterSeason(edition), status: "unavailable", fetchedAt: null, entries: [], note,
    sourceUrl: platform === "yahoo" ? "https://sports.yahoo.com/developer/docs/" : platform === "cbs" ? `https://www.cbssports.com/fantasy/${edition.sport}/` : "https://docs.sleeper.com/" };
}
/** Global provider snapshots only. This does not read a manager's account or mutate league ownership. */
export async function enrichRostership(edition: BriefEdition, read: SourceReader, previous?: BriefEdition | null): Promise<BriefEdition> {
  const season = rosterSeason(edition), unique = new Map(edition.observations.map(row => [row.id, row]));
  async function source(platform: "espn" | "sleeper"): Promise<RostershipSnapshot> {
    const sourceUrl = platform === "espn" ? `https://lm-api-reads.fantasy.espn.com/apis/v3/games/${edition.sport === "hockey" ? "fhl" : "ffl"}/seasons/${season}/players?view=players_wl` : `https://api.sleeper.com/players/nfl/research/regular/${season}`;
    try {
      if (!unique.size) throw new Error("No player observations to join");
      let entries: RostershipSnapshot["entries"];
      if (platform === "sleeper") {
        const data = object(JSON.parse((await read(sourceUrl)).text));
        if (!Object.keys(data).length) throw new Error("Empty Sleeper ownership response");
        entries = [...unique.values()].flatMap(row => {
          const percent = percentage(object(data[row.providerId ?? ""]).owned);
          return percent === null || !row.providerId ? [] : [{ id: row.id, providerId: row.providerId, percent, match: "provider-id" as const }];
        });
      } else {
        const payload = read(sourceUrl, 8_000_000, { "X-Fantasy-Filter": JSON.stringify({ players: { limit: 20000 } }) });
        const metadata = edition.sport === "hockey" ? read("https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams?limit=50") : read(idsUrl);
        const [players, mappings] = await Promise.all([payload, metadata]);
        const data = JSON.parse(players.text);
        const teams = new Map<string, string>();
        if (edition.sport === "hockey") {
          const root = object(JSON.parse(mappings.text));
          for (const sport of list(root.sports)) for (const league of list(object(sport).leagues)) for (const value of list(object(league).teams)) {
            const team = object(object(value).team); if (team.id && team.abbreviation) teams.set(String(team.id), String(team.abbreviation));
          }
          if (teams.size < 32) throw new Error("Incomplete NHL team mapping");
        }
        entries = joinEspnPercentages(edition, data, teams, edition.sport === "football" ? mapFootballEspnIds(mappings.text) : new Map());
      }
      if (!entries.length) throw new Error("No verified percentage joins");
      return rostershipSchema.parse({ platform, season, status: "ready", fetchedAt: edition.generatedAt, sourceUrl, entries,
        note: `${entries.length} of ${unique.size} observed players matched. Best-effort public endpoint; retrieved time is not the provider's update time.` + (platform === "espn" && edition.sport === "hockey" ? " Hockey uses unique exact name, team and primary-position matches for discovery only." : platform === "sleeper" ? " Undocumented research endpoint; ownership is distinct from trending add counts. Sleeper documents free noncommercial API use." : "") });
    } catch {
      const saved = previous?.rostership?.find(row => row.platform === platform && row.season === season && row.entries.length);
      return saved ? { ...saved, status: "stale", note: saved.status === "stale" ? saved.note : "Refresh failed. Showing the last verified snapshot with its original retrieval time. " + saved.note }
        : { platform, season, status: "unavailable", fetchedAt: null, sourceUrl, entries: [], note: "Roster percentages could not be retrieved or safely matched. Game performances remain available." };
    }
  }
  const snapshots = await Promise.all([source("espn"), edition.sport === "football" ? source("sleeper") : Promise.resolve(unsupported(edition, "sleeper"))]);
  return { ...edition, rostership: [...snapshots, unsupported(edition, "yahoo"), unsupported(edition, "cbs")] };
}
