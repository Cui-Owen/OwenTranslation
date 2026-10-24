'use strict';
// Runs the released functions for each local feature that membership used to gate.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const {Patch}=require('../scripts/patch-lib.cjs');
const extension=path.resolve(__dirname,'..','extension');
const bundle=name=>new Patch(name,fs.readFileSync(path.join(extension,name),'utf8'));
const c=bundle('content_main.js');
const ui=n=>fs.readFileSync(path.resolve(__dirname,'..','ui','src',n),'utf8');
const fn=(p,name)=>p.text(p.function(name));
const tests=[];
const test=(name,run)=>tests.push([name,run]);

test('YouTube live subtitles continue past the old one-minute trial',()=>{
 const methods=c.nodes('MethodDefinition').filter(n=>n.key?.name==='checkLiveSubtitleTrialLimit');
 assert.equal(methods.length,2);
 const ctx=vm.createContext({});
 for(const n of methods){
  vm.runInContext(`live={${c.text(n)}};subject={ctx:{isPro:false,rule:{subtitleRule:{}}},liveFreeStartTime:1,showLiveSubtitleTip(){throw Error("tip")},i18nFormat:k=>k};`,ctx);
  assert.equal(vm.runInContext('live.checkLiveSubtitleTrialLimit.call(subject)',ctx),true);
 }
 assert.ok(!c.source.includes('e.isLive&&!s.isPro'),'live upgrade menu item');
});

