import { expect, test } from "@playwright/test";

const leagueId = "1385319428408774656";
test.beforeEach(async ({ page }) => {
  await page.addInitScript((id) => {
    localStorage.setItem("ffaa.sleeperLeagueConnections.v1", JSON.stringify([
      { leagueId: id, leagueName: "Navigation test league", season: "2026", status: "pre_draft", totalRosters: 12, lastUsedAt: "2026-09-05" },
    ]));
    localStorage.setItem("ffaa.activeSleeperLeague.v1", id);
  }, leagueId);
});

test("a connected manager can return Home and reload without losing the selected league", async ({ page }) => {
  await page.goto("./teams");
  await page.getByRole("link", { name: "Fantasy Football presented by GameHQ home" }).click();
  await expect(page.locator(".platform-home")).toBeVisible();
  await expect(page).toHaveURL(/\/ff\/$/);
  await page.reload();
  await expect(page.locator(".platform-home")).toBeVisible();
  await expect(page).toHaveURL(/\/ff\/$/);
  await expect(page.locator(".platform-hero-actions").getByRole("link", { name: "My Teams", exact: true })).toHaveAttribute("href", "/ff/teams");
  expect(await page.evaluate(() => localStorage.getItem("ffaa.activeSleeperLeague.v1"))).toBe(leagueId);
});

test("navigation menus fit the viewport and dismiss after choosing a destination", async ({ page, viewport }) => {
  await page.goto(`./league/${leagueId}/team`);
  const mobile = (viewport?.width ?? 1440) <= 760;
  const menu = page.locator(mobile ? ".mobile-more-menu" : ".product-menu").filter({ has: page.locator("summary").filter({ hasText: mobile ? "More" : "Research" }) });
  await menu.locator("summary").click();
  const panel = menu.locator(mobile ? ".mobile-more-panel" : ".product-menu-panel");
  const box = await panel.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
  await panel.getByRole("link", { name: "Rankings and stats", exact: mobile }).click();
  await expect(menu).not.toHaveAttribute("open");
  await expect(page).toHaveURL(/\/ff\/stats/);
  if (mobile) {
    const navigation = page.getByRole("navigation", { name: "Mobile navigation" });
    await expect(navigation.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("href", /\/ff\/?$/);
    await expect(navigation.getByRole("link", { name: "Research", exact: true })).toHaveClass("active");
  }
});

test("league menus stay between the header and bottom navigation on a short screen", async ({ page, viewport }) => {
  await page.setViewportSize({ width: viewport!.width, height: 390 });
  await page.goto(`./league/${leagueId}/team`);
  const menu = page.locator(".league-workspace-more");
  await menu.locator("summary").click();
  const fits = () => menu.locator("[data-viewport-menu]").evaluate((panel) => {
    const box = panel.getBoundingClientRect();
    const header = document.querySelector(".app-header")!.getBoundingClientRect();
    const mobile = document.querySelector(".product-mobile-nav")!;
    const bottom = mobile.getClientRects().length ? mobile.getBoundingClientRect().top : innerHeight;
    return box.left >= 0 && box.right <= innerWidth && box.top >= header.bottom && box.bottom <= bottom;
  });
  await expect.poll(fits).toBe(true);
  await page.setViewportSize({ width: viewport!.width, height: 480 });
  await expect.poll(fits).toBe(true);
  await menu.locator("a").last().scrollIntoViewIfNeeded();
  await expect(menu.locator("a").last()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).not.toHaveAttribute("open");
});
