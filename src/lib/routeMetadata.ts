import { useEffect } from "react";

const SITE_ORIGIN = "https://gamehqhub.com";
const SITE_NAME = "Fantasy Football presented by GameHQ";
const DEFAULT_IMAGE = `${SITE_ORIGIN}/ff/images/football-night-hero.png`;

export type RouteMetadataInput = {
  title: string;
  description: string;
  path: string;
  indexable?: boolean;
  image?: string;
};

function setMeta(selector: string, attributes: Record<string, string>, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function setCanonical(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    document.head.appendChild(element);
  }
  element.href = href;
}

export function applyRouteMetadata({ title, description, path, indexable = true, image = DEFAULT_IMAGE }: RouteMetadataInput) {
  const canonical = `${SITE_ORIGIN}/ff${path === "/" ? "/" : path}`;
  const fullTitle = title.includes("GameHQ") ? title : `${title} | GameHQ Fantasy Football`;
  document.title = fullTitle;
  setCanonical(canonical);
  setMeta('meta[name="description"]', { name: "description" }, description);
  setMeta('meta[name="robots"]', { name: "robots" }, indexable ? "index, follow" : "noindex, nofollow");
  setMeta('meta[property="og:type"]', { property: "og:type" }, "website");
  setMeta('meta[property="og:site_name"]', { property: "og:site_name" }, SITE_NAME);
  setMeta('meta[property="og:title"]', { property: "og:title" }, fullTitle);
  setMeta('meta[property="og:description"]', { property: "og:description" }, description);
  setMeta('meta[property="og:url"]', { property: "og:url" }, canonical);
  setMeta('meta[property="og:image"]', { property: "og:image" }, image);
  setMeta('meta[name="twitter:card"]', { name: "twitter:card" }, "summary_large_image");
  setMeta('meta[name="twitter:title"]', { name: "twitter:title" }, fullTitle);
  setMeta('meta[name="twitter:description"]', { name: "twitter:description" }, description);
  setMeta('meta[name="twitter:image"]', { name: "twitter:image" }, image);
}