test('article terminology is effective without membership, business conditions kept',()=>{
 const ctx=vm.createContext({});
 vm.runInContext(`${fn(c,'Cc')}\nJe=()=>({any:false});tUe=()=>true;Z6=x=>x;foe=(u,m)=>m.includes("*");gh=()=>({});Ss=x=>x;`,ctx);
 const base='{isPro:false,config:{translationServices:{openai:{aiBatch:{mode:"recommended"}}},rawUserConfig:{articleTerminologyMatches:["*"]}},translationService:"openai",url:"https://x.test"}';
 const free=vm.runInContext(`Cc(${base})`,ctx);
 assert.equal(free.available,true);assert.equal(free.effective,true);assert.equal(free.isPro,true);
 assert.equal(vm.runInContext(`e=${base};e.config.rawUserConfig.enableArticleTerminology=false;Cc(e).effective`,ctx),false);
 assert.equal(vm.runInContext(`e=${base};e.config.rawUserConfig.articleTerminologyMatches=[];Cc(e).effective`,ctx),false);
 assert.equal(vm.runInContext(`tUe=()=>false;Cc(${base}).effective`,ctx),false);
 for(const name of ['background.js','content_main.js','side-panel.js'])assert.ok(!/effective:\w+&&e\.isPro===!0/.test(fs.readFileSync(path.join(extension,name),'utf8')),name);
 for(const name of ['content_main.js','side-panel.js'])assert.ok(!/\.isPro!==!0\)return \w+\(\{key:"user_need_pro",ctx:\w+,params:\{trigger:"article_terminology_side_panel"/.test(fs.readFileSync(path.join(extension,name),'utf8')),name);
 // The settings page (ui/) offers the three terminology switches without any membership condition.
 const terms=ui('options/sections/terms.tsx');
 for(const key of ['enableArticleTerminology','showArticleTerminologyExtractionResults','showArticleTerminologyHighlights','articleTerminologyMatches'])assert.ok(terms.includes(key),key);
 assert.doesNotMatch(terms,/isPro|user_need_pro/);
});

test('subtitle download serializes captured cues locally without membership',()=>{
 const ctx=vm.createContext({});
 vm.runInContext(fn(c,'owenSubtitleFile'),ctx);
 ctx.items=[{start:1.5,end:3.25,text:'Hello\r\nworld',translation:'你好世界'},{start:'00:01:02.005',end:'00:01:04.5',text:'Untranslated'},{start:5,end:6,text:'  '}];
 const run=(mode,format)=>vm.runInContext(`owenSubtitleFile(items,${JSON.stringify(mode)},${JSON.stringify(format)})`,ctx);
 assert.equal(run('both','srt'),'1\n00:00:01,500 --> 00:00:03,250\nHello\nworld\n你好世界\n\n2\n00:01:02,005 --> 00:01:04,500\nUntranslated\n');
 assert.equal(run('target','vtt'),'WEBVTT\n\n00:00:01.500 --> 00:00:03.250\n你好世界\n\n00:01:02.005 --> 00:01:04.500\nUntranslated\n');
 assert.equal(run('source','srt').split('\n\n')[0],'1\n00:00:01,500 --> 00:00:03,250\nHello\nworld');
 const xhe=fn(c,'Xhe'),wdt=fn(c,'Wdt');
 assert.ok(xhe.includes('owenSubtitleExport(t)')&&!xhe.includes('DOWNLOAD_SUBTITLE_URL'),'export stays in page');
 assert.ok(!wdt.includes('await Ga()')&&!wdt.includes('loginOrUpgradeByDownloadSubtitle'),'download handler membership gate');
});

test('AI context summary parser accepts common model output shapes',()=>{
 const ctx=vm.createContext({});
 vm.runInContext(fn(c,'owenParseAIContext'),ctx);
 const parse=raw=>vm.runInContext(`owenParseAIContext(${JSON.stringify(raw)})`,ctx);
 assert.deepEqual({...parse('```json\n{"theme":"T","terms":"A: 甲\\nB: 乙","style_guide":"S"}\n```')},{theme:'T',terms:'A: 甲\nB: 乙',style_guide:'S'});
 assert.equal(parse('Here: {"theme":"T","terms":[{"source":"A","target":"甲"},"B: 乙"]}').terms,'A: 甲\nB: 乙');
 assert.equal(parse('{"theme":"","terms":{"A":"甲"},"styleGuide":"S"}').terms,'A: 甲');
 assert.throws(()=>parse('no json'));
 assert.throws(()=>parse('{"theme":"","terms":""}'));
});

test('AI context generates new summaries with the selected service and no account',async()=>{
 const ctx=vm.createContext({Map,AbortSignal,Object,Error,JSON,Math,Number});
 vm.runInContext(`${fn(c,'ip')}\n${fn(c,'owenAIContextSummary')}\n${fn(c,'owenParseAIContext')}\n${fn(c,'nFe')}\n${fn(c,'qb')}\n
  U6=undefined;s_=false;l_=false;Zre="";o_=undefined;rp=1;Yre=0;j6="initial";Kre=false;a_=new Map();snap=undefined;
  eFe=()=>1;i_=x=>{snap=x;return true};Wre=()=>{};tFe=()=>true;eie=()=>true;n3=async()=>"hash";Jre=(f,l)=>f+l;Tt=async()=>"en";q={BASE_API:"https://retired.invalid/"};
  official=[];it=async x=>{official.push(x);return {}};calls=[];factory=[];
  translator={isAI:true,supportsGeneralAIMessage:true,async sendMessage(x){calls.push(x);return '{"theme":"主题","terms":"Magpie: 喜鹊","style_guide":"口语"}'}};
  jo=async(a,b)=>{factory.push([a,b.usageScene]);return translator};
  e={isPro:false,isMax:false,targetLanguage:"zh-CN",usageScene:"web_page",rule:{bodyRule:{contextTimeout:4000}},config:{translationServices:{openai:{enableAIContext:true}}}};`,ctx);
 const result=await vm.runInContext('ip(e,"openai","Article body")',ctx);
 assert.equal(result.terms.theme,'主题');
 assert.equal(result.terms.terms.Magpie,'喜鹊');
 assert.equal(result.terms.styleGuide,'口语');
 assert.equal(vm.runInContext('official.length',ctx),0);
 assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(factory)',ctx)),[[{service:'openai'},'ai_context']]);
 const call=vm.runInContext('calls[0]',ctx);
 assert.ok(call.systemPrompt.includes('zh-CN')&&!call.systemPrompt.includes('{{to}}'));
 assert.ok(call.userPrompt.endsWith('Article body'));
 assert.equal(await vm.runInContext('e.config.translationServices.openai.enableAIContext=false;ip(e,"openai","Other")',ctx),undefined);
 assert.equal(await vm.runInContext('e.config.translationServices.openai.enableAIContext=true;translator.isAI=false;calls.length=0;ip(e,"openai","Third")',ctx),undefined);
 assert.equal(vm.runInContext('calls.length+official.length',ctx),0);
});

test('AI context and subtitle prompt settings are editable',()=>{
 assert.ok(!fn(c,'Crt').includes('e.isPro'),'Crt');
 // Service form (ui/) exposes both fields for every AI template; segmentation picks any AI service.
 const services=ui('lib/services.ts'),subtitle=ui('options/sections/subtitle.tsx');
 for(const field of ['enableAIContext','subtitlePrompt','aiBatch.mode'])assert.ok(services.includes(`name: "${field}"`),field);
 assert.match(subtitle,/aiSegmentService/);assert.doesNotMatch(subtitle,/aiEnable: true|isPro/);
});

(async()=>{
 for(const [name,run] of tests){await run();console.log('PASS unlock: '+name);}
 console.log(`PASS ${tests.length} local unlock checks`);
})().catch(e=>{console.error(e);process.exit(1);});
