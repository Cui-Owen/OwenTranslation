'use strict';
const fs=require('node:fs');
const {minify}=require('terser');
(async()=>{
 const file=process.argv[2],code=fs.readFileSync(file,'utf8');
 const out=await minify(code,{
  mangle:false,
  compress:{defaults:false,toplevel:true,unused:true,dead_code:true,side_effects:true,passes:3},
  format:{comments:/^!/}
 });
 if(!out.code)throw new Error('Empty prune result');
 require('acorn').parse(out.code,{ecmaVersion:'latest',sourceType:'module'});
 fs.writeFileSync(file,out.code+'\n');
 console.log(JSON.stringify({before:Buffer.byteLength(code),after:Buffer.byteLength(out.code)+1}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
