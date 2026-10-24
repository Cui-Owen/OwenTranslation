'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');

// AI subtitle segmentation and the Magpie service.
// Magpie is one more OpenAI-compatible provider in "add custom service", like
// Ollama. Segmentation is not tied to it: the subtitle settings (ui/) pick any
// added AI service, and the page's own translator sends the request.
// Runs after every other patch: it replaces the inlined adapter at offset 0,
// which must sort after their insertions there.

const SRC=path.join(__dirname,'segment');
const MAGPIE_URL='http://127.0.0.1:3425/v1/chat/completions';
// Ink tile, white M, one vermilion gloss (brand canvas).
const MAGPIE_ICON='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#15171C"/><path d="M17 45V20l15 15 15-15v25" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="49" cy="15" r="4" fill="#D43D25"/></svg>');
const MAGPIE_SERVICE={extends:'ai',name:'Magpie',model:'auto/gemini-3.8-flash',models:'auto/gemini-3.8-flash',provider:'custom',limit:5,apiUrl:MAGPIE_URL,APIKEY:'magpie',enableRichTranslate:true,dualEnableRichTranslate:false,translationEnableRichTranslate:true};

function owenAISegmentRequest(ctx,service,lang,system,user,signal){
 return jo({service},{...ctx,usageScene:"subtitle"}).then(translator=>{
  if(!translator?.isAI||!translator.supportsGeneralAIMessage)throw new Error("AI segmentation needs an AI service");
  return translator.sendMessage({systemPrompt:system,userPrompt:user,from:lang||"auto",to:ctx.targetLanguage,signal});
 });
}

module.exports=ctx=>{
 const upstream=n=>fs.readFileSync(path.join(__dirname,'..','upstream',n),'utf8');
 const own=n=>fs.readFileSync(path.join(SRC,n),'utf8');

 // 1. Content: swap the inlined Magpie adapter for the service-neutral one.
 const c=ctx.file('content_main.js');
 const prefix=upstream('magpie-core.js')+'\n'+upstream('magpie-content.js')+'\n';
 assert.ok(c.source.startsWith(prefix),'content_main.js: inlined Magpie adapter');
 c.replace(0,prefix.length,own('segment-core.js')+'\n'+own('segment-content.js')+'\n'+owenAISegmentRequest.toString()+'\n','segment: service-neutral adapter');
 c.once('globalThis.ImtMagpieLocal.begin(this)','globalThis.ImtSegmentLocal.begin(this)','segment: session gate');
 c.once('globalThis.ImtMagpieCore.units(__events)','globalThis.ImtSegmentCore.units(__events)','segment: unit check');
 c.once('globalThis.ImtMagpieLocal.start(this,__events,a,i,__ml,{','globalThis.ImtSegmentLocal.start(this,__events,a,i,__ml,{\n   request:(system,user,signal)=>owenAISegmentRequest(this.ctx,__ml.service,a,system,user,signal),','segment: request through selected service');
 c.once('k.magpie?globalThis.ImtMagpieCore.reconcile(i.current,k.subtitleItems):QSe(i.current,k.subtitleItems),k.magpie&&','k.aiSegment?globalThis.ImtSegmentCore.reconcile(i.current,k.subtitleItems):QSe(i.current,k.subtitleItems),k.aiSegment&&','segment: renderer reconciliation');

 // 2. Background keeps only the boundary cache.
 ctx.file('background.js').once('importScripts("magpie-core.js", "magpie-background.js");','importScripts("segment-background.js");','segment: cache worker');

 // 3. Magpie provider next to Ollama in every bundle: service metadata (add
 // dialog and settings form), translator class and icon.
 for(const name of ['background.js','content_main.js','side-panel.js']){
  const p=ctx.file(name),seen={meta:0,cls:0,icon:0};
  for(const o of p.nodes('ObjectExpression'))for(const prop of o.properties){
   if((prop.key?.name??prop.key?.value)!=='ollama')continue;
   const v=prop.value;let add;
   if(v.type==='ObjectExpression'){
    // The Custom AI field builder that Ollama's metadata spreads in.
    const base=v.properties[0]?.argument?.name,def=p.nodes('AssignmentExpression').filter(n=>n.left.name===base&&n.right.type==='ObjectExpression');
    assert.equal(def.length,1,`${name}: Ollama metadata base`);
    const fields=def[0].right.properties.find(x=>(x.key?.name)==='allProps')?.value?.callee?.name;
    assert.ok(fields,`${name}: AI field builder`);
    add=`magpie:{ai:!0,name:"magpie",homepage:"",allProps:${fields}({authOptions:[{name:"apiUrl",direction:"column",labelKey:"field.apiUrl",required:!1,type:"text",default:${JSON.stringify(MAGPIE_URL)},providers:["custom"]},{name:"APIKEY",required:!1,type:"password",sensitive:!0,direction:"column",default:"magpie",providers:["custom"]}]})}`;seen.meta++;
   }else if(v.type==='Identifier'){add=`magpie:${v.name}`;seen.cls++;}
   else if(v.type==='Literal'&&String(v.value).startsWith('data:image/')){add=`magpie:${JSON.stringify(MAGPIE_ICON)}`;seen.icon++;}
   else assert.fail(`${name}: unexpected Ollama entry ${v.type}`);
   p.replace(prop.end,prop.end,','+add,'segment: Magpie provider');
  }
  assert.equal(seen.meta,1,`${name}: Magpie metadata`);
  assert.equal(seen.cls,1,`${name}: Magpie translator class`);
 }

};

module.exports.finish=dest=>{
 for(const name of fs.readdirSync(dest))if(name.startsWith('magpie-'))fs.rmSync(path.join(dest,name),{force:true});
 fs.copyFileSync(path.join(SRC,'segment-background.js'),path.join(dest,'segment-background.js'));
 for(const name of ['default_config.json','default_config.content.json']){
  const file=path.join(dest,name),config=JSON.parse(fs.readFileSync(file,'utf8'));
  assert.ok(config.translationServices?.ollama&&!config.translationServices.magpie,name+': service templates');
  config.translationServices.magpie={...MAGPIE_SERVICE};
  config.translationServices['magpie-custom']={
   name:'Magpie',
   type:'magpie',
   group:'custom',
   provider:'custom',
   extends:'magpie',
   apiUrl:MAGPIE_URL,
   APIKEY:'magpie',
   model:'auto/gemini-3.8-flash',
   models:'auto/gemini-3.8-flash',
   visible:true,
   enableImtServe:false
  };
  fs.writeFileSync(file,JSON.stringify(config)+'\n');
 }
 const lFile=path.join(dest,'locales.json');
 if(fs.existsSync(lFile)){
  const locales=JSON.parse(fs.readFileSync(lFile,'utf8'));
  for(const lang of Object.keys(locales)){
   locales[lang]['translationServices.magpie']='Magpie';
  }
  fs.writeFileSync(lFile,JSON.stringify(locales)+'\n');
 }
};

module.exports.MAGPIE_ICON=MAGPIE_ICON;
