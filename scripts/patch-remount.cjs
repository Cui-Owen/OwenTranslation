'use strict';
const assert=require('node:assert/strict');

// Some sites rebuild unchanged DOM on every keystroke: flatmates.com.au
// recreates each message <li> of a conversation while you type a reply. The
// dynamic observer then sees fresh, untranslated paragraphs and translates them
// again, so every translation on screen vanishes for ~300 ms per key. When a
// removed bilingual paragraph comes back with the same tag and source text in
// the same mutation batch, its translation is shown on the new node before the
// browser paints, as ::after content of a data-owen-reuse attribute. No node is
// added, and the engine neither observes attributes nor reads generated
// content, so it parses and translates the paragraph exactly as before; the
// stand-in goes once a finished translation lands, or after 5 s if the engine
// never gets to it (off screen, page restored). Translation-only paragraphs no
// longer contain their source text, so they never match.
const REUSE=`function owenReuseRemounted(records){const W="immersive-translate-target-wrapper",A="data-owen-reuse",P='[data-imt-p="1"],['+A+"]",done=w=>!w.hasAttribute("data-immersive-translate-loading-id")&&!w.querySelector('[class*="loading"],[class*="error"]'),source=el=>{let s="";const walk=n=>{for(const c of n.childNodes)c.nodeType===3?s+=c.data:c.nodeType===1&&!c.classList.contains(W)&&walk(c)};return walk(el),s.replace(/\\s+/g," ").trim()},removed=new Map;for(const r of records)for(const n of r.removedNodes){if(n.nodeType!==1)continue;for(const p of n.matches(P)?[n,...n.querySelectorAll(P)]:n.querySelectorAll(P)){const ws=[...p.querySelectorAll("."+W)].filter(w=>w.closest(P)===p&&!w.parentElement.closest("."+W)&&done(w)),shown=ws.length?ws.map(w=>"\\n"+w.textContent.trim()).join(""):p.getAttribute(A),text=shown&&source(p);text&&removed.set(p.tagName+"|"+text,shown)}}if(!removed.size)return;if(!document.getElementById("owen-reuse-style")){const s=document.createElement("style");s.id="owen-reuse-style",s.textContent="["+A+"]::after{content:attr("+A+");white-space:pre-line}",(document.head||document.documentElement).append(s)}for(const r of records)for(const n of r.addedNodes){if(n.nodeType!==1||!n.isConnected)continue;for(const el of [n,...n.querySelectorAll("*")]){const shown=el.querySelector("."+W)?null:removed.get(el.tagName+"|"+source(el));if(!shown)continue;el.setAttribute(A,shown);let timer;const drop=()=>{watch.disconnect(),clearTimeout(timer),el.removeAttribute(A)},watch=new MutationObserver(()=>{[...el.querySelectorAll("."+W)].some(done)&&drop()});watch.observe(el,{childList:!0,subtree:!0}),timer=setTimeout(drop,5e3)}}}\n`;

module.exports=ctx=>{
 const c=ctx.file('content_main.js');
 c.replace(0,0,REUSE,'remount: stand-in translations for rebuilt paragraphs');
 const observers=c.nodes('NewExpression').filter(n=>n.callee.name==='MutationObserver'&&n.arguments[0]?.type==='ArrowFunctionExpression'&&c.text(n).includes('"dynamic_mutation_record_count"'));
 assert.equal(observers.length,1,'content_main.js: dynamic mutation observer');
 const fn=observers[0].arguments[0];
 c.replace(fn.body.start+1,fn.body.start+1,`try{owenReuseRemounted(${fn.params[0].name})}catch{}`,'remount: run before the dynamic observer');
};
