'use strict';
const assert=require('node:assert/strict');
const retired='throw new Error("此服务已移除，请配置直连翻译服务");';
const disabled='return {ok:false,code:"account_removed",message:"账号服务已移除",retryable:false};';
const bundles={
 'background.js':{settings:['sne','une'],sync:'g_',token:'Aa',detect:['YG','ZG','Rg']},
 'content_main.js':{settings:['Ane','POe'],sync:'f6',token:'$l',detect:['GRe','jX','M0','HX']},
 'side-panel.js':{settings:['hW','sSe'],sync:'hT',token:'js',detect:['_Te','_H','jm','NH']}
};
module.exports=ctx=>{
 for(const [name,m]of Object.entries(bundles)){
  const p=ctx.file(name);
  // Every replacement is registered against the original shipped AST. Whole
  // function replacements take precedence over children in this module.
  const covered=[];
  const inside=n=>covered.some(r=>r.start<=n.start&&r.end>=n.end);
  function replace(n,text,label){
   if(inside(n))return;
   assert.ok(!p.edits.some(e=>e.start<n.end&&e.end>n.start),name+': account overlap '+label);
   p.replace(n.start,n.end,text,label);covered.push(n);
  }
  function fn(id,body,label){const n=p.function(id);replace(n.body,'{'+body+'}',label);}
  function method(n,body,label){replace(n.value.body,'{'+body+'}',label);}
  const wrappers=p.nodes('ObjectExpression').filter(n=>{
   const keys=n.properties.map(x=>x.key?.name||x.key?.value);
   return keys.includes('getUserInfo')&&keys.includes('getUserToken');
  });
  assert.equal(wrappers.length,1,name+': account storage wrapper');
  const props=new Map(wrappers[0].properties.map(n=>[n.key?.name||n.key?.value,n.value]));
  for(const [key,body]of Object.entries({getUserInfo:'return null;',getCachedUserInfo:'return null;',saveUserInfo:'return null;',getUserToken:'return "";',setUserToken:'return;'})){
   const n=props.get(key);assert.equal(n?.type,'Identifier');fn(n.name,body,'retire account storage '+key);
  }
  for(const id of m.settings)fn(id,'return null;','remove cloud settings request');
  fn(m.sync,'return false;','disable cloud settings synchronization');
  fn(m.token,retired,'remove bundled service token provisioning');
  for(const id of m.detect)fn(id,id===m.detect[0]?'return "";':'return null;','use existing local language detection fallback');
  // This is the shared provider switch. Custom keys, direct HTTP error handling,
  // and service-specific response decoding retain their original code.
  let initCount=0;
  for(const n of p.nodes('MethodDefinition')){
   const key=n.key?.name,s=p.text(n);
   if(key==='initPro'){
    method(n,'if(t.provider==="pro"){'+retired+'}this.provider="custom";if(t.temperature!==undefined)this.temperature=parseFloat(t.temperature);','retire official provider branch');initCount++;
   }else if(key==='handleProOptions')method(n,retired,'reject retired official translation request');
   else if((key==='getAPIKey'||key==='getProTrialApiKey')&&/silicon\/get-token|big-model\/get-(?:token|glm45air-token)/.test(s))method(n,retired,'remove official free/trial token issuance');
  }
  assert.equal(initCount,1,name+': provider switch');
  // Dedicated API helpers, never local term persistence or general transport.
  for(const n of p.nodes('FunctionDeclaration')){
   if(inside(n.body))continue;
   const s=p.text(n);
   if(s.length>1800)continue;
   if(/\.get\("v1\/user\/glossary-meta"\)/.test(s))fn(n.id.name,'return {list:[],syncTimestamp:""};','remove cloud glossary index');
   else if(/\.get\(`v1\/user\/glossary-config\//.test(s))fn(n.id.name,retired,'remove cloud glossary content and revisions');
   else if(/\.get\("v1\/user"\)/.test(s)&&s.includes('.saveUserInfo('))fn(n.id.name,'return null;','remove account refresh');
   else if(s.includes('"agreements/consent"'))fn(n.id.name,'return;','remove original account agreement registration');
   else if(s.includes('"meta/index.json"')&&s.includes('fetch('))fn(n.id.name,'return [];','remove public glossary online index');
   else if(s.includes('getRemoteTermsMeta:')&&s.includes('saveTermsSnapshot:'))fn(n.id.name,'return [];','stop remote glossary automatic replacement');
   else if(s.includes('fetch(e+`meta/${t}.json`)'))fn(n.id.name,'return null;','remove public glossary remote metadata');
   else if(s.includes('glossaries/${t}_${a}.csv?hash='))fn(n.id.name,'return [];','remove public glossary CSV download');
   else if(s.includes('langsHash:')&&s.includes('n.langsHash?.')&&s.includes('glossaries:'))fn(n.id.name,'return {glossaries:[],langsHash:{}};','remove public glossary language download');
  }
  // Remove the original website's privileged account bridge while leaving the
  // ordinary extension message bus and local options editor intact.
  for(const type of ['IfStatement','ConditionalExpression'])for(const n of p.nodes(type)){
   const s=p.text(n.test);if(!/\.type\s*={2,3}\s*["'](?:getOrCreatePkceChallengeAsync|submitPkceAuthCodeAsync|syncUserLoginSetting|updateUserInfo|getAsyncUserInfo|getAsyncAllTerms|getAsyncGlossaries)["']/.test(s)||inside(n.consequent))continue;
   const result=s.includes('syncUserLoginSetting')?'void 0':s.includes('Pkce')?'i={ok:false,code:"account_removed",retryable:false}':/getAsyncAllTerms|getAsyncGlossaries/.test(s)?'i=[]':'i=null';
   replace(n.consequent,type==='IfStatement'?'{'+result+';}':result,'remove original website account bridge');
  }
 }
 const p=ctx.file('background.js');
 p.body('rk',disabled,'remove PKCE challenge creation');
 p.body('nk',disabled,'remove PKCE token exchange');
 p.body('oK','return null;','remove login token/user bootstrap');
 p.body('Fw','return null;','remove cloud glossary reconciliation read');
 p.body('Uw','return async()=>"not_needed";','remove cloud glossary upload adapter');
 p.body('Y3','return;','remove cloud glossary deletion');
 p.body('Hw',retired,'remove cloud glossary revision adapter');
 // Old remote rollback records remain as data; they cannot block local edits or
 // restore remote snapshots. Local CAS, locks, intents and history are preserved.
 p.body('eE','return {assertWriteAllowed:async()=>{},rollback:async()=>({status:"rejected",error:"cloud_glossary_removed"}),recover:async()=>({status:"cancelled"}),getState:async()=>null};','detach remote rollback state from local editor');
 for(const n of p.nodes('IfStatement'))if(/r==="(?:applySyncedTermsIfClean|uploadSyncedTermsIfClean)"/.test(p.text(n.test)))p.replace(n.consequent.start,n.consequent.end,'{return false;}','retire stale cloud glossary mutation RPC');
 const coordinator=p.nodes('VariableDeclarator').find(n=>n.id.name==='Hi');
 assert.ok(coordinator?.init?.arguments?.[0]?.type==='ObjectExpression');
 for(const n of coordinator.init.arguments[0].properties){
  const key=n.key?.name;if(key==='canSync')p.replace(n.value.start,n.value.end,'async()=>false','local glossary coordinator has no cloud sync');
  if(key==='getSyncSource')p.replace(n.value.start,n.value.end,'async()=>null','local glossary coordinator has no account owner');
 }
 const c=ctx.file('content_main.js');
 const falseMethods=new Set(['getIsEnableAiSubtitle','hasAiSubtitleQuota','useAiSubtitleServerCacheByUrl','autoUseAiSubtitleByUrl']);
 const noMethods=new Set(['fetchAiSubtitleCache','createNormalTask','createPowerUserTrialTask','toggleAiSubtitle','startAiSubtitlePowerUserTrial','pollTaskStatus','requestServerMerge']);
 for(const n of c.nodes('MethodDefinition')){
  const k=n.key?.name;
  if(falseMethods.has(k)||noMethods.has(k))c.replace(n.value.body.start+1,n.value.body.end-1,falseMethods.has(k)?'return false;':'return null;','remove official ASR/pretranslation '+k);
 }
 const pre=c.nodes('VariableDeclarator').filter(n=>n.init?.type==='LogicalExpression'&&c.text(n.init).includes('.aiEnable')&&c.text(n.init).includes('.isPro'));
 assert.equal(pre.length,1,'YouTube official pretranslation switch');
 c.replace(pre[0].init.start,pre[0].init.end,'false','keep Magpie and local subtitle preparation without official pretranslation');
};
