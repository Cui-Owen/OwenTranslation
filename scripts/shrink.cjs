'use strict';
// A second AST pass over the composed patches: offsets cannot overlap earlier edits.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {Patch,walk}=require('./patch-lib.cjs');
const COMMANDS=['toggleTranslatePage','toggleOnlyTranslation','toggleSidePanel','translateInputBox','toggleMouseHoverTranslateDirectly'];
const sensitive={
 'background.js':['Dv','Pv','eee','AP','uq','yv','pv'],
 'side-panel.js':['nV','rV','owe','sJ','HTe','HH','b2'],
 'content_main.js':['g$','m$','Fze','Lse','tNe','KX','pC']
};
function shrink(name,source){
 const p=new Patch(name,source);
 if(!sensitive[name])return {code:source,edits:[]};
 const [encode,decode,prepare,restore,init,factory,transport]=sensitive[name];
 p.body(encode,'return t.map(item=>item.text);','remove sensitive text masking');
 p.body(decode,'return '+p.function(decode).params[2].name+';','remove sensitive text restoration');
 for(const fn of [prepare,restore])p.body(fn,'','remove sensitive pipeline hook');
 p.body(init,'return false;','remove AIFW initialization');
 for(const fn of [factory,transport])p.body(fn,'return {};','remove local client runtime');
 // Retire the optional HTTP masking server as well as the packaged WASM path.
 for(const [marker,body]of [['/api/mask_text_batch','return t.map(item=>item.text);'],['/api/restore_text','return '+p.function(decode).params[2].name+';']]){
  const functions=p.nodes('FunctionDeclaration').filter(n=>p.text(n).includes(marker));
  assert.equal(functions.length,1,name+': custom masking adapter '+marker);
  p.body(functions[0].id.name,body,'remove custom masking transport');
 }
 if(name==='background.js'){
  for(const fn of ['OQ','w2','x2'])p.body(fn,'return false;','remove Offscreen lifecycle');
  const listener=p.nodes('ArrowFunctionExpression').filter(n=>n.params[0]?.name==='t'&&n.params[1]?.name==='r'&&p.text(n).includes('command received')&&p.text(n).includes('shortcut-'));
  assert.equal(listener.length,1,'native command listener');
  // Preserve the original engine protocol and existing per-command preferences.
  p.replace(listener[0].body.start+1,listener[0].body.start+1,'if(t==="toggleOnlyTranslation")t="toggleOnlyTransation";','route corrected native command to engine');
 }
 // These registry copies have no consumers; document stylesheets remain separate.
 for(const n of p.nodes('Property')){
  const key=n.key.value;
  if(['pico.css','options.css','hero.css','store.css','assistant.css','epub.css'].includes(key)&&n.value.type==='TemplateLiteral'){
   assert.equal(p.nodes('Literal').filter(x=>x.value===key).length,0,name+': unused CSS registry '+key);
   p.replace(n.value.start,n.value.end,'""','remove unused CSS registry '+key);
  }
 }
 const covered=n=>p.edits.some(e=>n.start<e.end&&e.start<n.end);
 // Marketing assets are identified by their owning dialog/banner, never by size.
 const marketing=new Set();
 walk.ancestor(p.ast,{Literal(n,ancestors){
  if(typeof n.value!=='string'||!n.value.startsWith('data:image/')||covered(n))return;
  const declaration=ancestors.findLast(a=>a.type==='VariableDeclarator');
  const property=ancestors.findLast(a=>a.type==='Property');
  if(['bannerLeft','bannerRight'].includes(property?.key.name??property?.key.value))marketing.add(n);
  if(declaration?.init===n&&declaration.id.type==='Identifier'){
   const id=declaration.id.name;
   const dialogs=p.nodes('FunctionDeclaration').filter(f=>p.text(f).includes('backgroundImage:'+id)&&/dialog\.aiContextSubscribe|areaTransLoginDesc/.test(p.text(f)));
   if(dialogs.length)marketing.add(n);
  }
 }});
 for(const n of marketing)p.replace(n.start,n.end,'""','remove embedded marketing artwork');
 return {code:p.render(),edits:p.edits};
}
// Remove only namespaces owned by retired features. Shared translation, service,
// glossary and subtitle strings stay available, including dynamically built keys.
const retiredLocale=/^(?:(?:fileTranslate|imageTranslate|image|imageState|imageTools|imageQuota|freeImage|aiWriting|aiAssistant|rewardCenter|messageCenter|subscription|proQuotaError|storeGuide|newUserActivity|loginAiQuotaGift|shareCard|floatBall|floatBallOptions|floatBallSetting|serviceRecommendation|powerUser|areaTrans|enableAreaTrans)\.|sidePanel\.tutorial\.|popup\.membershipPrompt\.|popup\.simpleMode\.feature\.(?:writing|screenshot)$|(?:description|label|error)\.sensitive|sensitiveMode\.|message\.initAIFW|(?:no)?login$|loginForSafari$|goLogin$|manageAccount$|openPremium$|logout$|(?:syncTo|syncConfig|successSync|lastSyncedAt|enableAutoSync|syncTitle$|syncFail$)|(?:translate-pdf|noLocalFilePermissionForPDF|translateImage|mangaAndImage|disableRewardCenter|areaTrans.*|enableAreaTrans.*)$)/i;
function finish(dest){
 const manifestPath=path.join(dest,'manifest.json'),m=JSON.parse(fs.readFileSync(manifestPath));
 m.permissions=m.permissions.filter(x=>x!=='offscreen');
 m.content_security_policy.extension_pages="script-src 'self'; object-src 'self'";
 const old=m.commands;
 m.commands=Object.fromEntries(COMMANDS.map(id=>[id,old[id]||old.toggleOnlyTransation]));
 for(const id of COMMANDS)assert.ok(m.commands[id],id);
 fs.writeFileSync(manifestPath,JSON.stringify(m,null,2)+'\n');
 for(const name of ['aifw','offscreen.js','offscreen.html'])fs.rmSync(path.join(dest,name),{recursive:true,force:true});
 const removedStyles=['epub','input','hero','store','assistant'];
 for(const name of removedStyles)fs.rmSync(path.join(dest,'styles',name+'.css'),{force:true});
 const localePath=path.join(dest,'locales.json'),locales=JSON.parse(fs.readFileSync(localePath));
 const removed=[];
 for(const [lang,values]of Object.entries(locales)){
  for(const key of Object.keys(values))if(retiredLocale.test(key)){delete values[key];if(lang==='en')removed.push(key);}
  if(values['popup.simpleMode.disabledFeatures']){
   values['popup.simpleMode.disabledFeatures']=values['popup.simpleMode.disabledFeatures']
    .replace(/(?:[、· ]*(?:圈选翻译|圈選翻譯|Area translation|Dịch vùng chọn|ترجمة منطقة محددة|תרגום אזור מסומן|Tradução de área|範囲選択翻訳|चुने हुए क्षेत्र का अनुवाद|Alan çevirisi|Traduction de zone|Bereich übersetzen|ترجمهٔ ناحیهٔ انتخاب‌شده|Traducción de áreas|แปลพื้นที่ที่เลือก|Traduzione di un’area|Перевод области|영역 선택 번역|Terjemahan area|Kijelölt terület fordítása)[、· ]*)/g, (m, offset, str)=>str.includes('·')?' · ':'、')
    .replace(/^[、· ]+|[、· ]+$/g,'');
  }
 }
 fs.writeFileSync(localePath,JSON.stringify(locales)+'\n');
 // Browser-localized command descriptions remain separate from UI locales.
 for(const lang of fs.readdirSync(path.join(dest,'_locales'))){
  const file=path.join(dest,'_locales',lang,'messages.json'),values=JSON.parse(fs.readFileSync(file));
  const used=new Set([...JSON.stringify(m).matchAll(/__MSG_(\w+)__/g)].map(x=>x[1]));
  for(const key of Object.keys(values))if(!used.has(key))delete values[key];
  fs.writeFileSync(file,JSON.stringify(values,null,2)+'\n');
 }
 fs.writeFileSync(path.join(dest,'OWEN-SLIM.json'),JSON.stringify({phase:1,commands:COMMANDS,removedStyles,removedLocaleKeys:removed},null,2)+'\n');
}
module.exports={shrink,finish,COMMANDS,retiredLocale};
