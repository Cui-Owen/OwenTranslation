'use strict';
// Toolbar popup and settings page (ui/): one version of every package, one
// component system, complete copy, and a release that matches the source.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),src=path.join(root,'ui','src'),extension=path.join(root,'extension');
let count=0;
const test=(name,run)=>{run();count++;console.log('PASS ui: '+name);};

// The only packages UI code may import. Components come from src/components/ui
// (shadcn/ui source on radix-ui); there is no second component, icon or toast library.
const ALLOWED=['react','react-dom/client','radix-ui','lucide-react','cmdk','sonner','clsx','tailwind-merge','class-variance-authority'];

function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const sources=files(src).filter(f=>/\.(tsx?|css)$/.test(f));

test('one installed version per package',()=>{
 const lock=require(path.join(root,'package-lock.json')),versions=new Map();
 for(const [p,v]of Object.entries(lock.packages)){if(!p)continue;const name=p.slice(p.lastIndexOf('node_modules/')+13);(versions.get(name)||versions.set(name,new Set()).get(name)).add(v.version);}
 const dup=[...versions].filter(([,s])=>s.size>1).map(([n,s])=>n+'@'+[...s].join('|'));
 assert.deepEqual(dup,[]);
});

test('dependencies are pinned and limited to the allowed set',()=>{
 const pkg=require(path.join(root,'package.json'));
 for(const [n,v]of Object.entries({...pkg.dependencies,...pkg.devDependencies}))assert.match(v,/^\d+\.\d+\.\d+$/,n);
 const runtime=Object.keys(pkg.dependencies).sort();
 assert.deepEqual(runtime,[...new Set(ALLOWED.map(x=>x.replace('/client','')))].sort());
});

test('UI imports only the allowed packages, Radix only through radix-ui',()=>{
 for(const f of sources.filter(f=>/\.tsx?$/.test(f))){
  for(const [,spec]of fs.readFileSync(f,'utf8').matchAll(/from\s+["']([^"']+)["']/g)){
   if(spec.startsWith('.')||spec.startsWith('@/'))continue;
   assert.ok(ALLOWED.includes(spec),path.relative(root,f)+': '+spec);
  }
 }
});

test('every message has Simplified, English and Traditional text',()=>{
 const text=fs.readFileSync(path.join(src,'lib','messages.ts'),'utf8');
 const entries=[...text.matchAll(/^\s+"([\w.]+)": \[\s*("(?:[^"\\]|\\.)*"),\s*("(?:[^"\\]|\\.)*"),\s*("(?:[^"\\]|\\.)*"),?\s*\]/gm)];
 assert.ok(entries.length>300,'messages parsed: '+entries.length);
 for(const [,key,...values]of entries)for(const v of values)assert.ok(JSON.parse(v).trim(),key);
 const vars=s=>[...JSON.parse(s).matchAll(/\{(\w+)\}/g)].map(x=>x[1]).sort().join();
 for(const [,key,zh,en,tw]of entries){assert.equal(vars(en),vars(zh),key+' en vars');assert.equal(vars(tw),vars(zh),key+' zh-TW vars');}
});

test('released pages load external module chunks only',()=>{
 for(const page of ['popup.html','options.html','side-panel.html']){
  const html=fs.readFileSync(path.join(extension,page),'utf8');
  assert.doesNotMatch(html,/<script(?![^>]*\bsrc=)/,page+': inline script');
  const refs=[...html.matchAll(/(?:src|href)="\.\/(ui\/[^"]+)"/g)].map(m=>m[1]);
  assert.ok(refs.some(r=>r.includes('vendor-')),page+': shared vendor chunk');
  for(const r of refs)assert.ok(fs.existsSync(path.join(extension,r)),page+': '+r);
 }
 const chunks=fs.readdirSync(path.join(extension,'ui'));
 assert.equal(chunks.filter(n=>n.startsWith('vendor-')).length,1,'one vendor chunk');
 // React ships once, inside the vendor chunk.
 const reactCopies=chunks.filter(n=>n.endsWith('.js')).filter(n=>fs.readFileSync(path.join(extension,'ui',n),'utf8').includes('__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE'));
 assert.deepEqual(reactCopies.map(n=>n.split('-')[0]),['vendor']);
});

test('side panel keeps side-panel.js as a headless engine for the React page',()=>{
 const html=fs.readFileSync(path.join(extension,'side-panel.html'),'utf8'),engine=fs.readFileSync(path.join(extension,'side-panel.js'),'utf8');
 // Classic engine script runs before the deferred module page, into a hidden mount.
 assert.match(html,/<div id="mount" hidden><\/div>/);assert.ok(html.indexOf('<script src="./side-panel.js"></script>')>0);
 assert.ok(engine.includes('globalThis.OwenSidePanel={bridge:owenSidePanelBridge,engine:{'),'engine API');
 assert.ok(engine.includes('owenSidePanelBridge.publish({theme:n,ctx:i,config:r,tab:K,surface:O'),'controller publishes instead of rendering');
 // Every engine function the page calls is declared in the engine typings and used through them.
 const api=[...engine.slice(engine.indexOf('engine:{')).matchAll(/\n (\w+):/g)].map(m=>m[1]);
 const types=fs.readFileSync(path.join(src,'side-panel','engine.ts'),'utf8');
 for(const name of api)assert.match(types,new RegExp(`\\b${name}\\(`),name);
});

test('settings routes still answer the links the side panel and pages use',()=>{
 const app=fs.readFileSync(path.join(src,'options','App.tsx'),'utf8');
 for(const route of ['general','services','terms','selection_translation','mouse_hover','input','subtitle','shortcuts','import_export','about'])assert.ok(app.includes(`id: "${route}"`),route);
 assert.match(app,/advanced: "page"/);
});

console.log(`PASS ${count} UI checks`);
