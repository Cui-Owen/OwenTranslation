'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {Patch,walk}=require('./patch-lib.cjs');
const {owenEnforceConfig}=require('./policy.cjs');
const slim=require('./shrink.cjs');
const root=path.resolve(__dirname,'..'),src=path.join(root,'upstream'),dest=path.join(root,'extension');
const files=new Map();
const ctx={walk,file(name){if(!files.has(name))files.set(name,new Patch(name,fs.readFileSync(path.join(src,name),'utf8')));return files.get(name);}};
const patches=['core','media','ui','account','offline','network','icons','unlock','selection','inpage','brand','segment','sidepanel'].map(name=>require('./patch-'+name+'.cjs'));
// The toolbar popup, settings page and text side panel are built from ui/
// (React + Radix, see ui/README.md); the upstream pages and stylesheets behind
// them are not shipped. side-panel.js stays as the side panel's engine.
const RETIRED=['popup.js','popup.html','popup-layout-bootstrap.js','options.js','options.html','side-panel.html',
 ...['popup','options','pico','notie','common','tailwind-compat','base'].map(n=>`styles/${n}.css`)];
for(const patch of patches)patch(ctx);
const manifest=JSON.parse(fs.readFileSync(path.join(src,'manifest.json'),'utf8'));
if(manifest.name!=='欧文翻译'||manifest.version!=='1.34.3')throw new Error('Unexpected upstream extension');
fs.rmSync(dest,{recursive:true,force:true});
fs.mkdirSync(dest,{recursive:true});
fs.cpSync(src,dest,{recursive:true});
for(const name of ['_metadata','MAGPIE-BUILD.json','OWEN-BRAND.json','OWEN-BUILD.json',...RETIRED])fs.rmSync(path.join(dest,name),{recursive:true,force:true});
const records=[];
for(const [name,p] of files){
 if(RETIRED.includes(name))continue;
 const reduction=slim.shrink(name,p.render());
 const output=reduction.code;
 // Parse before writing so overlapping edits or invalid syntax cannot create a release.
 require('acorn').parse(output,{ecmaVersion:'latest',sourceType:'module'});
 fs.writeFileSync(path.join(dest,name),output);
 const prune=spawnSync(process.execPath,[path.join(__dirname,'prune.cjs'),path.join(dest,name)],{encoding:'utf8',maxBuffer:1024*1024});
 if(prune.status!==0)throw new Error(name+': '+prune.stderr);
 const sizes=JSON.parse(prune.stdout);
 records.push({name,before:Buffer.byteLength(p.source),patched:Buffer.byteLength(output),after:sizes.after,edits:[...p.edits,...reduction.edits].map(({label,start,end})=>({label,start,end}))});
}
for(const patch of patches)if(patch.finish)patch.finish(dest);
for(const name of ['default_config.json','default_config.content.json']){
 const file=path.join(dest,name),config=JSON.parse(fs.readFileSync(file,'utf8'));
 fs.writeFileSync(file,JSON.stringify(owenEnforceConfig(config))+'\n');
}
slim.finish(dest);
const mf=path.join(dest,'manifest.json'),m=JSON.parse(fs.readFileSync(mf,'utf8'));
m.version=require('../package.json').version;
m.version_name='欧文翻译 v'+m.version.split('.')[0];
m.description='网页双语翻译与视频字幕翻译，支持 AI 智能分句。';
m.default_locale='zh_CN';
m.options_page='options.html';
// Store and extensions page show the app tile; the toolbar keeps the bare mark.
m.icons=Object.fromEntries([32,48,64,128,256].map(s=>[s,`icons/app-${s}.png`]));
m.permissions=m.permissions.filter(p=>!['webRequest','declarativeNetRequestFeedback','declarativeNetRequest'].includes(p));
delete m.declarative_net_request;
fs.rmSync(path.join(dest,'request_modifier_rule.json'),{force:true});
delete m.commands.openAiWritingModal;
fs.writeFileSync(mf,JSON.stringify(m,null,2)+'\n');
buildUI();
function buildUI(){
 // Data read from the upstream bundle (languages, service icons), then a type
 // check, then the two pages with their shared chunks into the extension root.
 require('./ui-data.cjs').build();
 const run=(args,env)=>{const r=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',env:{...process.env,...env}});if(r.status!==0)throw new Error(args.join(' ')+'\n'+r.stdout+r.stderr);};
 run([path.join(root,'node_modules/typescript/bin/tsc'),'-p','ui/tsconfig.json']);
 run([path.join(root,'node_modules/vite/bin/vite.js'),'build','--config','ui/vite.config.mts','--logLevel','warn'],{OWEN_UI_OUT:dest});
 for(const page of ['popup.html','options.html','side-panel.html'])assert.ok(fs.readFileSync(path.join(dest,page),'utf8').includes('src="./ui/'),page+': UI entry');
 assert.ok(fs.readFileSync(path.join(dest,'side-panel.html'),'utf8').includes('<script src="./side-panel.js"></script>'),'side panel engine script');
}
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const info={name:m.name,version:m.version_name,scope:'local',createdAt:new Date().toISOString(),patches:records,files:{}};
function inventory(dir,base=''){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const rel=path.join(base,entry.name),f=path.join(dir,entry.name);if(entry.isDirectory())inventory(f,rel);else info.files[rel]={bytes:fs.statSync(f).size,sha256:hash(f)};}}
inventory(dest);
fs.writeFileSync(path.join(dest,'OWEN-BUILD.json'),JSON.stringify(info,null,2)+'\n');
fs.mkdirSync(path.join(root,'work'),{recursive:true});
fs.writeFileSync(path.join(root,'work','patch-report.json'),JSON.stringify(records,null,2)+'\n');
console.log(JSON.stringify(records.map(({name,before,after,edits})=>({name,before,after,edits:edits.length})),null,2));
