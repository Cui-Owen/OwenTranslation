const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const acorn=require('acorn'),walk=require('acorn-walk');
const C=require('../scripts/segment/segment-core.js');
const filename=process.argv[2] || 'extension/content_main.js';const code=fs.readFileSync(filename,'utf8');
const a=code.indexOf('async loadSubtitle({input:t,responseText:n,skipYoutubeTranslatedSubtitle:r=!1,expectedVideoId:i})');
assert.ok(a>0);const b=code.indexOf('attachSubtitle(t,n,r=!1,i,o=!1){',a);assert.ok(b>a);
const method=code.slice(a,b), events=[{tStartMs:0,dDurationMs:2000,segs:[{utf8:'Hello world.'}]}];
async function run({local,pro=true,stale=false,empty=false}){
 const calls={local:0,official:0,base:0,attach:0,meta:0,request:[]};
 const host={ctx:{targetLanguage:'zh-CN',isPro:pro,rule:{ytAsrConfig:{enable:true,aiEnable:true,aiSupportLanguages:['en']}}},config:{preTranslation:true},sourceSubtitleMap:new Map(),
 inject:{getVideoMeta:async()=>{calls.meta++;return null;}},getLangCodeFromSubtitleUrl:()=> 'en',requestOriginalEvents:async()=>empty?[]:events,requestServerMerge:()=>calls.official++,attachSubtitle:()=>calls.attach++,isYoutubeSubtitleRequestCurrent:async()=>true,hideSubtitleLoading:()=>{},requestOriginalSubtitle:async()=>[{text:'Fallback'}],mergeSelfSubtitle:x=>x,getSpaceWithLang:()=> ' ',requestHumanSubtitle:async x=>x,requestYoutubeTranslateSubtitle:async x=>x,formatToSubtitleItem:x=>x};
 const context={globalThis:{ImtSegmentLocal:{begin:async()=>({enabled:local,stale,service:'magpie-a1'}),start:async(h,e,lang,id,run,hooks)=>{assert.equal(h,host);assert.equal(lang,'en');assert.equal(run.enabled,true);calls.local++;await hooks.request('sys','usr','signal');}},ImtSegmentCore:C,location:{href:'https://www.youtube.com/watch?v=fixture'}},
  owenAISegmentRequest:(...args)=>{calls.request.push(args);return Promise.resolve('{"ends":[0]}');},
  vn:()=>false,Vc:()=>false,We:x=>x,lCe:()=>true,sCe:()=>{calls.base++;return [{start:0,end:2,text:'Fallback'}];},cCe:({items})=>items,I:{error:e=>{throw e;}}};
 const load=vm.runInNewContext('({'+method+'}).loadSubtitle',context);
 await load.call(host,{input:'https://www.youtube.com/api/timedtext?kind=asr',expectedVideoId:'fixture'});
 await new Promise(r=>setImmediate(r));return {calls,host};
}
// The request adapter at the top of the bundle, run against a scripted translator factory.
function adapter(){
 const ast=acorn.parse(code,{ecmaVersion:'latest',sourceType:'module'});let fn;
 walk.simple(ast,{FunctionDeclaration(n){if(n.id.name==='owenAISegmentRequest')fn=n;}});assert.ok(fn,'owenAISegmentRequest in bundle');
 return code.slice(fn.start,fn.end);
}
(async()=>{
 const {calls:free,host}=await run({local:true,pro:false});assert.equal(free.local,1);
 assert.deepEqual(free.request,[[host.ctx,'magpie-a1','en','sys','usr','signal']]);
 const member=(await run({local:true,pro:true})).calls;assert.equal(member.local,1);assert.equal(member.official,0);assert.equal(member.base,0);
 const official=(await run({local:false,pro:true})).calls;assert.equal(official.official,0);assert.equal(official.local,0);assert.equal(official.base,1);
 const off=(await run({local:false,pro:false})).calls;assert.equal(off.official,0);assert.equal(off.base,1);
 const stale=(await run({local:true,stale:true})).calls;assert.equal(stale.meta,0);assert.equal(stale.local,0);
 const empty=(await run({local:true,empty:true})).calls;assert.equal(empty.official,0);assert.equal(empty.attach,1);
 assert.ok(code.includes('k.aiSegment?globalThis.ImtSegmentCore.reconcile(i.current,k.subtitleItems):QSe(i.current,k.subtitleItems)'));
 assert.ok(!/ImtMagpie|imt-magpie|imtMagpieSettingsV1/.test(code),'retired Magpie-only adapter left in bundle');
 const seen=[],source=adapter();
 const make=translator=>vm.runInNewContext(`(${source})`,{jo:async(...args)=>{seen.push(args);return translator;}});
 const sent=[];const ai={isAI:true,supportsGeneralAIMessage:true,sendMessage:async x=>{sent.push(x);return 'reply';}};
 const ctx={targetLanguage:'zh-CN',config:{}};
 assert.equal(await make(ai)(ctx,'magpie-a1','en','S','U','sig'),'reply');
 assert.equal(JSON.stringify(seen[0][0]),'{"service":"magpie-a1"}');assert.equal(seen[0][1].usageScene,'subtitle');assert.equal(seen[0][1].targetLanguage,'zh-CN');
 assert.equal(JSON.stringify(sent[0]),JSON.stringify({systemPrompt:'S',userPrompt:'U',from:'en',to:'zh-CN',signal:'sig'}));
 await assert.rejects(make({isAI:false,sendMessage:async()=>'x'})(ctx,'bing','en','S','U'),/AI service/);
 console.log('PASS 9 installed-bundle entry assertions: selected-service route, request through the page translator, retired official route and basic fallback, stale guard, empty fallback, scoped renderer reconciliation, non-AI service refused');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
