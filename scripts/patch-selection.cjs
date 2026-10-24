'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');

// Selection translation without the vendor relay. Upstream only offered it on
// services flagged `selectionTranslation` (DeepSeek plus hosted pro/free
// models) and otherwise fell back to the hosted "zhipu-free", which this build
// removed. Every configured AI service now qualifies; with none configured the
// card uses the main translation service from settings.
const FALLBACK='function owenSelectionFallback(e){return e?.translationService||e?.config?.translationService||"bing"}\n';

module.exports=ctx=>{
 for(const file of ['content_main.js','side-panel.js']){
  const p=ctx.file(file);
  p.replace(0,0,FALLBACK,'selection: fallback service');
  // The chooser is an arrow assigned at top level (kc / eu / Cc in this build).
  const choosers=p.nodes('VariableDeclarator').filter(n=>n.init?.type==='ArrowFunctionExpression'&&(t=>t.includes('commonService.service')&&t.includes('proService.service')&&t.includes('"zhipu-free"'))(p.text(n.init)));
  assert.equal(choosers.length,1,`${file}: selection service chooser`);
  const init=choosers[0].init,list=/(\w+)\(e,"translationService",e\.config\.interfaceLanguage,\[\],"selection"\)/.exec(p.text(init));
  assert.ok(list,`${file}: selection service list call`);
  p.replace(init.start,init.end,`e=>{let t=e.rule.selectionTranslation,n=${list[1]}(e,"translationService",e.config.interfaceLanguage,[],"selection").filter(l=>l.ai===!0)||[],r=l=>!!l&&n.some(u=>u.id===l),i=t?.service;if(i&&r(i))return i;let a=t?.commonService?.service;return a&&r(a)?a:r(owenSelectionFallback(e))?owenSelectionFallback(e):n[0]?.id||owenSelectionFallback(e)}`,'selection: local service chooser');
  // The card's service menu lists every AI service, matching the chooser.
  let filters=0,fallbacks=0;
  for(const n of p.nodes('LogicalExpression')){
   if(n.start>=init.start&&n.end<=init.end)continue;
   const t=p.text(n);
   if(/^\w+\.ai===!0&&\w+\.config\.supportFeatures\?\.includes\("selectionTranslation"\)$/.test(t)){p.replace(n.start,n.end,p.text(n.left),'selection: list all AI services');filters++;}
   if(t==='e.rule.selectionTranslation?.commonService.service||"zhipu-free"'){p.replace(n.start,n.end,'owenSelectionFallback(e)','selection: no hosted fallback');fallbacks++;}
  }
  assert.ok(filters>=1,`${file}: selection service list filters (${filters})`);
  assert.ok(fallbacks>=1,`${file}: selection hosted fallbacks (${fallbacks})`);
 }
};

// error.serveUnavailable carried the original Pro upsell; say what to do instead.
const SERVE_UNAVAILABLE={
 'zh-CN':'{serverName} 暂时无法完成翻译。请检查该服务的 API 地址、密钥和模型，或在“翻译服务”中换用其他服务。',
 'zh-TW':'{serverName} 暫時無法完成翻譯。請檢查該服務的 API 位址、金鑰和模型，或在「翻譯服務」中改用其他服務。',
 'zh-HK':'{serverName} 暫時無法完成翻譯。請檢查該服務的 API 位址、金鑰和模型，或在「翻譯服務」中改用其他服務。',
 en:'{serverName} could not complete the translation. Check the service URL, key and model, or choose another service under Translation Services.'
};
module.exports.finish=dest=>{
 const file=path.join(dest,'locales.json'),locales=JSON.parse(fs.readFileSync(file,'utf8'));
 for(const [lang,text] of Object.entries(SERVE_UNAVAILABLE)){
  assert.ok(locales[lang]?.['error.serveUnavailable'],`locales ${lang}: error.serveUnavailable`);
  locales[lang]['error.serveUnavailable']=text;
 }
 fs.writeFileSync(file,JSON.stringify(locales)+'\n');
};
