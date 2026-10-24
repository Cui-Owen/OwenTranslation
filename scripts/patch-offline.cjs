'use strict';
const fs=require('node:fs'),path=require('node:path');
// No original-vendor content, configuration, model gateway or asset leaves this build.
function owenVendorUrl(value) {
 try {return /(^|\.)(immersivetranslate\.(?:com|cn)|imtintl\.com|immersive-translate\.owen\.invalid)$/i.test(new URL(String(value),globalThis.location?.href).hostname);} catch {return false;}
}
function owenOfflineResource(value) {
 if(!owenVendorUrl(value))return undefined;
 const url=new URL(String(value));
 if(/\/default_config(?:\.content)?\.json$/.test(url.pathname))return {kind:'config'};
 if(/\/tags-config\.json$/.test(url.pathname))return {value:{tagsVersion:'owen-local',tags:{}}};
 if(/\/dynamic-i18n\.json$/.test(url.pathname))return {value:{dynamicI18nVersion:'owen-local',locales:{}}};
 if(/\/plugins\/meta\.json$/.test(url.pathname))return {value:{plugins:{}}};
 if(/\/terms\/meta\/index\.json$/.test(url.pathname))return {value:[]};
 return {retired:true};
}
const map={
 'background.js':{api:'Y',transport:'Ye',cache:'H3',i18n:['u3','Rv'],experts:['OV','jV']},
 'side-panel.js':{api:'lt',transport:'rt',cache:'rM',i18n:['lM','uM'],experts:['kve','rG','Pve'],probe:'fye'},
 'content_main.js':{api:'tt',transport:'it',cache:'SI',i18n:['xL','CC'],experts:['NDe','IY','UDe'],probe:'HPe'}
};
module.exports=ctx=>{
 for(const [name,m]of Object.entries(map)){
  const p=ctx.file(name);
  function available(n){return !p.edits.some(e=>e.start<n.end&&e.end>n.start)}
  function body(fn,text,label){const n=p.function(fn);if(!available(n))throw new Error(name+' offline overlap '+fn);p.body(fn,text,label)}
  p.replace(0,0,owenVendorUrl.toString()+'\n'+owenOfflineResource.toString()+'\n','local resource boundary');
  const tr=p.function(m.transport);
  p.replace(tr.body.start+1,tr.body.start+1,`const owenResource=owenOfflineResource(e.url);if(owenResource){if(owenResource.retired)return Promise.reject(new Error('此服务已移除，请选择直连服务'));if(owenResource.kind==='config')return fetch(${m.api}.runtime.getURL('default_config.json')).then(r=>r.json());return Promise.resolve(owenResource.value);}`,'resolve retired vendor resources without network');
  body(m.cache,'return undefined;','ignore cached upstream builtin configuration');
  for(const f of m.i18n)body(f,'return null;','disable dynamic upstream locale overlay');
  for(const f of m.experts){let n=p.function(f),s=p.text(n);body(f,s.includes('Promise.allSettled')?'return;':'return {};','remove online expert directory');}
  if(m.probe)body(m.probe,'return null;','remove original-vendor connectivity check');
  for(const n of p.nodes('FunctionDeclaration')){
   const s=p.text(n);if(!available(n))continue;
   if(s.includes('invalid tags-config payload'))p.body(n.id.name,'return;','remove remote campaign tags');
   else if(s.includes('/connectivity_check')&&s.includes('hostName:')&&n.params.length===4)p.body(n.id.name,'return {hostName:e[0],ext1:false};','remove managed hostname probes');
   else if(s.includes('managed host acceleration probe failed'))p.body(n.id.name,'return {hostName:e,ext1:false};','remove managed acceleration probes');
  }
 }
 const bg=ctx.file('background.js');
 bg.replace(0,0,`{const originalFetch=globalThis.fetch.bind(globalThis);globalThis.fetch=(input,init)=>{const url=typeof input==='string'||input instanceof URL?String(input):input.url;if(owenVendorUrl(url))return Promise.reject(new Error('原厂网络服务已移除'));return originalFetch(input,init);};}\n`,'service-worker original-vendor network boundary');
};
module.exports.finish=dest=>{
 const locales=JSON.parse(fs.readFileSync(path.join(dest,'locales.json'),'utf8'));
 fs.writeFileSync(path.join(dest,'locales.json'),JSON.stringify(Object.fromEntries(['en','zh-CN','zh-TW','zh-HK'].map(k=>[k,locales[k]])))+'\n');
 const dir=path.join(dest,'_locales');for(const name of fs.readdirSync(dir))if(!['en','zh_CN','zh_TW','zh_HK'].includes(name))fs.rmSync(path.join(dir,name),{recursive:true,force:true});
};