export function metadataForPath(pathname: string): RouteMetadataInput {
  if (pathname === "/") return { title: "Fantasy Football presented by GameHQ", description: "Run your fantasy draft, make smarter weekly decisions, and preserve every season of league history.", path: "/" };
  if (pathname === "/stats") return { title: "Player Research", description: "Research fantasy football rankings, projections, market values, player profiles, and transparent source data.", path: pathname };
  if (pathname.startsWith("/auction-values")) return { title: "Fantasy Football Auction Values", description: "Compare and print public fantasy-football salary-cap values, market AAV, and cheat sheets across Standard, Half PPR, and Full PPR formats.", path: pathname };
  if (pathname === "/analytics") return { title: "Fantasy Analytics", description: "Explore fantasy football scoring, position, projection, market, and historical performance relationships.", path: pathname };
  if (pathname.startsWith("/tools/player-compare")) return { title: "Player Compare", description: "Compare up to four fantasy players across projections, usage, consistency, ADP, and auction values.", path: pathname };
  if (pathname.startsWith("/tools/auction-builder")) return { title: "Auction Team Builder", description: "Build a legal fantasy auction roster against current public values and connected league settings.", path: pathname };
  if (pathname.startsWith("/tools/team-rater")) return { title: "Rate My Team", description: "Audit fantasy starters, depth, replacement value, bye collisions, and roster availability.", path: pathname };
  if (pathname.startsWith("/tools/schedule")) return { title: "Fantasy Schedule Lab", description: "Explore NFL opponents by fantasy position, week range, playoff window, and matchup environment.", path: pathname };
  if (pathname.startsWith("/tools/offensive-line")) return { title: "Offensive Line Environment", description: "Compare transparent team pass and run environments for fantasy football research.", path: pathname };
  if (pathname.startsWith("/tools")) return { title: "Fantasy Decision Tools", description: "Prepare for drafts, resolve weekly decisions, and understand the league with explainable public-data tools.", path: pathname };
  if (pathname === "/teams") return { title: "My Teams", description: "Open every connected fantasy team and return to its current matchup, roster, and league.", path: pathname, indexable: false };
  if (pathname === "/leagues" || pathname === "/league") return { title: "League Connections", description: "Connect Sleeper leagues, import completed seasons, and manage the settings behind GameHQ league tools.", path: pathname, indexable: false };
  if (pathname.startsWith("/league/teams")) return { title: "League Teams", description: "Review every saved fantasy roster, draft price, projected starter, and team baseline for the active league.", path: pathname, indexable: false };
  if (pathname.startsWith("/league/lineup")) return { title: "Weekly Lineup", description: "Set and save legal weekly fantasy starters for a commissioner-approved league team.", path: pathname, indexable: false };
  if (pathname.startsWith("/league/matchups")) return { title: "League Matchups", description: "Compare weekly fantasy matchups with scoring-aware projected lineups from the active league's saved draft.", path: pathname, indexable: false };
  if (/^\/league\/[^/]+\/history(?:\/|$)/.test(pathname)) return { title: "League History", description: "Explore normalized fantasy league managers, matchups, championships, records, seasons, drafts, and transactions.", path: pathname };
  if (/^\/league\/[^/]+\/rules(?:\/|$)/.test(pathname)) return { title: "League Constitution", description: "Read the active league's published roster, scoring, schedule, transaction, and lineup rules.", path: pathname, indexable: false };
  if (/^\/league\/[^/]+\/join(?:\/|$)/.test(pathname)) return { title: "Accept League Invitation", description: "Accept a secure manager or co-commissioner invitation for a native GameHQ fantasy league.", path: pathname, indexable: false };
  if (/^\/league\/[^/]+\/commissioner\/teams(?:\/|$)/.test(pathname)) return { title: "Commissioner Teams and Roles", description: "Invite managers, assign native team ownership, and review commissioner access.", path: pathname, indexable: false };
  if (/^\/league\/[^/]+\/commissioner\/audit(?:\/|$)/.test(pathname)) return { title: "Commissioner Audit", description: "Review immutable native league commands and roster transaction receipts.", path: pathname, indexable: false };
  if (/^\/league\/[^/]+$/.test(pathname)) return { title: "League Home", description: "Open the active GameHQ league, authority state, season status, team context, and operational destinations.", path: pathname, indexable: false };
  if (/^\/league\/[^/]+\/team\/roster(?:\/|$)/.test(pathname)) return { title: "Weekly Lineup", description: "Set and save legal weekly fantasy starters for the active manager team.", path: pathname, indexable: false };
  if (/^\/league\/[^/]+\/team\/matchup(?:\/|$)/.test(pathname)) return { title: "My Matchup", description: "Review the active fantasy team's opponent, lineup state, and weekly matchup baseline.", path: pathname, indexable: false };
  if (/^\/league\/[^/]+\/matchup(?:\/|$)/.test(pathname)) return { title: "My Matchup", description: "Review the active fantasy team's opponent, lineup state, and weekly matchup baseline.", path: pathname, indexable: false };
  if (/^\/league\/[^/]+\/team(?:\/|$)/.test(pathname)) return { title: "My Team", description: "The active manager team's roster, matchup, decisions, and league activity.", path: pathname, indexable: false };
  if (/^\/league\/[^/]+\/players(?:\/|$)/.test(pathname)) return { title: "League Players", description: "Research fantasy players in the context of the active connected league.", path: pathname, indexable: false };
  if (/^\/league\/[^/]+\/(?:standings|teams|matchups|schedule|transactions|manage|commissioner)(?:\/|$)/.test(pathname)) return { title: "League Workspace", description: "Review teams, standings, matchups, transactions, and settings for the active fantasy league.", path: pathname, indexable: false };
  if (pathname.startsWith("/league/")) return { title: "League Workspace", description: "Open a connected fantasy team and league workspace.", path: pathname, indexable: false };
  if (pathname === "/my-hq") return { title: "This Week", description: "A personalized fantasy lineup, matchup, roster-health, and league-activity command center.", path: pathname, indexable: false };
  if (pathname === "/offline-draft") return { title: "Offline Draft", description: "Run a fantasy draft locally and mirror it live across laptops connected to the same league.", path: pathname, indexable: false };
  if (pathname === "/draft-order") return { title: "Draft Order Showdown", description: "Create a fantasy draft or nomination order through one of three football-themed games.", path: pathname };
  if (pathname.startsWith("/results/")) return { title: "Draft Results", description: "Review the completed GameHQ fantasy draft board and team results.", path: pathname, indexable: false };
  if (pathname.startsWith("/draft/")) return { title: "Live Draft Room", description: "Private GameHQ fantasy draft room.", path: pathname, indexable: false };
  if (pathname.startsWith("/host")) return { title: "Host a Draft", description: "Configure and host a private GameHQ fantasy draft room.", path: pathname, indexable: false };
  if (pathname.startsWith("/join")) return { title: "Join a Draft", description: "Join a private GameHQ fantasy draft room with a room code.", path: pathname, indexable: false };
  return { title: SITE_NAME, description: "Run the draft, win the week, and preserve fantasy league history with GameHQ.", path: pathname, indexable: false };
}

export function useRouteMetadata(input: RouteMetadataInput) {
  const { title, description, path, indexable = true, image = DEFAULT_IMAGE } = input;

  useEffect(() => {
    applyRouteMetadata({ title, description, path, indexable, image });
  }, [title, description, path, indexable, image]);
}
