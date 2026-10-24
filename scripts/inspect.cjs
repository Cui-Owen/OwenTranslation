const fs=require('node:fs');const {Patch,walk}=require('./patch-lib.cjs');const p=new Patch(process.argv[2],fs.readFileSync(process.argv[2],'utf8'));
for(const term of process.argv.slice(3)){
 const exact=p.functions(term);if(exact.length){for(const n of exact)console.log(term,p.text(n));continue;}
 let hits=[];walk.ancestor(p.ast,{Literal(n,a){if(typeof n.value==='string'&&n.value.includes(term)){const f=a.filter(x=>/Function/.test(x.type)).pop();hits.push({value:n.value.slice(0,160),start:n.start,function:f?p.text(f).slice(0,250):'',around:p.source.slice(n.start-130,n.end+100)});}}});console.log(term,JSON.stringify(hits.slice(0,12),null,2));
}
