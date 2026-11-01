import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const bundle = JSON.parse(readFileSync(new URL('../public/data/nflverse-player-careers.json', import.meta.url), 'utf8'));
const seasons = bundle.players['00-0039338'].s as (string | number | null)[][];
const current = seasons.find((row) => row[0] === 2026)!;
const games = Number(current[3]);
const ppg = (Number(current[5]) / games).toFixed(1);
const careerGames = seasons.reduce((total, row) => total + Number(row[3]), 0);
const careerPpg = (seasons.reduce((total, row) => total + Number(row[5]), 0) / careerGames).toFixed(1);

test('shared profile loads current-season Overview, Game log, Career, and source context', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./tools/player-compare?players=2026-TE-brock-bowers');
  const trigger = page.getByRole('button', { name: 'Brock Bowers', exact: true }).first();
  await trigger.click();
  const dialog = page.getByRole('dialog');
  const metric = (label: string) => dialog.locator('.stats-drawer-metric').filter({ has: page.locator('span').filter({ hasText: new RegExp(`^${label}$`) }) });
  await expect(metric('Season PPG').locator('strong')).toHaveText(ppg);
  await expect(metric('Season PPG').locator('small')).toContainText(`2026 · ${games} games`);
  await expect(metric('Career PPG').locator('strong')).toHaveText(careerPpg);
  await expect(metric('Last 3').locator('strong')).not.toHaveText('—');
  await expect(metric('Floor / ceiling').locator('strong')).not.toHaveText('—');
  await expect(metric('ADP').locator('strong')).not.toHaveText('—');
  await expect(metric('ADP').locator('small')).toContainText('Sleeper PPR · 2026');
  await expect(metric('Position rank').locator('strong')).toHaveText('TE2');
  await expect(metric('Targets/G').locator('strong')).not.toHaveText('—');
  await expect(metric('Carries/G').locator('strong')).toHaveText('0.0');
  await expect(metric('Target share').locator('strong')).not.toHaveText('—');
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('bowers-overview.png'), fullPage: true });
  await dialog.getByRole('tab', { name: 'Game log', exact: true }).click();
  await expect(dialog.locator('.stats-drawer-table tbody tr')).toHaveCount(games);
  await expect(dialog.getByRole('button', { name: 'Game log season: 2026', exact: true })).toBeVisible();
  await dialog.getByRole('tab', { name: 'Career', exact: true }).click();
  await expect(dialog.locator('.stats-career-table tbody tr')).toHaveCount(seasons.length);
  await expect(dialog.locator('.stats-career-coverage')).toContainText('1999–2026');
  await dialog.getByRole('tab', { name: 'Sources', exact: true }).click();
  await expect(dialog.getByText('Sleeper draft ADP', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Updated 2026-08-27', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(errors).toEqual([]);
});

test('season-source failures are visible and retry recovers Overview', async ({ page }) => {
  await page.route('**/stats_player_week_2026.csv*', (route) => route.fulfill({ status: 503, body: 'Temporarily unavailable' }));
  await page.goto('./tools/player-compare?players=2026-TE-brock-bowers');
  await page.getByRole('button', { name: 'Brock Bowers', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('alert')).toContainText('Season stats are temporarily unavailable');
  await page.unroute('**/stats_player_week_2026.csv*');
  await dialog.getByRole('button', { name: 'Try again', exact: true }).click();
  const ppgMetric = dialog.locator('.stats-drawer-metric').filter({ hasText: 'Season PPG' });
  await expect(ppgMetric.locator('strong')).toHaveText(ppg);
  await expect(dialog.getByRole('alert')).toHaveCount(0);
});
