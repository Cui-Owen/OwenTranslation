'use strict';
// Applied to the branded 1.34.3 bundle before rendering/minification.
// Keep original message transport and AIFW; remove only media entry points.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = function patchMedia(ctx) {
  const walk = ctx.walk;
  const covered = new Map();
  function replace(p, node, text, label) {
    const spans = covered.get(p) || [];
    if (spans.some(([a,b]) => node.start >= a && node.end <= b)) return;
    assert.ok(!spans.some(([a,b]) => node.start < b && node.end > a), `${p.name}: overlapping media edit ${label}`);
    p.replace(node.start,node.end,text,label);
    spans.push([node.start,node.end]); covered.set(p,spans);
  }
  function body(p, node, text, label) {
    replace(p,{start:node.body.start+1,end:node.body.end-1},text,label);
  }
  function named(p,name,text) { body(p,p.function(name),text,`media: disable ${name}`); }
  function removeArrayElement(p, node, parent, label) {
    const i=parent.elements.indexOf(node);
    assert.ok(i>=0,label);
    let start=node.start,end=node.end;
    if(i<parent.elements.length-1)end=parent.elements[i+1].start;
    else if(i>0)start=parent.elements[i-1].end;
    replace(p,{start,end},'',label);
  }
  function containingFunctions(p,term) {
    const found=new Set();
    walk.ancestor(p.ast,{Literal(n,a){
      if(n.value!==term)return;
      const f=a.filter(x=>x.type==='FunctionDeclaration').pop();
      if(f)found.add(f);
    }});
    return [...found];
  }
  for(const file of ['content_main.js','side-panel.js']) {
    const p=ctx.file(file);
    // Dedicated pages/components, identified independently in every bundle.
    for(const term of ['fileTranslate.uploadFile','imageTranslate.goTranslate','videoTranslate.goTranslate','imageTools.retranslateImage'])
      for(const f of containingFunctions(p,term))body(p,f,'return null;',`media: remove ${term} component`);
    // Only the desktop content bundle has the live image/manga/PDF controllers.
    if(file==='content_main.js') {
      for(const name of ['wB','Na','Xve','t9e','C9e','S9e','tft','nft','ewe','oft','xct'])named(p,name,'return;');
      named(p,'she','return () => {};');
      named(p,'Klt','return null;'); // manga-only floating control
      p.once('let i=e.rule.imageRule;i?.enable&&i.type==="manga"&&tft(),oft(e)','', 'media: remove image/bridge bootstrap');
    } else {
      // The same image and screenshot components are bundled into the side panel.
      named(p,'ll','return;');
      named(p,'Sue','return () => {};');
    }
    if(file==='side-panel.js') {
      named(p,'Rge','return null;'); // screenshot area membership prompt
      named(p,'sBe','return [];'); // screenshot area OCR prompt
    } else if(file==='content_main.js') {
      named(p,'axe','return null;'); // screenshot area membership prompt
      named(p,'JXe','return [];'); // screenshot area OCR prompt
      p.once('t.feature==="ai_context"?a("dialog.aiContextDesc"):a("areaTransLoginDesc")','t.feature==="ai_context"?a("dialog.aiContextDesc"):""','media: content remove areaTransLoginDesc');
      p.once('u?t.action==="login"?a("areaTransLoginButton"):a("areaTransSubscribeButton"):','','media: content remove areaTransLoginButton');
    }
    // Keep text and article terminology. The latter has an independent managed-document route.
    for(const n of p.nodes('ArrayExpression')) {
      if(p.text(n)==='["text","file","video","image","tutorial","messages"]')
        replace(p,n,'["text"]','media: side panel route allowlist');
    }
    for(const sw of p.nodes('SwitchStatement')) {
      if(!sw.cases.some(c=>c.test?.value==='tutorial') || !sw.cases.some(c=>c.test?.value==='text'))continue;
      for(const c of sw.cases)if(['file','image','video','tutorial'].includes(c.test?.value))
        replace(p,c,'','media: remove external tool/tutorial route');
    }
    // Widget file buttons are individual array elements; preserve text/hover/selection siblings.
    walk.ancestor(p.ast,{ObjectExpression(n,a){
      const parent=a[a.length-2];
      if(parent?.type!=='ArrayExpression')return;
      const s=p.text(n);
      if(s.includes('"widget.translateFile"') || s.includes('"translateFileTooltip"'))
        removeArrayElement(p,n,parent,'media: remove widget file button');
    }});
    // Text selection remains available. Screenshot UI and persisted screenshot tabs are removed.
    for(const f of p.nodes('FunctionDeclaration'))if(/^function \w+\(e\)\{return e==="text"\|\|e==="screenshot"\}$/.test(p.text(f)))
      body(p,f,'return e === "text";','media: selection tab allowlist');
    for(const drawer of containingFunctions(p,'selectionTextTab')) {
      walk.ancestor(drawer,{Literal(n,a){
        if(n.value==='areaTrans') {
          const call=[...a].reverse().find(x=>x.type==='CallExpression'&&x.arguments[0]?.value==='button');
          if(call)replace(p,call,'null','media: remove screenshot selection tab');
        }
        if(n.value==='enableAreaTransTitle') {
          const card=[...a].reverse().find(x=>x.type==='LogicalExpression'&&(x.left.type==='BinaryExpression'||x.left.type==='LogicalExpression'));
          if(card)replace(p,card,'null','media: remove screenshot selection card');
        }
      }},walk.base);
      walk.simple(drawer,{BinaryExpression(n){
        if(n.operator==='==='&&(n.left.value==='screenshot'||n.right.value==='screenshot'))
          replace(p,n,'false','media: remove screenshot selection panel');
      }});
    }
  }
  const bg=ctx.file('background.js');
  // Context menu descriptor removal means later refreshes cannot resurrect either command.
  walk.ancestor(bg.ast,{ObjectExpression(n,a){
    const parent=a[a.length-2]; if(parent?.type!=='ArrayExpression')return;
    if(['{id:ea,contexts:["image"]}','{id:qp,contexts:d2}'].includes(bg.text(n)))
      removeArrayElement(bg,n,parent,'media: remove image/PDF context menu');
  }});
  // Keep normal page, input and selection menu dispatch. Ignore stale media menu callbacks.
  const f2=bg.function('f2');
  bg.replace(f2.body.start+1,f2.body.start+1,'if(e.menuItemId===ea||e.menuItemId===qp)return;','media: reject stale media menu commands');
  for(const n of bg.nodes('IfStatement')) {
    if(n.test.type!=='BinaryExpression')continue;
    const method=n.test.left.value||n.test.right.value;
    if(['openPdfViewerPage','captureVisibleTabForScreenshotArea'].includes(method))
      replace(bg,n.consequent,'{return false;}','media: disable PDF/screenshot background endpoint');
  }

};

module.exports.finish = function finishMedia(root) {
  for(const name of ['pdf','image','tesseract','wasm','browser-bridge','aifw','offscreen.js','offscreen.html'])fs.rmSync(path.join(root,name),{recursive:true,force:true});
  const manifestFile=path.join(root,'manifest.json');
  const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
  for(const item of manifest.web_accessible_resources||[])item.resources=item.resources.filter(x=>! /^(pdf|image|tesseract|wasm|browser-bridge)\//.test(x));
  fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
};
