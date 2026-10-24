'use strict';
const assert=require('node:assert/strict');

// 朱批 brand: the bundles carry the original pink in embedded CSS text and in
// SVG icon props. These are all interface chrome (no stored config values), so
// every string literal is recolored. Runs after the other patches and skips
// literals inside ranges they already rewrote.
const COLORS=[
 [/#(?:ea4c89|ec4c8c|e23c7c)\b/gi,'#D43D25'],
 [/#(?:f082ac|f497bc)\b/gi,'#E2412A'],
 [/#fdedf3\b/gi,'#FBE7E2'],
 [/rgba\(\s*23[3-6],\s*76,\s*1(?:37|40),/g,'rgba(212, 61, 37,'],
 [/rgba\(\s*255,\s*(?:146|166),\s*(?:188|201),\s*[\d.]+\s*\)/g,'rgba(21, 23, 28, 0.08)']
];
const recolor=text=>COLORS.reduce((s,[from,to])=>s.replace(from,to),text);

module.exports=ctx=>{
 for(const [file,min] of [['side-panel.js',60],['content_main.js',60]]){
  const patch=ctx.file(file),taken=patch.edits.map(({start,end})=>[start,end]);
  let count=0;
  ctx.walk.full(patch.ast,node=>{
   if(!(node.type==='Literal'&&typeof node.value==='string')&&node.type!=='TemplateElement')return;
   if(taken.some(([start,end])=>node.start<end&&start<node.end))return;
   const raw=patch.text(node),next=recolor(raw);
   if(next===raw)return;
   patch.replace(node.start,node.end,next,'朱批 colors');
   count++;
  });
  assert.ok(count>=min,`${file}: recolored ${count} literals`);
 }
};
