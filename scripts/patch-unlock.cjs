'use strict';
const assert=require('node:assert/strict');
// Local features that the original package gated on membership. Each gate is
// removed where it decides; isPro stays false so paid server branches stay off.
// Captured items carry start/end in seconds (or clock strings) plus optional translation.
function owenSubtitleFile(items,mode,format){
 const seconds=v=>{if(typeof v==="number")return v;const p=String(v).trim().replace(",",".").split(":").map(Number);return p.some(Number.isNaN)?0:p.reduce((a,b)=>a*60+b,0);};
 const stamp=(v,sep)=>{let ms=Math.max(0,Math.round(seconds(v)*1000));const h=Math.floor(ms/36e5);ms-=h*36e5;const m=Math.floor(ms/6e4);ms-=m*6e4;const s=Math.floor(ms/1e3);ms-=s*1e3;const pad=(n,w=2)=>String(n).padStart(w,"0");return pad(h)+":"+pad(m)+":"+pad(s)+sep+pad(ms,3);};
 const clean=t=>String(t||"").replace(/\r/g,"").replace(/\n{2,}/g,"\n").trim();
 const text=x=>mode==="source"?clean(x.text):mode==="target"?clean(x.translation)||clean(x.text):[clean(x.text),clean(x.translation)].filter(Boolean).join("\n");
 const sep=format==="vtt"?".":",",cues=items.map(x=>({from:stamp(x.start,sep),to:stamp(x.end,sep),text:text(x)})).filter(c=>c.text);
 return (format==="vtt"?"WEBVTT\n\n":"")+cues.map((c,i)=>(format==="srt"?i+1+"\n":"")+c.from+" --> "+c.to+"\n"+c.text).join("\n\n")+"\n";
}
function owenSubtitleExport(data){
 const items=(data?.subtitleItems||[]).filter(x=>x&&x.text!=null);
 if(!items.length||typeof document>"u")return;
 const clean=t=>String(t||"").trim();
 const build=(mode,format)=>owenSubtitleFile(items,mode,format);
 const base=(String(data.title||"subtitle").replace(/[\\/:*?"<>|\u0000-\u001f]+/g," ").replace(/\s+/g," ").trim()||"subtitle").slice(0,120);
 const save=(mode,format)=>{const blob=new Blob(["﻿"+build(mode,format)],{type:format==="vtt"?"text/vtt;charset=utf-8":"application/x-subrip;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=base+(mode==="both"?"":"."+(mode==="source"?data.sourceLang||"source":data.targetLang||"target"))+"."+format;document.documentElement.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1e4);};
 document.getElementById("owen-subtitle-export")?.remove();
 const host=document.createElement("div");host.id="owen-subtitle-export";host.style.cssText="position:fixed;inset:0;z-index:2147483647";
 const root=host.attachShadow({mode:"open"}),translated=items.filter(x=>clean(x.translation)).length;
 root.innerHTML=`<style>.mask{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font:14px/1.5 system-ui,sans-serif}.box{background:#fff;color:#222;border-radius:10px;padding:18px 20px;min-width:280px;max-width:92vw;box-shadow:0 8px 30px rgba(0,0,0,.3)}h2{font-size:16px;margin:0 0 4px}p{margin:0 0 12px;color:#666;font-size:12px}.grid{display:grid;grid-template-columns:auto 1fr 1fr;gap:8px;align-items:center}button{border:1px solid #ccc;background:#f6f6f6;border-radius:6px;padding:6px 10px;cursor:pointer;font:inherit}button:hover{background:#ea4c89;border-color:#ea4c89;color:#fff}.close{margin-top:14px;width:100%}@media (prefers-color-scheme:dark){.box{background:#222;color:#eee}p{color:#aaa}button{background:#333;border-color:#555;color:#eee}}</style><div class="mask"><div class="box" role="dialog" aria-label="下载字幕"><h2>下载字幕</h2><p></p><div class="grid"></div><button class="close" type="button">关闭</button></div></div>`;
 root.querySelector("p").textContent=`共 ${items.length} 条，已有译文 ${translated} 条`+(translated<items.length?"；未翻译的条目在“译文”中保留原文":"");
 const grid=root.querySelector(".grid");
 for(const [mode,label]of [["both","双语"],["target","译文"],["source","原文"]]){const span=document.createElement("span");span.textContent=label;grid.appendChild(span);for(const format of ["srt","vtt"]){const b=document.createElement("button");b.type="button";b.textContent=format.toUpperCase();b.onclick=()=>save(mode,format);grid.appendChild(b);}}
 const close=()=>host.remove();
 root.querySelector(".close").onclick=close;root.querySelector(".mask").onclick=e=>{if(e.target===e.currentTarget)close();};
 document.documentElement.appendChild(host);
}
function owenParseAIContext(raw){
 let s=String(raw||"").trim().replace(/^```(?:json)?\s*/i,"").replace(/```\s*$/,"");
 const a=s.indexOf("{"),b=s.lastIndexOf("}");
 if(a<0||b<a)throw new Error("AI context response is not JSON");
 const o=JSON.parse(s.slice(a,b+1)),str=v=>typeof v==="string"?v.trim():"";
 let terms=o.terms;
 if(Array.isArray(terms))terms=terms.map(x=>typeof x==="string"?x:x&&typeof x==="object"?[x.source??x.term??x.original,x.target??x.translation].filter(Boolean).join(": "):"").filter(Boolean).join("\n");
 else if(terms&&typeof terms==="object")terms=Object.entries(terms).map(([k,v])=>k+": "+v).join("\n");
 const result={theme:str(o.theme),terms:str(terms),style_guide:str(o.style_guide??o.styleGuide)};
 if(!result.theme&&!result.terms)throw new Error("AI context response is empty");
 return result;
}
const contextPrompt='You prepare context for translating a web article into {{to}}. Read the article and reply with exactly one JSON object and nothing else, no Markdown: {"theme": one or two sentences in {{to}} describing the topic, "terms": up to 20 important names or domain terms, one per line as "source term: {{to}} translation", "style_guide": one or two sentences in {{to}} on tone and register for the translation}.';
module.exports=ctx=>{
 const regex=(p,re,fn,label,expected)=>{
  let count=0;for(const m of p.source.matchAll(re)){const t=fn(m);p.replace(m.index,m.index+m[0].length,t,label);count++;}
  assert.equal(count,expected,`${p.name}: ${label} count ${count}`);
 };
 const scoped=(p,name,type,pred)=>{const out=[];ctx.walk.simple(p.function(name).body,{[type](n){if(pred(n,p.text(n)))out.push(n);}});return out;};
 const one=(a,label)=>{assert.equal(a.length,1,label+': '+a.length);return a[0];};
 const c=ctx.file('content_main.js');

 // 1. YouTube live: the one-minute timer was a client policy, not a quota.
 const live=c.nodes('MethodDefinition').filter(n=>n.key?.name==='checkLiveSubtitleTrialLimit'&&c.text(n).includes('liveFreeStartTime'));
 one(live,'YouTube live trial');
 c.replace(live[0].value.body.start+1,live[0].value.body.end-1,'return !0;','unlock: YouTube live subtitles without time limit');
 c.once('Z.key==="upgradePro"?s.rule.subtitleRule.allowFreeUserLive?!1:e.isLive&&!s.isPro:','Z.key==="upgradePro"?!1:','unlock: hide live upgrade menu item');
 c.once('f=s&&!t.isPro&&a==="home"&&!t.rule.subtitleRule.allowFreeUserLive;','f=!1;','unlock: hide live members-only header');

 // 2. Article terminology extraction: membership leaves the effective state;
 // protocol, batch mode, URL, user switch and per-visit switch still apply.
 for(const name of ['background.js','content_main.js','side-panel.js']){
  const p=ctx.file(name);
  regex(p,/effective:(\w+)&&e\.isPro===!0&&/g,m=>`effective:${m[1]}&&`,'unlock: article terminology effective',1);
  regex(p,/isPro:e\.isPro===!0,userEnabled:/g,()=>'isPro:!0,userEnabled:','unlock: article terminology eligibility',1);
 }
 for(const p of [c,ctx.file('side-panel.js')]){
  regex(p,/if\((\w+)\.isPro!==!0\)return (\w+)\(\{key:"user_need_pro",ctx:\1,params:\{trigger:"article_terminology_side_panel"\}\}\)/g,m=>m[0].replace(`${m[1]}.isPro!==!0`,'!1'),'unlock: article terminology side panel toggle',1);
  regex(p,/isPro:(\w+)\.isPro===!0,onToggleArticleTerminology:/g,()=>'isPro:!0,onToggleArticleTerminology:','unlock: article terminology side panel state',1);
 }

 // 3. Subtitle download: build the files from the captured cache in the page.
 const member=one(scoped(c,'Wdt','IfStatement',(n,t)=>c.text(n.test)==='!await Ga()'),'subtitle download membership');
 c.replace(member.start,member.end,'','unlock: subtitle download without membership');
 const open=one(scoped(c,'Xhe','ExpressionStatement',(n,t)=>t.includes('DOWNLOAD_SUBTITLE_URL')),'subtitle download page');
 c.replace(open.start,open.end,'owenSubtitleExport(t);','unlock: local SRT/VTT subtitle export');
 c.replace(0,0,owenSubtitleFile.toString()+'\n'+owenSubtitleExport.toString()+'\n','local subtitle export');

 // 4. AI context: the summary comes from the selected AI service instead of
 // the original account endpoint; cache, snapshot and prompt injection stay.
 const ip=c.function('ip'),factory=c.text(c.function('jo'));
 assert.ok(factory.includes('usageScene:t.usageScene')&&factory.includes('await c.init()'),'translator factory changed');
 const gate=one(scoped(c,'ip','LogicalExpression',(n,t)=>t==='!e.isPro&&!e.isMax&&!l'),'AI context membership');
 c.replace(gate.start,gate.end,'!1','unlock: AI context without membership');
 const token=one(scoped(c,'ip','AwaitExpression',(n,t)=>t==='await Te.getUserToken()'),'AI context token');
 c.replace(token.start,token.end,'!0','unlock: AI context without account token');
 const request=one(scoped(c,'ip','CallExpression',(n,t)=>n.callee.name==='it'&&t.includes('token:u')&&t.includes('body:n')),'AI context request');
 c.replace(request.start,request.end,'owenAIContextSummary(e,t,n,y,c.contextTimeout)','unlock: AI context summary from own model');
 assert.ok(c.text(ip).includes('theme:x.theme')&&c.text(ip).includes('x.style_guide'),'AI context response mapping changed');
 c.replace(0,0,owenParseAIContext.toString()+'\nasync function owenAIContextSummary(ctx,service,body,source,timeout){let translator=await jo({service},{...ctx,usageScene:"ai_context"});if(!translator?.isAI||!translator.supportsGeneralAIMessage)throw new Error("AI context needs an AI translation service");let to=ctx.targetLanguage,prompt='+JSON.stringify(contextPrompt)+'.replaceAll("{{to}}",to);return owenParseAIContext(await translator.sendMessage({systemPrompt:prompt,userPrompt:"Source language: "+(source||"auto")+"\\nTarget language: "+to+"\\n\\nArticle:\\n"+body,from:source||"auto",to,signal:AbortSignal.timeout(Math.max(Number(timeout)||0,12e3))}));}\n','AI context local summary adapter');
 for(const [p,name] of [[c,'Crt']]){
  const nodes=scoped(p,name,'MemberExpression',(n,t)=>t==='e.isPro');
  assert.equal(nodes.length,4,`${p.name} ${name} AI context switch`);
  for(const n of nodes)p.replace(n.start,n.end,'!0','unlock: AI context switch');
 }

};
