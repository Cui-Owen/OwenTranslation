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

module.exports=ctx=>{
 const c=ctx.file('content_main.js');
 const templates=c.nodes('TemplateLiteral');
 for(const [sheet,markers] of SHEETS){
  const owners=templates.filter(n=>{const text=n.quasis.map(q=>q.value.cooked).join('');return markers.every(m=>text.includes(m));});
  assert.equal(owners.length,1,`content_main.js: template for ${sheet}`);
  const n=owners[0];
  c.replace(n.end-1,n.end-1,'\n'+escape(read(sheet)),`朱批 in-page: ${sheet}`);
 }
};

// The standalone copy of inject.css ships too; keep it identical to the embedded one.
module.exports.finish=dest=>{
 const file=path.join(dest,'styles','inject.css');
 fs.appendFileSync(file,'\n'+read('inpage-page.css'));
};
