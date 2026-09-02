import { expect, test } from "@playwright/test";

test("shared header renders the approved football mark", async ({ page }) => {
  await page.goto("./");
  await page.waitForLoadState("networkidle");

  const brandLink = page.getByRole("link", { name: "Fantasy Football presented by GameHQ home" });
  const brandImage = brandLink.locator("img");

  await expect(brandLink).toBeVisible();
  await expect(brandImage).toBeVisible();
  await expect(brandImage).toHaveAttribute("src", /\/images\/football-header-mark\.jpg$/);
  await expect(page.locator(".app-brand-monogram")).toHaveCount(0);
  await expect.poll(() => brandImage.evaluate((image) => {
    const htmlImage = image as HTMLImageElement;
    return htmlImage.complete && htmlImage.naturalWidth > 0;
  })).toBe(true);
  await expect(brandImage).toHaveScreenshot("football-header-mark.png", { animations: "disabled" });
});
