import { expect, test } from "@playwright/test";

const legacyLeagueId = "1385319428408774656";
const unavailableNativeLeagueId = "11111111-1111-4111-8111-111111111111";

test("manager workflow keeps the league route, authority, and primary actions usable", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto(`./league/${legacyLeagueId}`);
  const navigation = page.getByRole("navigation", { name: "Active team and league" });
  await expect(navigation).toBeVisible({ timeout: 75_000 });
  await expect(navigation.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("href", `/ff/league/${legacyLeagueId}`);
  await expect(navigation.getByRole("link", { name: "Matchup", exact: true })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Team", exact: true })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Players", exact: true })).toBeVisible();
  await expect(page.getByText("Connected Sleeper League — read-only")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});

test("commissioner workflow rejects an unavailable native league without exposing controls", async ({ page }) => {
  await page.goto(`./league/${unavailableNativeLeagueId}/commissioner`);
  await expect(page.getByRole("heading", { name: "League management is not available" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: /publish|archive|award|renew/iu })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Return to team" })).toHaveAttribute("href", `/ff/league/${unavailableNativeLeagueId}/team`);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});
