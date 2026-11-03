'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');

// 朱批 in-page UI (brand canvas, board 07). The page, selection-card and subtitle
// menu styles live in template literals inside content_main.js; each brand sheet
// is appended to the end of the template that owns those selectors.
const SHEETS=[
 // [stylesheet, markers that identify the owning template literal]
 ['inpage-page.css',['--immersive-translate-theme-underline-borderColor','immersive-translate-loading-spinner']],
 ['inpage-selection.css',['selection-translation-source-card','selection-translation-sentence-modal']],
 ['inpage-subtitle.css',['-pop-content .setting-item','.quick-switch.is-checked']]
];
const read=name=>fs.readFileSync(path.join(__dirname,'ui',name),'utf8');
// Template-literal safe: no backslash, backtick or ${ may reach the bundle raw.
const escape=css=>css.replace(/\\/g,'\\\\').replace(/`/g,'\\`').replace(/\$\{/g,'\\${');

// Bilingual mode appends each translation below its source. Where the source
// sits in a box that cannot grow (line clamp, max height, nowrap, absolute
// overlay), upstream's mixed mode can show the translation in place instead;
// it ships disabled. heightOverflow stays off: whole-page scroll containers
// match it too.
const TRANSLATION_ONLY_TRIGGERS=['lineClamp','maxHeight','nowrap','webkitBox','fixedPosition'];

module.exports=ctx=>{
 const c=ctx.file('content_main.js');
 const templates=c.nodes('TemplateLiteral');
 for(const [sheet,markers] of SHEETS){
  const owners=templates.filter(n=>{const text=n.quasis.map(q=>q.value.cooked).join('');return markers.every(m=>text.includes(m));});
  assert.equal(owners.length,1,`content_main.js: template for ${sheet}`);
  const n=owners[0];
  c.replace(n.end-1,n.end-1,'\n'+escape(read(sheet)),`朱批 in-page: ${sheet}`);
 }
 // Mark paragraphs that mixed mode switched from dual to translation only.
 const modes=c.nodes('FunctionDeclaration').filter(n=>(t=>t.includes('!=="dual")return ')&&t.includes('.preferredTranslationMode='))(c.text(n)));
 assert.equal(modes.length,1,'content_main.js: mixed-mode resolver');
 const m=modes[0],[,para,mode]=m.params.map(p=>p.name),src=c.text(m);
 const preferred=new RegExp(`return ${para}\\.preferredTranslationMode=(\\w+),\\1;`).exec(src),detected=new RegExp(`return (\\w+)\\|\\|${mode}}$`).exec(src);
 assert.ok(preferred&&detected,'content_main.js: mixed-mode resolver returns');
 c.replace(m.body.start+1,m.body.start+1,`${para}&&(${para}.owenAutoOnly=!1);`,'mixed mode: reset auto translation-only mark');
 c.replace(m.start+preferred.index+7,m.start+preferred.index+7,`${para}.owenAutoOnly=!0,`,'mixed mode: mark selector translation-only');
 c.replace(m.start+detected.index,m.end,`return ${detected[1]}?(${para}.owenAutoOnly=!0,${detected[1]}):${mode}}`,'mixed mode: mark detected translation-only');
 // Those paragraphs keep the original one hover away; restore removes the title.
 const mark=/(\w+)\.hasAttribute\((\w+)\)\|\|\(\1\.setAttribute\(\2,"1"\),(\w+)\.push\(\{node:\1,name:\2\}\)\);/;
 const owners=c.nodes('FunctionDeclaration').filter(n=>c.text(n).includes('attributeAdjustments:')&&mark.test(c.text(n)));
 assert.equal(owners.length,1,'content_main.js: translation-only adjustments');
 const o=owners[0],hit=mark.exec(c.text(o)),[,el,,list]=hit,p=o.params[1].name,at=o.start+hit.index+hit[0].length;
 c.replace(at,at,`${p}.owenAutoOnly&&${p}.text&&!${el}.hasAttribute("title")&&(${el}.setAttribute("title",${p}.text.trim()),${list}.push({node:${el},name:"title"}));`,'mixed mode: original text as title');
};

module.exports.finish=dest=>{
 // The standalone copy of inject.css ships too; keep it identical to the embedded one.
 fs.appendFileSync(path.join(dest,'styles','inject.css'),'\n'+read('inpage-page.css'));
 for(const name of ['default_config.json','default_config.content.json']){
  const file=path.join(dest,name),config=JSON.parse(fs.readFileSync(file,'utf8')),mixed=config.generalRule?.mixedMode;
  assert.ok(mixed?.translationOnlyDetect,name+': generalRule.mixedMode');
  mixed.translationOnlyDetect={enabled:true,triggerTypes:TRANSLATION_ONLY_TRIGGERS};
  fs.writeFileSync(file,JSON.stringify(config));
 }
};
