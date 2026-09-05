// Render the actual shared primitives under the app's CSS, with local test content.
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
const base=process.env.LAYOUT_BASE_URL || 'http://127.0.0.1:5278/ff/';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Overlay fixtures require a local server');
const out=path.resolve('reports/layout-20260905/overlays');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();
const report=[];
for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390},{width:390,height:480}]) {
 const page=await browser.newPage({viewport});
 page.on('pageerror', error=>console.log(`Browser error: ${error.stack}`));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto(new URL('draft-order',base).href);
 await page.locator('.draft-order-hero').waitFor();
 for(const kind of ['lite','compat','result','select-top','select-bottom','dropdown','studio','native-sheet'].filter(kind=>!process.env.LAYOUT_OVERLAYS || process.env.LAYOUT_OVERLAYS.split(',').includes(kind))) {
  await page.evaluate(async({kind})=>{
   window.__layoutRoot?.unmount(); document.querySelector('#layout-fixture')?.remove();
   const reactModule=await import('/ff/node_modules/.vite/deps/react.js');
   const React=reactModule.default ?? reactModule;
   const client=await import('/ff/node_modules/.vite/deps/react-dom_client.js');
   const createRoot=client.createRoot ?? client.default.createRoot;
   const h=React.createElement;
   const host=document.createElement('div');host.id='layout-fixture';document.body.append(host);
   const root=createRoot(host);window.__layoutRoot=root;
   const close=()=>root.unmount();
   const rows=Array.from({length:24},(_,i)=>h('p',{key:i},`Participant ${i+1}: Long team and manager names remain readable in the popup.`));
   let content;
   if(kind==='lite') {const {ModalLite}=await import('/ff/src/ui/ModalLite.tsx');content=h(ModalLite,{open:true,title:'Force nominate',onClose:close},rows);}
   if(kind==='compat') {const m=await import('/ff/src/ui/custom.tsx');content=h(m.Modal,{isOpen:true,isCentered:true,onClose:close},h(m.ModalOverlay),h(m.ModalContent,{role:'dialog','aria-label':'Draft settings'},h(m.ModalHeader,null,'Draft settings'),h(m.ModalCloseButton),h(m.ModalBody,null,rows),h(m.ModalFooter,null,h('button',{onClick:close},'Done'))));}
   if(kind==='result') {const {ResultDialog}=await import('/ff/src/features/draft-order/ResultDialog.tsx');content=h(ResultDialog,{onClose:close},h('h2',{id:'showdown-results-title'},'Test draft order'),...rows);}
   if(kind.startsWith('select')) {const {UniversalSelect}=await import('/ff/src/ui/UniversalSelect.tsx');content=h('div',{style:{position:'fixed',zIndex:1000,left:12,right:12,[kind==='select-top'?'top':'bottom']:12,maxWidth:360}},h(UniversalSelect,{'aria-label':'Edge selection'},Array.from({length:30},(_,i)=>h('option',{key:i,value:String(i)},`Option ${i+1} with a long team name`))));}
   if(kind==='dropdown') {const {DropdownMenu,DropdownMenuItem}=await import('/ff/src/ui/DropdownMenu.tsx');content=h('div',{style:{position:'fixed',zIndex:1000,right:12,bottom:12}},h(DropdownMenu,{trigger:h('button',null,'Actions')},Array.from({length:20},(_,i)=>h(DropdownMenuItem,{key:i,onClick:close},`Action ${i+1}`))));}
   if(kind==='studio') {
    await import('/ff/src/screens/league-hq.css');
    const {CommissionerStudio}=await import('/ff/src/features/league-hq/CommissionerStudio.tsx');
    const {createStarterLeagueHQ}=await import('/ff/src/features/league-hq/leagueHQData.ts');
    const teams=Array.from({length:12},(_,i)=>({id:i+1,name:`Team ${i+1} long manager name`}));
    const data=createStarterLeagueHQ({teams,teamCount:12,baseBudget:200,nominationSeconds:30,antiSnipeSeconds:10,roster:{QB:1,RB:2,WR:2,TE:1,FLEX:1,K:1,DEF:1,BN:4}});
    content=h('div',{className:'league-hq'},h(CommissionerStudio,{data,starter:data,teams,onClose:close,onSave(){}}));
   }
   if(kind==='native-sheet') {
    const {LeaguePlayerSheetProvider}=await import('/ff/src/features/player-sheet/LeaguePlayerSheet.tsx');
    const {PlayerSheetContext}=await import('/ff/src/features/player-sheet/leaguePlayerSheetContext.ts');
    content=h(LeaguePlayerSheetProvider,null,h('div',{style:{position:'fixed',top:80,left:16,zIndex:1000}},h(PlayerSheetContext.Consumer,null,sheet=>h('button',{onClick:()=>sheet.openPlayer({playerId:'4984',currentWeek:1,ownership:'Test team',leagueState:'owned'})},'Open native profile'))));
   }
   root.render(content);
  },{kind});
  const selector=kind==='lite'?'.modal-lite-content':kind==='compat'?'.cui-modal-content':kind==='result'?'.showdown-result-dialog':kind==='dropdown'?'.ffaa-dropdown-content':kind==='studio'?'.commissioner-studio':kind==='native-sheet'?'.league-player-sheet':'.ffaa-custom-select-menu';
  try {
   if(kind.startsWith('select')) await page.locator('#layout-fixture button[aria-haspopup="listbox"]').click();
   if(kind==='dropdown') await page.getByRole('button',{name:'Actions',exact:true}).click();
   if(kind==='native-sheet') await page.getByRole('button',{name:'Open native profile',exact:true}).click();
   await page.locator(selector).waitFor({timeout:5000});
   const box=await page.locator(selector).boundingBox();
   const fits=box && box.x>=-1 && box.y>=-1 && box.x+box.width<=viewport.width+1 && box.y+box.height<=viewport.height+1;
   const bodySelector=kind==='lite'?'.modal-lite-body':kind==='compat'?'.cui-modal-body':kind==='result'?'.showdown-result-dialog-scroll':kind==='studio'?'.studio-panel':selector;
   const scroll=await page.locator(bodySelector).evaluate(el=>({height:el.clientHeight,content:el.scrollHeight,overflow:getComputedStyle(el).overflowY}));
   await page.screenshot({path:path.join(out,`${viewport.width}x${viewport.height}-${kind}.png`)});
   report.push({viewport,kind,box,fits,scroll});
   if(kind==='studio') for(const label of ['Managers','Rivalries','Futures','Advanced JSON']) {
    await page.getByRole('tab',{name:label,exact:true}).click();
    await page.screenshot({path:path.join(out,`${viewport.width}x${viewport.height}-studio-${label.replace(' ','-')}.png`)});
   }
   if(kind==='result' || kind.startsWith('select') || kind==='dropdown') await page.keyboard.press('Escape');
  }catch(error){report.push({viewport,kind,error:error.message});}
 }
 await page.close();
}
await browser.close();
await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
for(const row of report)console.log(JSON.stringify(row));
if(report.some(row=>!row.fits || row.error))process.exitCode=1;
