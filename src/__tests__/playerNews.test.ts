// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { parsePlayerNewsFeed } from "@/data/playerNews";

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <item>
    <title>Josh Allen leads Buffalo into the postseason</title>
    <description>The quarterback discusses the next matchup.</description>
    <link>https://www.espn.com/nfl/story/_/id/one</link>
    <guid>one</guid>
    <pubDate>Thu, 03 Sep 2026 10:00:00 GMT</pubDate>
  </item>
  <item>
    <title>League notes from Thursday</title>
    <description>Allen Robinson was among the veterans mentioned.</description>
    <link>https://www.espn.com/nfl/story/_/id/two</link>
    <guid>two</guid>
  </item>
</channel></rss>`;

describe("player news feed", () => {
  it("keeps only stories that explicitly mention the requested player", () => {
    const items = parsePlayerNewsFeed(FEED, "Josh Allen");

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "one",
      title: "Josh Allen leads Buffalo into the postseason",
      source: "ESPN",
    });
  });

  it("rejects malformed XML instead of presenting unverified news", () => {
    expect(() => parsePlayerNewsFeed("<rss><item>", "Josh Allen")).toThrow(/invalid XML/i);
  });
});
