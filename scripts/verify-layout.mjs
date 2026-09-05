// Local, isolated rendering checks. Fixtures never write to an external service.
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const base = process.env.LAYOUT_BASE_URL || 'http://127.0.0.1:5278/ff/';
if (!['localhost','127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Layout fixtures require a local server.');
const out = path.resolve('reports/layout-20260905');
await fs.mkdir(out, { recursive: true });
const connections = ['1385319428408774656','1385319428408774657'].map((leagueId,i) => ({
  leagueId, leagueName: i ? 'Layout Test League B' : 'Layout Test League A', season:'2026', status:'in_season', totalRosters:12,
  sourceUrl:`https://sleeper.com/leagues/${leagueId}`, lastUsedAt:'2026-09-05T00:00:00Z', managerProviderUserId:'layout-manager',
  managerDisplayName:'Layout manager', managerTeamName:i ? 'Sunday Lineup' : 'First and Goal', managerRecord:'0-0', managerStanding:i+1,
}));
// Reuse the existing deterministic history test data, rather than live imports.
const historyTest = await fs.readFile('src/__tests__/leagueHistory.test.ts','utf8');
const historyConstant = historyTest.slice(historyTest.indexOf('const snapshot:'),historyTest.indexOf('\nfunction sleeperSeason'));
const compiled = ts.transpileModule(historyConstant, {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const snapshot = new Function(`${compiled}; return snapshot;`)();
snapshot.league.name = 'Layout Test League A';
snapshot.league.currentExternalLeagueId = connections[0].leagueId;
const browser = await chromium.launch();
const report = [];
const cases = process.env.LAYOUT_EXTENDED ? [
  ...['draft','auction','opportunity','trends','matchups','teams'].map(view=>[`stats-${view}`,`stats?view=${view}`,'.stats-hub-table']),
  ['auction-print','auction-values/print','.auction-comparison-workspace'],
  ...['week','managers','h2h','archive','champions','records','seasons','leaderboards','drafts','payouts','transactions','trades','waivers'].map(route=>[`history-${route}`,`league/${connections[0].leagueId}/history/${route}`,'.history-shell']),
  ['history-manager',`league/${connections[0].leagueId}/history/managers/${snapshot.managers[0].id}`,'.history-shell'],
  ['history-season',`league/${connections[0].leagueId}/history/seasons/${snapshot.seasons[0].season}`,'.history-shell'],
] : [
  ['home','', '.platform-home'], ['teams','teams','.my-teams-list'],
  ['stats','stats','.stats-hub-table'], ['auction','auction-values','.auction-comparison-workspace'],
  ['analytics','analytics','.analytics-lab'], ['tools','tools','.tools-hub'],
  ['compare','tools/player-compare','.tools-page'], ['team-rater','tools/team-rater','.tools-page'],
  ['builder','tools/auction-builder','.tools-page'], ['schedule','tools/schedule','.tools-page'],
  ['offensive-line','tools/offensive-line','.tools-page'], ['draft-order','draft-order','.draft-order-hero'],
  ['connections','leagues','.league-hero'],
  ['league-home',`league/${connections[0].leagueId}`,'.league-workspace-context'],
  ['league-team',`league/${connections[0].leagueId}/team`,'.hq-team-bar'],
  ['league-matchup',`league/${connections[0].leagueId}/matchup`,'.league-head-to-head'],
  ['league-players',`league/${connections[0].leagueId}/players`,'.stats-hub-table'],
  ['history',`league/${connections[0].leagueId}/history`,'.history-scoreboard'],
];
for (const viewport of (process.env.LAYOUT_WIDTHS || '1440,390').split(',').map(Number).map(width=>({width,height:Number(process.env.LAYOUT_HEIGHT)||(width===390?844:900)}))) {
 const context = await browser.newContext({viewport});
 await context.addInitScript((values) => {
   localStorage.setItem('ffaa.sleeperLeagueConnections.v1',JSON.stringify(values));
   localStorage.setItem('ffaa.activeSleeperLeague.v1',values[0].leagueId);
 },connections);
 await context.route('**/src/features/league-history/useLeagueHistory.ts*',route => route.fulfill({contentType:'application/javascript',body:`export function useLeagueHistory(){return {status:'ready',data:${JSON.stringify(snapshot)},error:'',refresh(){}};}`}));
 await context.route('**/api.sleeper.app/v1/**', async route => {
   const pathname = new URL(route.request().url()).pathname.replace('/v1','');
   const connection = connections.find(c=>pathname.includes(c.leagueId));
   let data = [];
   if(pathname === '/state/nfl') data = {season:'2026',season_type:'regular',week:1,display_week:1};
   else if(pathname === '/players/nfl') data = {};
   else if(connection && pathname.endsWith('/users')) data = [{user_id:'layout-manager',display_name:'Layout manager',metadata:{team_name:connection.managerTeamName}},{user_id:'opponent',display_name:'Opponent',metadata:{team_name:'Sunday Rival'}}];
   else if(connection && pathname.endsWith('/rosters')) data = [
     {roster_id:1,owner_id:'layout-manager',players:['4984','4035','9509','7543','8155','8130'],starters:['4984','4035','9509','7543','8155','8130','0','0'],settings:{wins:0,losses:0,fpts:0}},
     {roster_id:2,owner_id:'opponent',players:['4881'],starters:['4881','0','0','0','0','0','0','0'],settings:{wins:0,losses:0,fpts:0}},
   ];
   else if(connection && pathname.includes('/matchups/')) data = [{roster_id:1,matchup_id:1,points:0},{roster_id:2,matchup_id:1,points:0}];
   else if(connection && pathname === `/league/${connection.leagueId}`) data = {league_id:connection.leagueId,name:connection.leagueName,season:'2026',status:'in_season',total_rosters:12,roster_positions:['QB','RB','RB','WR','WR','TE','FLEX','K','DEF','BN','BN'],scoring_settings:{rec:.5},settings:{playoff_week_start:15}};
   await route.fulfill({json:data});
 });
 const page = await context.newPage();
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 async function capture(name,extra={}) {
   await page.screenshot({path:path.join(out,`${viewport.width}-${name}.png`)});
   const metrics = await page.evaluate(() => ({
     url:location.pathname+location.search, heading:document.querySelector('h1')?.textContent,
     width:innerWidth, scrollWidth:document.documentElement.scrollWidth,
     scrollers:[...document.querySelectorAll('body,#root,.product-shell,.app-main')].filter(el=>el.scrollHeight>el.clientHeight+2&&['auto','scroll'].includes(getComputedStyle(el).overflowY)).map(el=>el.className||el.tagName),
     tableTop:document.querySelector('.stats-hub-table,.auction-comparison-workspace')?.getBoundingClientRect().top,
   }));
   report.push({name,viewport,metrics,errors:[...errors],...extra}); errors.length=0;
   console.log(JSON.stringify({name,width:viewport.width,...metrics,...extra}));
 }
 for(const [name,route,selector] of cases.filter(([name])=>!process.env.LAYOUT_CASES || process.env.LAYOUT_CASES.split(',').includes(name))) {
   try {
     await page.goto(new URL(route,base).href);
     await page.locator(selector).first().waitFor({timeout:25000});
     if(name==='teams') await page.locator('.my-teams-list > article.is-ready').first().waitFor({timeout:25000});
     await page.evaluate(()=>document.fonts.ready);
     await capture(name);
   } catch(error) { report.push({name,viewport,error:error.message}); console.log(`${name}: ${error.message.slice(0,160)}`); }
 }
 if(process.env.LAYOUT_MENUS) {
   for(const [index,menu] of (await page.locator('.product-menu:visible,.league-workspace-more,.history-nav-group').all()).entries()) {
     await menu.locator('summary').click();
     const panel=menu.locator(':scope > div').first();
     const box=await panel.boundingBox();
     const menuFits=box && box.x>=0 && box.y>=0 && box.x+box.width<=viewport.width+1 && box.y+box.height<=viewport.height+1;
     await capture(`navigation-menu-${index}`,{menu:box,menuFits});
     await panel.locator('a').last().scrollIntoViewIfNeeded();
     await page.keyboard.press('Escape');
   }
 }
 if(process.env.LAYOUT_EXTENDED) {
   await page.goto(new URL('auction-values',base).href);
   await page.locator('.auction-source-details > summary').click();
   await capture('auction-sources');
   await page.locator('.auction-comparison-options > summary').click();
   await page.getByRole('button',{name:'Raw',exact:true}).click();
   await capture('auction-options');
   await page.locator('.auction-page-header').getByRole('button',{name:'Print',exact:true}).click();
   await page.locator('.auction-print-settings').scrollIntoViewIfNeeded();
   await capture('auction-print-settings');
   const source=page.locator('a[href*="/auction-values/source/"]').first();
   const sourceHref=await source.getAttribute('href');
   if(!sourceHref) throw new Error('Auction source route missing');
   await page.goto(new URL(sourceHref,base).href);
   await page.locator('.auction-source-sheet').waitFor();
   await capture('auction-source-sheet');
   await page.goto(new URL('stats',base).href);
   await page.locator('.stats-source-details > summary').click();
   await capture('stats-sources');
 }
 if(viewport.width===390 && !process.env.LAYOUT_CASES && !process.env.LAYOUT_EXTENDED) {
   await page.locator('.mobile-more-menu > summary').click();
   const panel=page.locator('.mobile-more-panel');
   const box=await panel.boundingBox();
   await capture('more',{menu:box});
   await panel.locator('a').last().scrollIntoViewIfNeeded();
   await capture('more-bottom');
   await page.keyboard.press('Escape');
   if(await page.locator('.mobile-more-menu').getAttribute('open')!==null) throw new Error('More failed Escape dismissal');
   await page.goto(new URL('stats',base).href);
   await page.locator('.stats-hub-table tbody tr').first().waitFor();
   await page.locator('.stats-hub-table tbody tr').first().click();
   await page.locator('.stats-player-drawer').waitFor();
   await capture('player');
   for(const label of ['Game Log','Career','News','Sources']) {
     const tab=page.locator('.stats-drawer-tabs button').filter({hasText:new RegExp(label.replace(' ','\\s*'),'i')});
     if(await tab.count()){await tab.click();await capture(`player-${label.replace(' ','-').toLowerCase()}`);}
   }
 }
 await context.close();
}
await fs.writeFile(path.join(out,process.env.LAYOUT_MENUS?'menus-report.json':process.env.LAYOUT_EXTENDED?'extended-report.json':'report.json'),JSON.stringify(report,null,2));
await browser.close();
if(report.some(r=>r.error || r.errors?.length || r.menuFits===false || r.metrics?.scrollWidth > r.viewport.width+1 || r.metrics?.scrollers.length)) process.exitCode=1;
