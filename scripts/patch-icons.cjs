'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {PNG}=require('pngjs');
const root=path.resolve(__dirname,'..');

// 朱批 mark: an O cut horizontally; the lower (translation) half is shifted
// one grid step down-right. Geometry is in a 64-unit box, see the brand canvas.
const INK='#15171C',PAPER='#ECEBE6',GRAY='#8B909A',VERMILION='#E2412A',VERMILION_DARK='#FF6B4F';
const SIZES=[32,48,64,128,256];
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));

// Toolbar glyphs need heavier strokes at small sizes to stay legible.
function mark(size){
 return size<=64?{upper:[30,29],lower:[34,35],r:22,w:12}:{upper:[30,30],lower:[34,34],r:20,w:8};
}
function halfRing([cx,cy],r,w,top){
 return (x,y)=>{const d=Math.hypot(x-cx,y-cy);return d>=r-w/2&&d<=r+w/2&&(top?y<=cy:y>=cy);};
}
function roundRect(s,rad){
 return (x,y)=>{
  if(x<0||y<0||x>s||y>s)return false;
  const qx=Math.max(rad-x,x-(s-rad),0),qy=Math.max(rad-y,y-(s-rad),0);
  return qx*qx+qy*qy<=rad*rad;
 };
}

// Layers are [inside(x,y), hex] painted in order over transparency, with
// n×n supersampling per pixel for antialiased edges.
function render(size,layers){
 const png=new PNG({width:size,height:size}),n=size<=64?8:4,unit=64/size;
 for(let py=0;py<size;py++)for(let px=0;px<size;px++){
  let r=0,g=0,b=0,a=0;
  for(let sy=0;sy<n;sy++)for(let sx=0;sx<n;sx++){
   const x=(px+(sx+0.5)/n)*unit,y=(py+(sy+0.5)/n)*unit;
   let c=null;for(const [inside,hex] of layers)if(inside(x,y))c=hex;
   if(c){const [cr,cg,cb]=rgb(c);r+=cr;g+=cg;b+=cb;a++;}
  }
  const i=(py*size+px)*4;
  if(a){png.data[i]=Math.round(r/a);png.data[i+1]=Math.round(g/a);png.data[i+2]=Math.round(b/a);}
  png.data[i+3]=Math.round(a*255/(n*n));
 }
 return PNG.sync.write(png);
}

function toolbar(size,upper,lower){
 const m=mark(size);
 return render(size,[[halfRing(m.upper,m.r,m.w,true),upper],[halfRing(m.lower,m.r,m.w,false),lower]]);
}

// App tile: ink rounded square carrying a paper/vermilion mark. Small tiles
// enlarge the mark and thicken the stroke, matching the brand canvas.
function tile(size){
 const [offset,scale,w]=size<=32?[11,0.656,11]:size<=48?[12,0.625,10]:[13,0.594,9];
 const at=([x,y])=>[offset+x*scale,offset+y*scale];
 return render(size,[
  [roundRect(64,15),INK],
  [halfRing(at([30,30]),20*scale,w*scale,true),'#F4F4F1'],
  [halfRing(at([34,34]),20*scale,w*scale,false),'#FF5A3C']
 ]);
}

module.exports=ctx=>{
 // Embedded brand icons used the same 128px artwork as the PNG resources.
 const original=PNG.sync.read(fs.readFileSync(path.join(root,'upstream/icons/128.png')));
 const replacement='data:image/png;base64,'+tile(128).toString('base64');
 for(const [file,names] of [['side-panel.js',['$o']],['content_main.js',['Ma','ene']]]){
  const patch=ctx.file(file);
  for(const name of names){
   let count=0;
   ctx.walk.simple(patch.function(name),{Literal(node){
    if(typeof node.value!=='string'||!node.value.startsWith('data:image/png;base64,'))return;
    const image=PNG.sync.read(Buffer.from(node.value.split(',')[1],'base64'));
    assert.equal(image.width,original.width);
    assert.equal(image.height,original.height);
    assert.deepEqual(image.data,original.data,`${file}: ${name} brand artwork`);
    patch.replace(node.start,node.end,JSON.stringify(replacement),'朱批 brand tile');
    count++;
   }});
   assert.equal(count,1,`${file}: ${name} embedded brand icon`);
  }
 }
};

// icons/ is the idle toolbar state (lower half gray); badge-icons/ is shown
// once the page is translated (lower half vermilion). dark-* serve dark themes.
module.exports.finish=dest=>{
 for(const size of SIZES){
  fs.writeFileSync(path.join(dest,'icons',`${size}.png`),toolbar(size,INK,GRAY));
  fs.writeFileSync(path.join(dest,'icons',`dark-${size}.png`),toolbar(size,PAPER,GRAY));
  fs.writeFileSync(path.join(dest,'badge-icons',`${size}.png`),toolbar(size,INK,VERMILION));
  fs.writeFileSync(path.join(dest,'badge-icons',`dark-${size}.png`),toolbar(size,PAPER,VERMILION_DARK));
  fs.writeFileSync(path.join(dest,'icons',`app-${size}.png`),tile(size));
 }
 fs.writeFileSync(path.join(dest,'icons','toolbar-icon.png'),tile(256));
};
