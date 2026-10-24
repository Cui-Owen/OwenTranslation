'use strict';
// Run with the bundled Playwright dependency. Only the generated work/ profile is used.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const assert=require('node:assert/strict');

const project=path.resolve(__dirname,'..');
const extension=path.resolve(process.argv[2] || path.join(project,'extension'));
const output=path.join(project,'work','browser-test');
const EDGE=process.env.EDGE_BINARY || '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
const forbidden=/(?:immersivetranslate\.(?:com|cn|net)|imtintl\.com|\/targeted-messages(?:[/?]|$)|\/reward(?:s|-center)?(?:[/?]|$)|\/campaign-info-translated(?:[/?]|$)|analytics\.(?:immersivetranslate|imtintl)\.com|google-analytics\.com|analytics\.google\.com|googletagmanager\.com|\/g\/collect(?:[/?]|$)|\/collect(?:[/?]|$)|\/language[-_/]?detect[-_/]?(?:metric|stat)|\/metrics\/language[-_/]?detect)/i;
const checks=[],errors=[],requests=[],mockRequests=[],assetFailures=[];
const result={extension,checks,errors,requests,mockRequests};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function check(name,fn){try{const evidence=await fn();checks.push({name,status:'pass',evidence});console.log('PASS '+name);}catch(e){checks.push({name,status:'fail',error:e.stack});console.error('FAIL '+name+': '+e.message);}}
function translated(text){return '本地测试译文：'+text.replace(/Hello world\./g,'你好，世界。').replace(/This article explains reliable bilingual webpage translation\./g,'本文说明可靠的网页双语翻译。');}
function responseFor(body){
 const user=body.messages?.filter(x=>x.role==='user').map(x=>typeof x.content==='string'?x.content:JSON.stringify(x.content)).join('\n') || '';
 let parsed;try{parsed=JSON.parse(user);}catch{}
 if(parsed?.units){return JSON.stringify({ends:[parsed.units.length-1]});}
 // Preserve the production multi-item response markers, exercising the real parser.
 const re=/^(\[\[p[^\]\n]+\]\])\s*\n([\s\S]*?)(?=^\[\[p[^\]\n]+\]\]|^\[\[source_end\]\]|$(?![\s\S]))/gm;
 const items=[...user.matchAll(re)];
 if(items.length)return items.map(m=>m[1]+'\n'+translated(m[2].trim())).join('\n')+'\n[[terms]]\n[[end]]';
 return translated(user.replace(/^Translate to[^\n]*\n\n/,''));
}
async function main(){
 assert.ok(fs.existsSync(path.join(extension,'manifest.json')),'Build extension/ before running browser tests.');
 fs.mkdirSync(output,{recursive:true});
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  if(req.url==='/fixture.html'){
   res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Local bilingual translation fixture</title></head><body><main><h1>Bilingual translation fixture</h1><p id="source">Hello world. This article explains reliable bilingual webpage translation.</p><p>Readers keep the original text and the translated text together.</p><p>Contact owen.fixture@example.com or +1 415-555-2671.</p><textarea aria-label="input translation fixture">Hello world.</textarea></main></body></html>');return;
  }
  if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}
  if(req.url==='/v1/models'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:[{id:'owen-test-model',display_name:'Owen local test model'}]}));return;}
  if(req.url==='/v1/chat/completions'){
   let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);mockRequests.push({path:req.url,body});
   const content=responseFor(body);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({id:'mock-local',object:'chat.completion',model:'owen-test-model',choices:[{index:0,message:{role:'assistant',content},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}}));return;
  }
  res.writeHead(404);res.end('Not found');
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;result.mockBase=base;
 const profile=fs.mkdtempSync(path.join(output,'edge-profile-'));result.profile=profile;
 let context;
 try{
  context=await chromium.launchPersistentContext(profile,{executablePath:EDGE,headless:false,locale:'zh-CN',viewport:{width:1150,height:900},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--no-first-run','--no-default-browser-check','--lang=zh-CN']});
  context.on('request',r=>requests.push({method:r.method(),url:r.url().replace(/([?&](?:api_secret|key|token|access_token)=)[^&]*/gi,'$1[redacted]'),type:r.resourceType(),worker:r.serviceWorker()?.url() || null}));
  context.on('requestfailed',r=>{if(r.url().startsWith('chrome-extension://'))assetFailures.push({url:r.url(),error:r.failure()?.errorText});});
  context.on('weberror',e=>errors.push({url:e.page()?.url(),message:e.error().message}));
  const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker',{timeout:20000});
  const id=new URL(worker.url()).host;result.extensionId=id;
  await worker.evaluate(()=>{self.__owenBrowserErrors=[];addEventListener('error',e=>self.__owenBrowserErrors.push(String(e.message)));addEventListener('unhandledrejection',e=>self.__owenBrowserErrors.push(String(e.reason?.stack || e.reason)));});
  await check('actual Edge extension brand',async()=>{const m=await worker.evaluate(()=>chrome.runtime.getManifest());assert.equal(m.name,'欧文翻译');assert.equal(m.action.default_title,'欧文翻译');return {name:m.name,version:m.version,versionName:m.version_name};});
  await check('only seven extension-scoped direct provider header rules remain',async()=>{const rules=await worker.evaluate(()=>chrome.declarativeNetRequest.getDynamicRules());assert.deepEqual(rules.map(r=>r.id).sort((a,b)=>a-b),[2,3,4,5,200,315,316]);for(const r of rules)assert.deepEqual(r.condition.initiatorDomains,[id]);return {rules:rules.length};});
  const config={popupMode:'simple',pcFloatBall:{enable:true},monkeyH5FloatBall:{enable:true},autoSync:true,proSyncAPIKey:true,interfaceLanguage:'zh-CN',targetLanguage:'zh-CN',sourceLanguage:'en',translationService:'custom-ai-test',inputTranslationService:'custom-ai-test',subtitleTranslateService:'custom-ai-test',userTranslationServices:['custom-ai-test'],translationServices:{'custom-ai-test':{extends:'custom-ai',type:'custom-ai',group:'custom',provider:'custom',name:'本地测试',apiUrl:base+'/v1/chat/completions',model:'owen-test-model',APIKEY:'test-placeholder',temperature:0,requestTimeout:8000,retry:0,aiBatch:{mode:'custom',itemsPerRequest:8}},'magpie-test':{type:'magpie',extends:'magpie',group:'custom',name:'Magpie 1',apiUrl:base+'/v1/chat/completions',model:'owen-test-model',requestTimeout:8000,retry:0}},translationLanguagePattern:{matches:[],excludeMatches:[]},generalRule:{isTranslateTitle:false,detectParagraphLanguage:false,translationArea:'body',paragraphMinTextCount:1,paragraphMinWordCount:1,'selectionTranslation.add':{enable:true,triggerMode:'icon'},'subtitleRule.add':{aiSegmentService:'magpie-test'}},sensitiveConfig:{telemetry:true,sensitiveMode:'inner'}};
  const bootstrap=await context.newPage();await bootstrap.goto(`chrome-extension://${id}/options.html`);
  await bootstrap.waitForFunction(()=>document.querySelector('a[href="#services"]'));
  await bootstrap.evaluate(async config=>{
   const response=await chrome.runtime.sendMessage({from:'popup:main',to:'background:main',payload:{method:'setUserConfig',data:config}});
   if(!response?.ok)throw Error('fixture configuration save failed');
  },config);
  await bootstrap.close();
  const command=async(method,data={})=>worker.evaluate(async({url,method,data})=>{const [tab]=await chrome.tabs.query({url});return chrome.tabs.sendMessage(tab.id,{from:'background:main',to:`content:main:${tab.id}`,payload:{method,data}});},{url:base+'/fixture.html',method,data});
  await check('local glossary CRUD and optimistic conflict work without login',async()=>{
   const termPage=await context.newPage();await termPage.goto(`chrome-extension://${id}/options.html`);await sleep(600);
   const evidence=await termPage.evaluate(async()=>{
    const rpc=async(method,data)=>{const result=await chrome.runtime.sendMessage({from:'popup:main',to:'background:main',payload:{method,data}});if(!result?.ok)throw Error(JSON.stringify(result));return result.data;};
    const term={id:'custom-owen-browser-test',name:'本地验收词表',author:'self',active:true,glossaries:[{k:'transaction',v:'事务',tl:'zh-CN'}]};
    const saved=await rpc('saveTermsIfCurrent',{term,expectedHash:null});
    const read=await rpc('queryTerms',term.id);
    const stale=await rpc('saveTermsIfCurrent',{term:{...term,name:'错误覆盖'},expectedHash:'stale-hash'});
    await rpc('saveTerms',{id:term.id,name:'本地改名'});const renamed=await rpc('queryTerms',term.id);
    await rpc('deleteTerms',term.id);const deleted=await rpc('queryTerms',term.id);
    return {saved,read,stale,renamed,deleted};
   });assert.equal(evidence.saved.status,'saved');assert.equal(evidence.read.glossaries[0].v,'事务');assert.equal(evidence.stale.status,'stale');assert.equal(evidence.renamed.name,'本地改名');assert.equal(evidence.renamed.glossaries[0].v,'事务');assert.ok(!evidence.deleted);await termPage.close();return evidence;
  });
  const page=await context.newPage();
  await check('webpage bilingual translation through production engine',async()=>{
   await page.goto(base+'/fixture.html');await page.bringToFront();await sleep(1800);
   result.translationTrigger=await command('toggleTranslatePage',{trigger:'browser_test',currentPageStatus:'Original'});
   await page.waitForFunction(()=>document.querySelectorAll('.immersive-translate-target-wrapper').length>0,{timeout:30000});
   await page.waitForFunction(()=>[...document.querySelectorAll('.immersive-translate-target-wrapper')].some(x=>x.textContent.includes('本地测试译文')),{timeout:20000});
   assert.ok(mockRequests.some(x=>JSON.stringify(x.body.messages).includes('owen.fixture@example.com')),'email reaches translation API unchanged');
   assert.ok(mockRequests.some(x=>JSON.stringify(x.body.messages).includes('+1 415-555-2671')),'phone reaches translation API unchanged');
   const content=await page.locator('#source').innerText();const targets=await page.locator('.immersive-translate-target-wrapper').allTextContents();
   assert.match(content,/Hello world/);assert.match(content,/你好，世界/);assert.ok(mockRequests.some(x=>x.body.model==='owen-test-model'&&!x.body.messages?.some(m=>String(m.content).includes('"units"'))));
   assert.equal(await page.locator('[id*=float-ball],.immersive-translate-float-ball').count(),0);await page.screenshot({path:path.join(output,'webpage-bilingual.png'),fullPage:true});return {sourceAndTranslation:content,targets};
  });
  await check('scrolling dynamically appended webpage text receives bilingual translation',async()=>{
   await page.evaluate(()=>{const spacer=document.createElement('div');spacer.style.height='1200px';const p=document.createElement('p');p.id='incremental-source';p.textContent='Hello world. This newly inserted paragraph tests scrolling and incremental webpage translation.';document.body.append(spacer,p);});
   await page.locator('#incremental-source').scrollIntoViewIfNeeded();
   await page.waitForFunction(()=>document.querySelector('#incremental-source')?.textContent.includes('本地测试译文'),{timeout:20000});
   const text=await page.locator('#incremental-source').innerText();assert.match(text,/Hello world/);assert.match(text,/本地测试译文/);return {text};
  });
  await check('translation mask toggles on and off',async()=>{
   await command('toggleTranslationMask');await page.waitForFunction(()=>document.querySelector('[data-immersive-translate-root-translation-theme="mask"]'));
   await command('toggleTranslationMask');await page.waitForFunction(()=>!document.querySelector('[data-immersive-translate-root-translation-theme="mask"]'));return {maskEnabled:true,maskDisabled:true};
  });
  await check('restore original webpage',async()=>{
   await command('restorePage');await page.waitForFunction(()=>!document.querySelector('.immersive-translate-target-wrapper'));
   const text=await page.locator('#source').innerText();assert.equal(text,'Hello world. This article explains reliable bilingual webpage translation.');return {text};
  });
  await check('selection translation uses the configured AI service, not the removed hosted one',async()=>{
   // The fixture service has no upstream selectionTranslation flag on purpose.
   await page.locator('#source').scrollIntoViewIfNeeded();
   const before=mockRequests.length,box=await page.locator('#source').boundingBox();
   await page.mouse.move(box.x+2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+90,box.y+box.height/2,{steps:8});await page.mouse.up();
   await page.waitForFunction(()=>{const b=document.getElementById('immersive-translate-selection-translation-button')?.shadowRoot?.querySelector('.imt-selection-translation-button');return b&&b.getBoundingClientRect().width>0;},{timeout:10000});
   const icon=await page.evaluate(()=>{const r=document.getElementById('immersive-translate-selection-translation-button').shadowRoot.querySelector('.imt-selection-translation-button').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
   await page.mouse.click(icon.x,icon.y);
   const card=()=>document.getElementById('immersive-translate-modal-selection-root')?.shadowRoot;
   try {
   await page.waitForFunction(c=>{const r=eval(c)();return r&&(r.querySelector('.sentences-translation-text')?.textContent.includes('本地测试译文')||r.querySelector('.immersive-translate-error-text'));},`(${card})`,{timeout:20000});
   } catch (error) {
    const state=await page.evaluate(()=>({selection:getSelection()?.toString(),roots:[...document.querySelectorAll('[id*=immersive]')].map(el=>({id:el.id,text:el.shadowRoot?.textContent?.slice(-4000)}))}));
    fs.writeFileSync(path.join(output,'selection-failure.json'),JSON.stringify({state,calls:mockRequests.slice(before)},null,2));
    await page.screenshot({path:path.join(output,'selection-failure.png')});throw error;
   }
   const result=await page.evaluate(c=>{const r=eval(c)();return {text:r.querySelector('.sentences-translation-text')?.textContent||'',error:r.querySelector('.immersive-translate-error-text')?.textContent||''};},`(${card})`);
   assert.equal(result.error,'');assert.match(result.text,/本地测试译文/);
   assert.ok(mockRequests.slice(before).some(x=>x.body.model==='owen-test-model'),'selection request reached the configured service');
   await page.keyboard.press('Escape');await page.mouse.click(5,5);await page.screenshot({path:path.join(output,'selection-card.png')});return result;
  });
  const ui=await context.newPage();
  const surfaceText={};
  const vendor=/(?:immersivetranslate\.(?:com|cn|net)|imtintl\.com|github\.com\/immersive-translate(?:\/|$))/i;
  const promo=/登录后可开通会员|免费试用会员|立即升级|立即订阅|奖励中心|消息中心|Google Drive/;
  for(const file of ['options.html','popup.html','side-panel.html'])await check(file+' loads without promotion or original-site links',async()=>{
   await ui.goto(`chrome-extension://${id}/${file}`);await sleep(1200);const text=await ui.locator('body').innerText();surfaceText[file]=text;
   assert.ok(text.trim().length>8,'empty UI');assert.ok(await ui.locator('button,input,select,textarea,a').count(),'UI has no controls');await ui.screenshot({path:path.join(output,file+'.png'),fullPage:true});
   assert.doesNotMatch(text,promo,'removed promotional content remains');
   const links=await ui.locator('a[href]').evaluateAll(a=>a.map(x=>({text:x.textContent,href:x.getAttribute('href')})));
   assert.deepEqual(links.filter(x=>/#(?:writing|manga|messages|developer)\b/.test(x.href)||vendor.test(x.href)),[]);
  });
  // The popup acts on the fixture tab (?tabId=), as it would on the active tab.
  const popupFor=async()=>{const tabId=await worker.evaluate(async u=>(await chrome.tabs.query({url:u+'/*'}))[0]?.id,base);const p=await context.newPage();await p.setViewportSize({width:360,height:640});await p.goto(`chrome-extension://${id}/popup.html?tabId=${tabId}`);await p.waitForSelector('header');await sleep(1200);return p;};
  const storedConfig=()=>worker.evaluate(async()=>(await chrome.storage.local.get('fullLocalUserConfig')).fullLocalUserConfig);
  await check('popup shows page state, language pair, service, display mode and four features',async()=>{
   const p=await popupFor();const text=await p.locator('body').innerText();
   assert.match(text,/127\.0\.0\.1/);assert.match(text,/未翻译/);assert.match(text,/翻译此页/);assert.match(text,/本地测试/);
   assert.equal(await p.getByRole('switch').count(),4);assert.equal(await p.getByRole('radio').count(),2);
   assert.doesNotMatch(text,/简约模式|简单模式|启用 AI 精翻|更多功能|登录|会员/);
   await p.screenshot({path:path.join(output,'popup-unified.png')});await p.close();return {text};
  });
  await check('popup translates and restores the page',async()=>{
   let p=await popupFor();await p.getByRole('button',{name:/翻译此页/}).click();
   await page.waitForFunction(()=>[...document.querySelectorAll('.immersive-translate-target-wrapper')].some(x=>x.textContent.includes('本地测试译文')),{timeout:20000});
   if(!p.isClosed())await p.close();p=await popupFor();assert.match(await p.locator('body').innerText(),/已翻译/);
   await p.getByRole('button',{name:/显示原文/}).click();await page.waitForFunction(()=>!document.querySelector('.immersive-translate-target-wrapper'),{timeout:10000});
   if(!p.isClosed())await p.close();return {translated:true,restored:true};
  });
  await check('popup controls write the same keys the engine reads',async()=>{
   const p=await popupFor(),sw=p.getByRole('switch'),input=await sw.nth(3).getAttribute('aria-checked');
   await p.getByRole('radio',{name:/仅译文/}).click();await sleep(700);
   await sw.nth(3).click();await sleep(700);
   await p.getByRole('combobox',{name:'此网站'}).click();await p.getByRole('option',{name:'从不翻译'}).click();await sleep(700);
   const raw=await storedConfig();assert.equal(raw.translationMode,'translation');assert.equal(String(raw.enableInputTranslation),String(input!=='true'));assert.ok(raw.translationUrlPattern.excludeMatches.includes('127.0.0.1'));
   await p.getByRole('combobox',{name:'此网站'}).click();await p.getByRole('option',{name:'按默认'}).click();await sleep(500);
   await p.getByRole('radio',{name:/双语对照/}).click();await sleep(500);await sw.nth(3).click();await sleep(700);
   await p.close();return {mode:raw.translationMode,never:raw.translationUrlPattern.excludeMatches};
  });
  await check('settings keep a left navigation column at desktop widths and fit narrow windows',async()=>{
   const evidence=[];
   for(const width of [1440,1150,900,640,420]){
    await ui.setViewportSize({width,height:900});await ui.goto(`chrome-extension://${id}/options.html#general`);await ui.waitForSelector('nav');await sleep(300);
    const layout=await ui.evaluate(()=>{const n=document.querySelector('aside').getBoundingClientRect(),m=document.querySelector('main').getBoundingClientRect();return {nav:{x:n.x,width:n.width},main:{x:m.x},overflow:document.documentElement.scrollWidth>innerWidth+1};});
    if(width>=768)assert.ok(layout.main.x>=layout.nav.x+layout.nav.width,'navigation must occupy its own left column');
    assert.equal(layout.overflow,false,'page must fit the window');
    evidence.push({width,...layout});await ui.screenshot({path:path.join(output,'settings-'+width+'.png'),fullPage:true});
   }
   await ui.emulateMedia({colorScheme:'dark'});await ui.screenshot({path:path.join(output,'settings-dark.png'),fullPage:true});
   await ui.emulateMedia({colorScheme:'light'});await ui.setViewportSize({width:1150,height:900});return evidence;
  });
  await check('text panel fills a narrow window without a navigation rail',async()=>{
   await ui.setViewportSize({width:360,height:800});await ui.goto(`chrome-extension://${id}/side-panel.html`);await sleep(600);
   assert.equal(await ui.locator('.side-nav').count(),0);
   const layout=await ui.locator('textarea').first().evaluate(el=>({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,width:el.getBoundingClientRect().width,viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth}));
   assert.ok(layout.right>320,'text area should use the reclaimed right edge');assert.equal(layout.overflow,false);
   await ui.screenshot({path:path.join(output,'side-panel-360.png'),fullPage:true});
   await ui.setViewportSize({width:1150,height:900});return layout;
  });
  await check('retained side-panel text translation uses configured local API',async()=>{
   await ui.goto(`chrome-extension://${id}/side-panel.html`);await sleep(800);
   await ui.locator('textarea').first().fill('Hello world.');
   await ui.getByRole('button',{name:'翻译',exact:true}).click();
   await ui.waitForFunction(()=>document.body.textContent.includes('本地测试译文'),{timeout:20000});
   const text=await ui.locator('body').innerText();assert.match(text,/你好，世界/);
   await ui.screenshot({path:path.join(output,'side-panel-translated.png'),fullPage:true});return {text};
  });
  await check('article terminology opens in the side panel from the page and keeps its actions',async()=>{
   const rpcUI=(method,data)=>ui.evaluate(async([method,data])=>{const r=await chrome.runtime.sendMessage({from:'options:test',to:'background:main',payload:{method,data}});if(!r?.ok)throw Error(JSON.stringify(r));return r.data;},[method,data]);
   const before=await rpcUI('getUserConfig');
   await rpcUI('setUserConfig',{...before,articleTerminologyMatches:[base+'/*'],translationServices:{...before.translationServices,'custom-ai-test':{...before.translationServices['custom-ai-test'],aiBatch:{mode:'recommended'}}}});
   await rpcUI('saveTerms',{id:'custom-owen-panel-test',name:'侧栏验收词表',description:'',matches:['*'],author:'self',active:true,useTermNameAsDomain:false,glossaries:[{k:'world',v:'世界'}]});
   const cdp=await context.newCDPSession(page),worlds=[];cdp.on('Runtime.executionContextCreated',e=>worlds.push(e.context));
   try{
    await page.goto(base+'/fixture.html');await cdp.send('Runtime.enable');await sleep(1800);
    await command('toggleTranslatePage',{trigger:'browser_test',currentPageStatus:'Original'});
    await page.waitForFunction(()=>[...document.querySelectorAll('.immersive-translate-target-wrapper')].some(x=>x.textContent.includes('本地测试译文')),{timeout:20000});await sleep(800);
    await ui.setViewportSize({width:400,height:820});await ui.goto(`chrome-extension://${id}/side-panel.html`);await sleep(1500);
    const world=worlds.find(c=>c.auxData?.type==='isolated'&&c.name==='欧文翻译');assert.ok(world,'content isolated world');
    // The same message the page sends when its terminology entry is opened.
    const sent=await cdp.send('Runtime.evaluate',{contextId:world.id,awaitPromise:true,returnByValue:true,expression:"chrome.runtime.sendMessage({to:'side_panel:article_terminology',from:'content:article_terminology',payload:{method:'open',data:{route:{name:'overview'}}}}).then(r=>!!r?.ok)"});
    assert.equal(sent.result?.value,true);
    await ui.waitForFunction(()=>document.querySelector('main')?.innerText.includes('本次翻译应用术语'),null,{timeout:10000});
    const overview=await ui.locator('main').innerText();assert.match(overview,/world/);assert.match(overview,/世界/);assert.match(overview,/应用 \d+ 次/);
    await ui.screenshot({path:path.join(output,'side-panel-terms.png'),fullPage:true});
    await ui.locator('main li button').first().click();await sleep(500);
    const detail=await ui.locator('main').innerText();assert.match(detail,/术语详情/);assert.match(detail,/匹配位置/);
    await ui.getByRole('button',{name:'定位到文章'}).first().click();await sleep(300);
    await ui.getByRole('button',{name:'返回',exact:true}).click();await sleep(300);
    await ui.evaluate(()=>window.OwenSidePanel.bridge.get().actions.changeRoute({name:'saveTerms'}));await sleep(500);
    assert.match(await ui.locator('main').innerText(),/添加至术语库|所有新术语都已添加至术语库/);
    await ui.getByRole('button',{name:'文本翻译'}).click();await sleep(500);
    assert.equal(await ui.locator('main textarea').count(),1,'back to text translation');
    return {overview:overview.slice(0,200),detail:detail.slice(0,200)};
   }finally{
    await cdp.detach().catch(()=>{});await rpcUI('setUserConfig',before);await rpcUI('deleteTerms','custom-owen-panel-test');
    await command('restorePage').catch(()=>{});await ui.setViewportSize({width:1150,height:900});
   }
  });
  for(const route of ['file','image','video','tutorial','messages'])await check('legacy side panel '+route+' command cannot open removed module',async()=>{
   await ui.goto(`chrome-extension://${id}/side-panel.html`);await sleep(600);
   await worker.evaluate(async targetTab=>chrome.runtime.sendMessage({from:'background:main',to:'side_panel:reward_center',payload:{method:'openSidePanelTab',data:{targetTab}}}),route);await sleep(500);
   const text=await ui.locator('body').innerText();assert.match(text,/文本翻译/);assert.equal(await ui.locator('input[type=file]').count(),0);return {text};
  });
  await check('every settings section renders local controls only',async()=>{
   const pages=[],issues=[];
   for(const route of ['general','services','page','terms','selection_translation','mouse_hover','input','subtitle','shortcuts','import_export','about']){
    await ui.goto(`chrome-extension://${id}/options.html#${route}`);await sleep(700);
    const text=await ui.locator('main').innerText();if(text.trim().length<=60)issues.push(route+' blank');
    const links=await ui.locator('a[href]').evaluateAll(a=>a.map(x=>x.getAttribute('href')));
    if(links.some(x=>vendor.test(x)))issues.push({route,links});if(promo.test(text))issues.push({route,promo:text.match(promo)[0]});
    await ui.screenshot({path:path.join(output,'settings-'+route+'.png'),fullPage:true});pages.push({route,title:text.split('\n')[0]});
   }
   assert.deepEqual(issues,[]);return pages;
  });
  for(const route of ['ai','writing','manga','file','image','messages','floating','account','region','developer'])await check('legacy removed route #'+route+' falls back to retained settings',async()=>{
   await ui.goto(`chrome-extension://${id}/options.html#${route}`);await sleep(500);
   const title=await ui.locator('main h1').innerText();assert.ok(['常规','翻译服务'].includes(title),title);
   assert.ok(!(await ui.locator('input[type=file]').count()),'removed upload route exposed');return {title};
  });
  await check('legacy #advanced link opens web page settings',async()=>{await ui.goto(`chrome-extension://${id}/options.html#advanced`);await sleep(500);const t=await ui.locator('main h1').innerText();assert.equal(t,'网页翻译');return t;});
  await check('custom API editor keeps key, model, prompts and tests the connection',async()=>{
   await ui.goto(`chrome-extension://${id}/options.html#services/custom-ai-test`);await sleep(900);
   let text=await ui.locator('main').innerText();assert.match(text,/API 密钥/);assert.match(text,/模型/);assert.match(text,/接口地址/);
   await ui.getByRole('button',{name:'测试'}).click();await ui.waitForSelector('text=连接成功',{timeout:15000});
   await ui.getByRole('button',{name:/高级设置/}).click();await sleep(300);text=await ui.locator('main').innerText();assert.match(text,/提示词/);assert.match(text,/字幕提示词/);
   return {text:text.slice(-600)};
  });
  await check('service list shows only configured services, no unused legacy templates',async()=>{
   await ui.goto(`chrome-extension://${id}/options.html#services`);await sleep(600);
   const text=await ui.locator('main').innerText();
   assert.doesNotMatch(text,/MiMo|千帆|腾讯翻译|有道|火山|智谱|Transmart|Yandex/i);assert.match(text,/本地测试/);assert.match(text,/Magpie 1/);return {text};
  });
  await check('add-service dialog offers ten templates and Magpie defaults to the local gateway',async()=>{
   await ui.goto(`chrome-extension://${id}/options.html#services`);await sleep(500);await ui.getByRole('button',{name:'添加服务'}).click();await sleep(300);
   const names=(await ui.locator('[role="dialog"] .grid button').allInnerTexts()).map(x=>x.trim()).filter(Boolean);
   assert.equal(names.length,10,'ten addable templates (Microsoft and Google are built in): '+names.join(', '));
   assert.ok(names.every(x=>!/(?:腾讯|火山|有道|智谱|通义|Kimi|Groq)/i.test(x)),names.join(','));
   await ui.locator('[role="dialog"] .grid button',{hasText:'Magpie'}).click();await sleep(1000);
   const hash=await ui.evaluate(()=>location.hash);assert.match(hash,/^#services\/magpie-/);
   const values=await ui.locator('main input').evaluateAll(a=>a.map(x=>x.value));assert.ok(values.includes('http://127.0.0.1:3425/v1/chat/completions'),values.join(','));
   await ui.screenshot({path:path.join(output,'magpie-service.png'),fullPage:true});return {hash,templates:names};
  });
  await check('subtitle settings keep the basic optimization choice and pick any added AI service for segmentation',async()=>{
   await ui.goto(`chrome-extension://${id}/options.html#subtitle`);await sleep(700);
   const basic=()=>ui.getByRole('switch',{name:'自动字幕基础分句'}),states=[];
   for(let i=0;i<2;i++){await basic().click();await sleep(600);await ui.reload();await sleep(700);states.push(await basic().getAttribute('aria-checked'));}
   assert.notEqual(states[0],states[1],'basic optimization must persist both ways');
   const picker=ui.getByRole('combobox',{name:'AI 智能分句'});assert.match(await picker.innerText(),/Magpie 1/);
   await picker.click();await sleep(300);const options=await ui.getByRole('option').allInnerTexts();await ui.keyboard.press('Escape');
   assert.ok(options.some(x=>/本地测试/.test(x)));assert.ok(options.some(x=>/关闭/.test(x)));assert.ok(!options.some(x=>/微软翻译/.test(x)));
   await ui.screenshot({path:path.join(output,'subtitle-segmentation.png'),fullPage:true});return {basicAfterTwoReloads:states,options};
  });
  await check('AI segmentation asks the selected Magpie service from the content script and caches the boundaries',async()=>{
   const page=await context.newPage(),cdp=await context.newCDPSession(page),worlds=[];
   cdp.on('Runtime.executionContextCreated',e=>worlds.push(e.context));await cdp.send('Runtime.enable');
   await page.goto(base+'/fixture.html');await sleep(2500);
   const world=worlds.find(c=>c.auxData?.type==='isolated'&&c.name==='欧文翻译');assert.ok(world,'content isolated world');
   const before=mockRequests.length;
   const r=await cdp.send('Runtime.evaluate',{contextId:world.id,awaitPromise:true,returnByValue:true,expression:`(async()=>{
    const conf=${JSON.stringify({type:'magpie',apiUrl:base+'/v1/chat/completions',model:'owen-test-model',APIKEY:'magpie'})};
    const translator=new globalThis.TranslationServicesClass.magpie(conf,{},{translationService:'magpie-test',usageScene:'subtitle'},false);await translator.init();
    const host={config:{videoSelector:'video',aiSegmentService:'magpie-test'},ctx:{targetLanguage:'zh-CN',config:{translationServices:{'magpie-test':conf}}},attachSubtitle(items,lang){this.lastAttachSubtitle={subtitleItems:items,lang};},isYoutubeSubtitleRequestCurrent:async()=>true};
    const events=[{tStartMs:1000,dDurationMs:3000,segs:[{utf8:'Hello ',tOffsetMs:0},{utf8:'world. ',tOffsetMs:500},{utf8:'This ',tOffsetMs:1000},{utf8:'is ',tOffsetMs:1500},{utf8:'a ',tOffsetMs:2000},{utf8:'test.',tOffsetMs:2500}]}];
    const request=(s,u,signal)=>translator.sendMessage({systemPrompt:s,userPrompt:u,from:'en',to:'zh-CN',signal});
    let first,second=0;const run=await ImtSegmentLocal.begin(host);await ImtSegmentLocal.start(host,events,'en','fixture',run,{request,cache:x=>first=x});
    const again=await ImtSegmentLocal.begin(host);await ImtSegmentLocal.start(host,events,'en','fixture',again,{request:()=>{second++;throw Error('cache expected');},cache:()=>{}});
    return {enabled:run.enabled,cues:first.map(x=>x.text),second,legacy:!!globalThis.ImtMagpieLocal};
   })()`});
   if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails).slice(0,600));
   const evidence=r.result.value,calls=mockRequests.slice(before);await page.close();
   assert.equal(evidence.enabled,true);assert.equal(evidence.legacy,false);assert.equal(evidence.second,0);assert.equal(evidence.cues.join('').replace(/\s/g,''),'Helloworld.Thisisatest.');
   assert.equal(calls.length,1);assert.equal(calls[0].body.model,'owen-test-model');assert.match(calls[0].body.messages[0].content,/sentence boundaries/);
   return {...evidence,requests:calls.length};
  });
  await check('Phase 1 exposes five commands and creates no Offscreen document',async()=>{
   const commands=(await worker.evaluate(()=>chrome.commands.getAll())).filter(x=>x.name!=='_execute_action');
   assert.deepEqual(commands.map(x=>x.name).sort(),['toggleTranslatePage','toggleOnlyTranslation','toggleSidePanel','translateInputBox','toggleMouseHoverTranslateDirectly'].sort());
   const contexts=await worker.evaluate(()=>chrome.runtime.getContexts({}));
   assert.equal(contexts.filter(x=>x.contextType==='OFFSCREEN_DOCUMENT').length,0);
   return {commands:commands.map(x=>x.name),offscreenDocuments:0};
  });
  await check('Phase 1 removes AIFW settings and all local asset failures',async()=>{
   await ui.goto(`chrome-extension://${id}/options.html#advanced`);await sleep(600);
   const body=await ui.locator('body').innerText();
   assert.doesNotMatch(body,/OneAIFW|oneaifw|AI 防火墙|API-HOST: http:\/\/127\.0\.0\.1:8844|发送前脱敏/);
   assert.deepEqual(assetFailures,[]);return {assetFailures:0};
  });
  await sleep(800);
  await check('all page and service worker requests omit original-vendor domains and telemetry sinks',async()=>{const bad=requests.filter(x=>forbidden.test(x.url));assert.equal(bad.length,0,'forbidden requests: '+bad.map(x=>x.url.split('?')[0]).join(', '));assert.ok(requests.some(x=>x.worker&&x.url===base+'/v1/chat/completions'),'background API request capture missing');return {requests:requests.length,backgroundRequests:requests.filter(x=>x.worker).length,localMockCalls:mockRequests.length};});
  await check('extension surfaces and background have no uncaught JavaScript errors',async()=>{const background=await worker.evaluate(()=>self.__owenBrowserErrors);assert.deepEqual(errors,[]);assert.deepEqual(background,[]);return {errors:0,backgroundErrors:0};});
  fs.writeFileSync(path.join(output,'surface-text.json'),JSON.stringify(surfaceText,null,2));
 }finally{
  if(context)await context.close();await new Promise(r=>server.close(r));
  result.passed=checks.filter(x=>x.status==='pass').length;result.failed=checks.filter(x=>x.status==='fail').length;
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2));
 }
 console.log(JSON.stringify({passed:result.passed,failed:result.failed,result:path.join(output,'result.json')},null,2));
 if(result.failed)process.exitCode=1;
}
main().catch(e=>{console.error(e.stack);fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({...result,fatal:e.stack},null,2));process.exitCode=1;});
