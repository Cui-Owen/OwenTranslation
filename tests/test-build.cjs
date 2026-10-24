'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const acorn=require('acorn'),walk=require('acorn-walk');
const root=path.resolve(__dirname,'..'),extension=path.join(root,'extension');
const read=n=>fs.readFileSync(path.join(extension,n),'utf8');
let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name);}
const manifest=JSON.parse(read('manifest.json'));
test('build inventory matches all release files',()=>{
 const crypto=require('node:crypto'),info=JSON.parse(read('OWEN-BUILD.json'));
 assert.ok(!info.files['OWEN-BUILD.json'],'inventory must not hash itself');
 for(const [file,expected]of Object.entries(info.files)){
  const bytes=fs.readFileSync(path.join(extension,file));assert.equal(bytes.length,expected.bytes,file);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),expected.sha256,file);
 }
});
test('brand and removed writing command',()=>{assert.equal(manifest.name,'欧文翻译');assert.equal(manifest.action.default_title,'欧文翻译');assert.ok(!manifest.commands.openAiWritingModal);});
test('manifest references only existing kept resources',()=>{
 const paths=[manifest.background.service_worker,manifest.options_page,manifest.action.default_popup,...Object.values(manifest.icons),...manifest.content_scripts.flatMap(x=>x.js||[]),...manifest.web_accessible_resources.flatMap(x=>x.resources),...(manifest.declarative_net_request?.rule_resources || []).map(x=>x.path)];
 for(const f of paths){assert.ok(fs.existsSync(path.join(extension,f)),f);assert.ok(!/^(?:pdf|image|wasm|tesseract|browser-bridge)\//.test(f),f);}
});
test('single settings entry and minimal permissions',()=>{assert.equal(manifest.options_page,'options.html');assert.deepEqual(manifest.permissions,['storage','activeTab','contextMenus','declarativeNetRequestWithHostAccess','sidePanel']);assert.equal(manifest.declarative_net_request,undefined);assert.ok(!fs.existsSync(path.join(extension,'request_modifier_rule.json')));assert.ok(!read('popup.html').includes('magpie-popup-link'));assert.deepEqual(Object.keys(JSON.parse(read('locales.json'))).sort(),['en','zh-CN','zh-HK','zh-TW'].sort());});
test('OCR and AIFW resources removed, player hooks byte-identical',()=>{
 for(const d of ['pdf','image','wasm','tesseract','browser-bridge','aifw','offscreen.js','offscreen.html'])assert.ok(!fs.existsSync(path.join(extension,d)),d);
 function compare(dir){for(const x of fs.readdirSync(path.join(extension,dir),{withFileTypes:true})){let p=path.join(dir,x.name);if(x.isDirectory())compare(p);else assert.deepEqual(fs.readFileSync(path.join(extension,p)),fs.readFileSync(path.join(root,'upstream',p)),p);}}
 compare('video-subtitle');
 assert.deepEqual(fs.readFileSync(path.join(extension,'content_guard.js')),fs.readFileSync(path.join(root,'upstream','content_guard.js')),'content_guard.js');
});
for(const file of ['background.js','side-panel.js','content_main.js'])test(file+' final merged configuration rejects old/remote re-enablement',()=>{
 const ast=acorn.parse(read(file),{sourceType:'module',ecmaVersion:'latest'});
 let policy;walk.simple(ast,{FunctionDeclaration(n){if(n.id.name==='owenEnforceConfig')policy=n;}});assert.ok(policy);
 const apply=vm.runInNewContext('('+read(file).slice(policy.start,policy.end)+')');
 const original={enableSelfServiceReport:true,'enablePerformanceReport.add_v.[1.25.3]':true,messageCenter:{enable:true},activeCampaignTags:{enabled:true},sidePanel:{navItems:{file:{},image:{},messages:{}}},sensitiveConfig:{telemetry:true,sensitiveMode:'open'},generalRule:{aiWriting:{enable:true},imageRule:{enable:true},selectionTranslation:{screenshotArea:{enable:true}},paragraphMinTextCount:21},translationServices:{local:{enableAIContext:true,apiUrl:'http://127.0.0.1:3425/v1/chat/completions'}},rawUserConfig:{disableReport:false,sensitiveConfig:{telemetry:true},generalRule:{aiWriting:{enable:true}}}};
 const cfg=apply(original);assert.equal(cfg.enableSelfServiceReport,false);assert.equal(cfg.enablePerformanceReport,false);assert.equal(cfg.messageCenter.enable,false);assert.equal(cfg.activeCampaignTags.enabled,false);assert.deepEqual(Object.keys(cfg.sidePanel.navItems),['text']);assert.equal(cfg.generalRule.aiWriting.enable,false);assert.equal(cfg.generalRule.imageRule.enable,false);assert.equal(cfg.generalRule.selectionTranslation.screenshotArea.enable,false);assert.equal(cfg.rawUserConfig.disableReport,true);assert.equal(cfg.rawUserConfig.generalRule.aiWriting.enable,false);assert.equal(cfg.sensitiveConfig.sensitiveMode,'close');assert.equal(cfg.translationServices.local.enableAIContext,true);assert.equal(cfg.generalRule.paragraphMinTextCount,21);
});
test('all JavaScript, HTML local scripts and default configs are valid',()=>{
 function scan(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())scan(f);else if(e.name.endsWith('.js'))acorn.parse(fs.readFileSync(f,'utf8'),{sourceType:'module',ecmaVersion:'latest'});else if(e.name.endsWith('.html'))for(const m of fs.readFileSync(f,'utf8').matchAll(/<script[^>]*\bsrc=["']([^"']+)/g))assert.ok(fs.existsSync(path.join(path.dirname(f),m[1])),m[1]);}}
 scan(extension);
 for(const n of ['default_config.json','default_config.content.json']){const c=JSON.parse(read(n));assert.equal(c.messageCenter.enable,false);assert.equal(c.generalRule.aiWriting.enable,false);assert.equal(c.generalRule.imageRule.enable,false);}
});
test('AI segmentation ships service-neutral, Magpie is an ordinary service template',()=>{
 const own=n=>fs.readFileSync(path.join(root,'scripts','segment',n),'utf8');
 assert.deepEqual(fs.readdirSync(extension).filter(n=>/magpie/i.test(n)),[],'no Magpie-only files');
 assert.equal(read('segment-background.js'),own('segment-background.js'));
 assert.ok(read('background.js').includes('importScripts("segment-background.js");'));
 // Inlined into the content bundle (terser reformats it); behaviour is covered by test-segment-adapter.cjs.
 for(const marker of ['root.ImtSegmentCore=api','globalThis.ImtSegmentLocal={begin:begin,start:start,stop:stop}','namespace:"owen-segment-v1"'])assert.ok(read('content_main.js').includes(marker),'inlined segmentation adapter: '+marker);
 for(const n of ['default_config.json','default_config.content.json']){const m=JSON.parse(read(n)).translationServices.magpie;assert.equal(m.extends,'ai');assert.equal(m.apiUrl,'http://127.0.0.1:3425/v1/chat/completions');}
 for(const n of ['background.js','content_main.js','side-panel.js'])assert.ok(read(n).includes('magpie:{ai:!0,name:"magpie"'),n+' Magpie provider');
 // The settings page offers Magpie as one of the twelve templates, with no page of its own.
 const services=fs.readFileSync(path.join(root,'ui','src','lib','services.ts'),'utf8');
 assert.match(services,/ai\("magpie", "Magpie", \{ url: "http:\/\/127\.0\.0\.1:3425\/v1\/chat\/completions"/);
 const catalog=services.slice(services.indexOf('export const TEMPLATES'),services.indexOf('const BY_TYPE'));
 assert.deepEqual([...catalog.matchAll(/(?:type: |ai\()"([\w-]+)"/g)].map(m=>m[1]).sort(),['bing','claude','custom-ai','deepl','deeplx','deepseek','gemini','google','magpie','ollama','openai','openrouter'],'twelve service templates');
});
for(const testFile of ['test-ui.cjs','test-slim.cjs','test-policy.cjs','test-local-terms.cjs','test-segment-adapter.cjs','test-segment-entry.cjs','test-unlock.cjs','test-selection.cjs']){
 const args=[path.join(__dirname,testFile)];if(testFile.includes('entry'))args.push(path.join(extension,'content_main.js'));
 const r=spawnSync(process.execPath,args,{encoding:'utf8'});process.stdout.write(r.stdout);process.stderr.write(r.stderr);assert.equal(r.status,0,testFile);
}
console.log(`PASS ${count} build integrity checks plus UI, segmentation adapter, entry, unlock and selection suites`);
