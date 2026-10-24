'use strict';
// Selection translation picks a service that exists in this build: any
// configured AI service, else the main translation service. Never the removed
// hosted "zhipu-free", and its errors carry no Pro upsell.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const {Patch}=require('../scripts/patch-lib.cjs');
const extension=path.resolve(__dirname,'..','extension');
let count=0;
const test=(name,run)=>{run();count++;console.log('PASS selection: '+name);};

for(const file of ['content_main.js','side-panel.js']){
 const p=new Patch(file,fs.readFileSync(path.join(extension,file),'utf8'));
 const chooser=p.nodes('VariableDeclarator').find(n=>n.init?.type==='ArrowFunctionExpression'&&p.text(n.init).includes('owenSelectionFallback(e)')&&p.text(n.init).includes('commonService'));
 const list=/(\w+)\(e,"translationService"/.exec(chooser?p.text(chooser.init):'')?.[1];
 const fallback=p.functions('owenSelectionFallback')[0];
 // Run the shipped chooser against a stubbed service list.
 const choose=(services,{service,translationService='bing'}={})=>{
  const ctx=vm.createContext({services});
  vm.runInContext(`${p.text(fallback)};var ${list}=()=>services;var choose=${p.text(chooser.init)};`,ctx);
  ctx.input={translationService,config:{interfaceLanguage:'zh-CN',translationService},rule:{selectionTranslation:{service,commonService:{service:'zhipu'},proService:{service:'openai'}}}};
  return vm.runInContext('choose(input)',ctx);
 };
 test(`${file} chooser is the local one`,()=>{assert.ok(chooser&&list&&fallback);});
 test(`${file} uses a configured AI service without the upstream feature flag`,()=>{
  assert.equal(choose([{id:'custom-ai-test',ai:true,config:{}},{id:'bing',ai:false,config:{}}]),'custom-ai-test');
 });
 test(`${file} prefers the main AI service over the first catalog template`,()=>{
  assert.equal(choose([{id:'magpie',ai:true,config:{}},{id:'custom-ai-test',ai:true,config:{}}],{translationService:'custom-ai-test'}),'custom-ai-test');
 });
 test(`${file} keeps the service the user picked in the card`,()=>{
  assert.equal(choose([{id:'a',ai:true,config:{}},{id:'b',ai:true,config:{}}],{service:'b'}),'b');
 });
 test(`${file} falls back to the main translation service, never zhipu-free`,()=>{
  assert.equal(choose([],{translationService:'google'}),'google');
  assert.equal(choose([{id:'bing',ai:false,config:{}}]),'bing');
 });
 test(`${file} has no hosted or feature-flag gates left`,()=>{
  assert.ok(!p.source.includes('commonService.service||"zhipu-free"'));
  assert.ok(!p.source.includes('supportFeatures?.includes("selectionTranslation")'));
 });
}

test('service-unavailable copy carries no membership upsell',()=>{
 const locales=JSON.parse(fs.readFileSync(path.join(extension,'locales.json'),'utf8'));
 for(const lang of ['en','zh-CN','zh-TW','zh-HK']){
  const text=locales[lang]['error.serveUnavailable'];
  assert.match(text,/\{serverName\}/,lang);
  assert.doesNotMatch(text,/Pro|会员|會員|升级|升級|upgrade/i,lang);
 }
});

test('screenshot area translation and all its pro membership links are completely removed',()=>{
 for(const file of ['side-panel.js','content_main.js','background.js']){
  const code=fs.readFileSync(path.join(extension,file),'utf8');
  assert.ok(!code.includes('enableAreaTransTitle'),`${file} must not contain enableAreaTransTitle`);
  assert.ok(!code.includes('enableScreenshotAreaTranslation'),`${file} must not contain enableScreenshotAreaTranslation`);
  assert.ok(!code.includes('areaTransLoginDesc'),`${file} must not contain areaTransLoginDesc`);
  assert.ok(!code.includes('areaTransLoginButton'),`${file} must not contain areaTransLoginButton`);
  assert.ok(!code.includes('areaTransSubscribeButton'),`${file} must not contain areaTransSubscribeButton`);
  assert.ok(!code.includes('screenshot-area-premium-icon'),`${file} must not contain screenshot-area-premium-icon`);
  assert.ok(!code.includes('圈选'),`${file} must not contain 圈选`);
  assert.ok(!code.includes('圈選'),`${file} must not contain 圈選`);
 }
 const locales=JSON.parse(fs.readFileSync(path.join(extension,'locales.json'),'utf8'));
 for(const lang of ['en','zh-CN','zh-TW','zh-HK']){
  const dict=locales[lang];
  assert.equal(dict['areaTrans'],undefined);
  assert.equal(dict['enableAreaTransTitle'],undefined);
  assert.equal(dict['areaTransDesc'],undefined);
  assert.equal(dict['areaTransProOnly'],undefined);
  assert.equal(dict['areaTransLoginTitle'],undefined);
  assert.equal(dict['areaTransLoginDesc'],undefined);
  assert.equal(dict['popup.simpleMode.feature.screenshot'],undefined);
  if(dict['popup.simpleMode.disabledFeatures']){
   assert.doesNotMatch(dict['popup.simpleMode.disabledFeatures'],/圈选|圈選|Area translation/);
  }
 }
});
console.log(`PASS ${count} selection checks`);
