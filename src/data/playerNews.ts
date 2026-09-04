import { appUrl } from "@/lib/appBasePath";

export type PlayerNewsItem = {
  id: string;
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  source: string;
};

type LoadPlayerNewsOptions = {
  playerName: string;
  signal?: AbortSignal;
};

const ESPN_NFL_NEWS_URL = appUrl("espn-nfl-news");

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function textOf(parent: ParentNode, selector: string) {
  return parent.querySelector(selector)?.textContent?.trim() ?? "";
}

function storyMentionsPlayer(title: string, description: string, playerName: string) {
  const haystack = normalize(`${title} ${description}`);
  const fullName = normalize(playerName);
  if (!fullName) return false;
  if (haystack.includes(fullName)) return true;

  const parts = fullName.split(" ").filter((part) => part.length > 1);
  if (parts.length < 2) return false;
  const first = parts[0]!;
  const last = parts[parts.length - 1]!;
  return haystack.includes(first) && haystack.includes(last);
}

export function parsePlayerNewsFeed(xml: string, playerName: string): PlayerNewsItem[] {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("The ESPN NFL news feed returned invalid XML.");

  return Array.from(document.querySelectorAll("item")).flatMap((item): PlayerNewsItem[] => {
    const title = textOf(item, "title");
    const description = textOf(item, "description");
    const url = textOf(item, "link");
    if (!title || !url || !storyMentionsPlayer(title, description, playerName)) return [];
    const publishedAt = textOf(item, "pubDate");
    const guid = textOf(item, "guid");
    return [{
      id: guid || url,
      title,
      description,
      url,
      publishedAt,
      source: "ESPN",
    }];
  }).slice(0, 8);
}

export async function loadPlayerNews({ playerName, signal }: LoadPlayerNewsOptions) {
  const response = await fetch(ESPN_NFL_NEWS_URL, signal ? { signal } : undefined);
  if (!response.ok) throw new Error(`ESPN NFL news returned ${response.status}`);
  return parsePlayerNewsFeed(await response.text(), playerName);
}

export function playerNewsSearchUrl(playerName: string) {
  return `https://www.espn.com/search/_/q/${encodeURIComponent(playerName)}`;
}
