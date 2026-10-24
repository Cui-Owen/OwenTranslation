'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
module.exports=ctx=>{
 const {walk}=ctx;
 const s=ctx.file('side-panel.js'), c=ctx.file('content_main.js');
 const body=(p,n,b='return null;')=>p.body(n,b,`UI: ${n}`);
 const scoped=(p,name,type,pred)=>{const f=p.function(name),a=[];walk.simple(f.body,{[type](n){if(pred(n,p.text(n)))a.push(n);}});return a;};
 const exactly=(a,label)=>{assert.equal(a.length,1,label+': '+a.length);return a[0];};
 const propertyName=n=>n.key?.name??n.key?.value;
 function dropProperty(p,f,key){
  const objects=scoped(p,f,'ObjectExpression',n=>n.properties.some(x=>propertyName(x)===key));
  const o=exactly(objects,`${p.name} ${f} object ${key}`),i=o.properties.findIndex(x=>propertyName(x)===key),a=o.properties;
  p.replace(i===a.length-1&&i?a[i-1].end:a[i].start,i<a.length-1?a[i+1].start:a[i].end,'',`UI: remove ${key}`);
 }
 function dropCase(p,f,name){const n=exactly(scoped(p,f,'SwitchCase',n=>n.test?.value===name),`${p.name} ${f} case ${name}`);p.replace(n.start,n.end,'',`UI: remove ${name} page`);}
 function nullRender(p,f,pred,label){const nodes=scoped(p,f,'CallExpression',(n,t)=>n.callee.type==='Identifier'&&['c','d','f','h'].includes(n.callee.name)&&pred(n,t));const n=exactly(nodes,`${p.name} ${label}`);p.replace(n.start,n.end,'null',`UI: ${label}`);}
 // These components belong exclusively to campaigns, notifications, rewards, reviews or membership decoration.
 for(const [patch,names] of [[s,['v7','qee','wv','h7']],[c,['EM','aTe','IM','XU','QA','Zrt','Rot','Krt','gT']]])for(const n of names)body(patch,n);
 for(const [patch,names] of [[s,['Qee','Mk','Sv','O1']],[c,['bbe','dM','L1','af','W4e']]])for(const n of names)body(patch,n,'return false;');
 for(const [patch,names] of [[s,['bh']],[c,['L0']]])for(const n of names)body(patch,n,'return true;');
 for(const [patch,names] of [[s,['x7','N1']],[c,['kM','H1']]])for(const n of names)body(patch,n,'return undefined;');
 body(c,'X4e','return e;');
 // Preserve the action-required indicator; only paid tier decorations are removed.
 for(const [patch,name,h,t] of [[c,'hrt','d','xe']])body(patch,name,`let{t}=${t}();return e.isShowGoSetting?${h}("span",{class:"custom-select-item-pro",children:t("needAction")}):null;`);
 // Retain the page mode control without mounting an account/profile component.
 body(c,'kye','return e.modeControl??null;');body(c,'n3e');
 const contentWidgets=exactly(scoped(c,'e3e','ConditionalExpression',(n,t)=>t.includes('"widget.helpCenter"')&&t.includes('"rewardCenter.title"')),'content reward/help widgets');
 c.replace(contentWidgets.start,contentWidgets.end,'void 0','UI: remove content reward/help widgets');
 // Keep context translation controls, removing only the paid-tier image beside their label.
 nullRender(c,'Crt',(n,t)=>n.arguments[0]?.value==='img'&&t.includes('src:Ro'),'embedded AI context membership badge');
 // The online expert catalogue is gone; service configuration remains the prompt editor.
 // Remove both the empty popup fallback and the text sidebar catalogue selector.
 body(c,'wrt');
 for(const [patch,name] of [[s,'yX'],[c,'g2e']])nullRender(patch,name,(n,t)=>n.arguments[0]?.value==='div'&&n.arguments[1]?.properties.some(x=>propertyName(x)==='className'&&x.value.value==='translate-settings-field')&&t.includes('("field.assistant")'),'AI expert catalogue field');
 // The global ball root is separate from both the browser-popup host and video quick controls.
 body(c,'wH','if(document.getElementById(V+"-browser-popup"))return;return Nj();');
 for(const [patch,name] of [[c,'XA']])nullRender(patch,name,(n,t)=>t.includes('label:')&&t.includes('("enableFloatBall")')&&!t.includes('children:'),'floating ball switch');
 for(const [patch,name,ref] of [[c,'Tye','o'],[c,'e3e','i']]){
  const call=exactly(scoped(patch,name,'CallExpression',(n,t)=>n.callee.type==='MemberExpression'&&n.callee.property.name==='onOpenUrl'&&(/\.(?:APP_TEXT_URL|WEBAPP_TEXT_URL|TEXT_URL)/.test(t)||t.includes('"popup_text"'))),'text panel action '+name);
  patch.replace(call.start,call.end,`${ref}.current?.openSidePanel({targetTab:"text",source:"popup_text"})`,'UI: text opens local side panel');
 }
 for(const [patch,name,h,tr] of [[c,'Cye','d','xe']])body(patch,name,`let{t}=${tr}();return ${h}("footer",{class:"popup-privacy-footer",children:${h}("div",{class:"flex items-center justify-between px-3 py-2",children:[${h}("button",{type:"button",onClick:()=>e.actionsRef.current?.openOptionsPage(),children:t("floatBall.setting")}),${h}("button",{type:"button",onClick:e.onOpenMoreSettings,children:t("subtitle.quickButton.moreSetting")})]})});`);
 body(c,'Pot');
 // AI reply monitoring and modal are isolated from input translation and AI translation prompts.
 body(c,'z5','return undefined;');body(c,'gle','return false;');body(c,'j5','return true;');body(c,'y6','return undefined;');
 body(c,'OHe','return undefined;');body(c,'BHe','return undefined;');
 dropProperty(c,'Lpt','openAiWritingModal');
 // Remove only the explicit promotional runtime branch; shared error/modal dispatch remains intact.
 for(const [patch,name] of [[s,'cme'],[c,'lSe']]){
  const branch=exactly(scoped(patch,name,'IfStatement',(n,t)=>n.test.type==='BinaryExpression'&&[n.test.left.value,n.test.right.value].includes('subscriptionAct')),'subscription activity branch');
  patch.replace(branch.consequent.start,branch.consequent.end,'{return;}','UI: disable subscription activity runtime');
 }
 for(const [patch,n] of [[s,'n4'],[c,'Sj']])dropCase(patch,n,'messages');
 // Text is the sole panel. Its header already owns settings and close actions.
 for(const [patch,name] of [[s,'ske'],[c,'rlt']])body(patch,name);
 // Remove original-site links at their render boundary, including translated help HTML.
 // Skip bodies already owned by this or another patch, and remove outer render calls first.
 const official=/(?:\.(?:BASE_SITE|DOC_[A-Z_]+|PRICING_URL|USER_[A-Z_]+|GO_AUTH_[A-Z_]+|TEXT_URL|WEBAPP_TEXT_URL|APP_TEXT_URL|GITHUB_BASE|GitHub_BASE|DISCORD_URL|OSS_BASE|R2_UPLOADS_BASE_URL)|immersivetranslate\.(?:com|cn|net)|imtintl\.com|immersive-translate\.github\.io)/;
 for(const patch of [s,c]){
  const covered=n=>patch.edits.some(e=>n.start<e.end&&n.end>e.start);
  const renders=patch.nodes('CallExpression').filter(n=>n.callee.type==='Identifier'&&['c','d','f','h'].includes(n.callee.name)).sort((a,b)=>a.start-b.start||b.end-a.end);
  for(const n of renders){
   if(covered(n))continue;
   const props=n.arguments[1];if(props?.type!=='ObjectExpression')continue;
   const get=k=>props.properties.find(x=>propertyName(x)===k)?.value;
   const isAnchor=n.arguments[0]?.value==='a';
   const className=get('class')??get('className');
   const isMax=className?.value==='max-icon-wrapper'&&official.test(patch.text(n));
   const href=get('href'),src=get('src'),click=get('onClick'),html=get('dangerouslySetInnerHTML');
   if(isMax||isAnchor&&((href&&official.test(patch.text(href)))||(click&&official.test(patch.text(click)))||patch.text(n).includes('privacyProtectionEnabled'))||['img','iframe','video'].includes(n.arguments[0]?.value)&&src&&official.test(patch.text(src))||html&&official.test(patch.text(html)))
    patch.replace(n.start,n.end,'null','UI: remove original-site link or promotion');
  }
  // Locale strings and custom service introductions can contain HTML links.
  // Clean those at the existing HTML boundary instead of observing the whole document.
  for(const o of patch.nodes('ObjectExpression'))for(const prop of o.properties){
   if(propertyName(prop)!=='__html'||covered(prop.value))continue;
   patch.replace(prop.value.start,prop.value.end,`owenUILocalHtml(${patch.text(prop.value)})`,'UI: remove original links from rendered HTML');
  }
  patch.replace(0,0,`function owenUIOfficialUrl(value){try{return /(^|\\.)(?:immersivetranslate\\.(?:com|cn|net)|imtintl\\.com|immersive-translate\\.github\\.io)$/i.test(new URL(String(value),globalThis.location?.href).hostname);}catch{return false;}}function owenUILocalHtml(value){if(typeof value!=="string"||!/(?:immersivetranslate|immersive-translate|imtintl)/i.test(value))return value;let node=document.createElement("template");node.innerHTML=value;for(const link of node.content.querySelectorAll("a[href],img[src],iframe[src]"))if(owenUIOfficialUrl(link.getAttribute("href")||link.getAttribute("src")))link.remove();return node.innerHTML;}\n`,'UI: local HTML link filter');
 }
};

// The side panel page itself comes from ui/; only the retired popup link script remains to drop.
module.exports.finish=dest=>{
 fs.rmSync(path.join(dest,'magpie-popup-link.js'),{force:true});
};
