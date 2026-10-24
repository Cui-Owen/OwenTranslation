'use strict';
const assert=require('node:assert/strict');

// Text side panel: side-panel.js stays the engine (translators, configuration,
// message bus, article terminology bindings); its Preact UI is replaced by the
// React page in ui/src/side-panel. The bundle still mounts its controller (n4)
// into the hidden #mount so every listener and binding works as before, but n4
// renders nothing: it publishes its state and actions to the new UI instead.
// Edits are insertions only, so other patches inside n4 stay valid (dead).

// Helpers the new UI calls; each is the function the old UI called for the same step.
const ENGINE=`globalThis.OwenSidePanel={bridge:owenSidePanelBridge,engine:{
 translate:o=>l7(o),
 lastTranslate:()=>ze.local.get("lastTranslate"),
 saveLastTranslate:v=>ze.local.set("lastTranslate",v),
 serviceItems:async c=>await Ja(c,"translationService","zh-CN",await xX(c),"textTranslate")||[],
 knownServices:(c,ids)=>I7(c,ids),
 defaultService:c=>Wm(c.config,"translationService",c.translationService),
 extraFreeServices:c=>{let k=I7(c,u5),F=Wm(c.config,"translationService",c.translationService);return k.includes(F)?Du(c,k.filter(G=>F!=G)):[]},
 verifyService:(ids,c)=>Qd(ids,c),
 normalizeTargets:(services,langs,config)=>U1(services,langs,config),
 supportedTargets:(services,first,config)=>a7(services,first,config),
 canTranslate:(source,targets)=>TX(source,targets),
 detect:text=>Ft({text,serverDetect:!0}),
 removeNewLines:text=>SJ(text),
 recentLanguages:scope=>np(scope),
 addRecentLanguage:(code,scope)=>Ad(code,scope),
 resultTracker:()=>UAe(),
 reusableResults:o=>VAe(o),
 mergeResult:(list,r)=>jAe(list,r),
 glossaryItems:async(config,lang)=>{let p=g8(await Gm()||[]),h=await d8(config.termsBaseUrl);return[...p,...h.filter(b=>!p.find(v=>v.id===b.id))].map(d=>({id:d.id,name:NAe(d,lang)}))},
 speak:(text,lang,signal)=>zp({text,lang,provider:"WebSpeech",signal}),
 copy:text=>Hp(text),
 errorInfo:(error,c)=>{try{let a=error.uiConfig(c);return{message:a.errMsg||error.message||"",kind:IAe(a)}}catch{return{message:error?.message||String(error),kind:"retry"}}},
 openOptions:route=>fi(!0,route,!1)
}};`;

const BRIDGE=`var owenSidePanelBridge=(()=>{let state=null,subs=new Set;return{publish(s){state=s;queueMicrotask(()=>subs.forEach(f=>f()))},get:()=>state,subscribe(f){subs.add(f);return()=>subs.delete(f)}}})();`;

// n4 locals: theme n, ctx i, config r, active tab K, terminology surface O and
// its setter N/ref D, glossaries B, rtl De, in-page panel Oe, settings writer u.
const PUBLISH=`(owenSidePanelBridge.publish({theme:n,ctx:i,config:r,tab:K,surface:O,glossaries:B,rtl:!!De,contentPanel:Oe,refresh:s,
 leaveSurface:()=>N(null),
 actions:O?{changeRoute:Z,locateOccurrence:(a,b,c)=>ee(O.binding,O.snapshot.version,a,b,c),saveTerms:(a,b,c)=>se(O.binding,a,b,c),updateTermTarget:(a,b)=>oe(O.binding,O.snapshot.version,a,b),createGlossary:a=>ie(O.binding,O.snapshot.version,a)}:null,
 toggleArticleTerminology:async()=>{let ue=D.current?.binding;if(!ue||L.current)return!1;L.current=!0;let Ce=async()=>!!(D.current&&cs(D.current.binding,ue.sourceTabId,ue.identity))&&await _te(ue,Al(),async Fe=>(await lt.tabs.get(Fe)).url,window.location.href),Ke=Fe=>N(Ue=>Ue&&cs(Ue.binding,ue.sourceTabId,ue.identity)?{...Ue,enablePending:Fe}:Ue);Ke(!0);try{return await Rte(ue.identity.url,Ce,()=>re(ue),async Fe=>!!await u(Fe),async()=>{let Fe=Wte(ue,Al());if(!Fe)throw new Error("No source content binding");await Ee(Fe.address,Fe.command)},()=>fi(!1,"#terms",!1))}finally{L.current=!1,Ke(!1)}}
}),null)&&`;

module.exports=ctx=>{
 const p=ctx.file('side-panel.js');
 const wrapper=p.ast.body.length===1&&p.ast.body[0].expression?.callee;
 assert.ok(wrapper?.type==='ArrowFunctionExpression'&&wrapper.body.type==='BlockStatement','side-panel.js: bundle wrapper');
 const top=new Set(wrapper.body.body.flatMap(n=>n.type==='FunctionDeclaration'?[n.id.name]:n.type==='VariableDeclaration'?n.declarations.map(d=>d.id.name):[]));
 for(const id of ['l7','ze','Ja','xX','I7','Wm','u5','Du','Qd','U1','a7','TX','Ft','SJ','np','Ad','UAe','VAe','jAe','g8','Gm','d8','NAe','zp','Hp','IAe','fi','cs','_te','Al','lt','Rte','Wte','Ee'])
  assert.ok(top.has(id),'side-panel.js: '+id+' in bundle scope');

 // The controller's toggle and actions are rebuilt from the same locals.
 const n4=p.function('n4'),src=p.text(n4);
 for(const anchor of ['onToggleArticleTerminology:async()=>{let ue=D.current?.binding;if(!ue)return!1;','if(L.current)return!1;L.current=!0;',
  'Rte(ue.identity.url,Ce,()=>re(ue),async Fe=>!!await u(Fe)','changeRoute:Z,locateOccurrence:(ue,Ce,Ke)=>ee(O.binding,O.snapshot.version,ue,Ce,Ke),saveTerms:(ue,Ce,Ke)=>se(O.binding,ue,Ce,Ke),updateTermTarget:(ue,Ce)=>oe(O.binding,O.snapshot.version,ue,Ce),createGlossary:ue=>ie(O.binding,O.snapshot.version,ue)',
  'let{theme:n}=vv(),{config:r,ctx:i,ctxRef:o,settingsHookValue:a,refreshCtx:s}=$M(),[l,u,c,g,d]=a','[O,N]=$(null),D=he(null);D.current=O;let[B,P]=$([])','K=r&&i?K3(E,S):E','De=r&&En(r.rtlLanguages??[],r.interfaceLanguage)','[Oe,Te]=$(!1)'])
  assert.ok(src.includes(anchor),'side-panel.js n4: '+anchor.slice(0,50));
 const ret=n4.body.body.findLast(x=>x.type==='ReturnStatement');
 assert.equal(ret?.argument?.type,'SequenceExpression','n4 return sequence');
 const view=ret.argument.expressions.at(-1);
 assert.ok(p.text(view).startsWith('f("div",{"data-theme":n'),'n4 view');
 p.replace(view.start,view.start,PUBLISH,'side panel: publish controller state to the React UI');

 const mount='var Tme=document.getElementById("mount");';
 const at=p.source.indexOf(mount);assert.ok(at>0&&p.source.indexOf(mount,at+1)<0,'side-panel.js: entry');
 p.replace(at,at,BRIDGE+ENGINE,'side panel: engine API for the React UI');
};
