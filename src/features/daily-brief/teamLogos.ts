import type { BriefEdition } from "./model";

const nflTeams = new Set("ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LAC LAR LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WSH".split(" "));
const nflAliases: Record<string, string> = { WAS: "WSH", JAC: "JAX", LA: "LAR", OAK: "LV", SD: "LAC", STL: "LAR" };
export function teamLogoUrl(team: string, sport: BriefEdition["sport"]) {
  if (sport === "hockey") return /^[A-Z]{3}$/.test(team) ? `https://assets.nhle.com/logos/nhl/svg/${team}_light.svg` : null;
  const code = nflAliases[team] ?? team;
  return nflTeams.has(code) ? `https://a.espncdn.com/i/teamlogos/nfl/500/${code.toLowerCase()}.png` : null;
}
