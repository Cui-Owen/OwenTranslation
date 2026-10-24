'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const {Patch}=require('../scripts/patch-lib.cjs');
const {owenEnforceConfig}=require('../scripts/policy.cjs');
const {COMMANDS}=require('../scripts/shrink.cjs');
const dir=path.resolve(__dirname,'../extension'),read=n=>fs.readFileSync(path.join(dir,n),'utf8');
const manifest=JSON.parse(read('manifest.json'));
assert.deepEqual(Object.keys(manifest.commands),COMMANDS);
assert.equal(manifest.commands.toggleTranslatePage.suggested_key.default,'Alt+A');
assert.equal(manifest.commands.toggleSidePanel.suggested_key.default,'Alt+S');
assert.equal(manifest.commands.translateInputBox.suggested_key.default,'Alt+I');
assert.equal(manifest.content_security_policy.extension_pages,"script-src 'self'; object-src 'self'");
for(const locale of fs.readdirSync(path.join(dir,'_locales'))){
 const messages=JSON.parse(read('_locales/'+locale+'/messages.json'));
 for(const [,key]of JSON.stringify(manifest).matchAll(/__MSG_(\w+)__/g))assert.ok(messages[key],locale+': '+key);
}
const legacy={sensitiveConfig:{sensitiveMode:'inner',sensitiveApiHost:'http://example.test/',sensitiveApiKey:'old'},'sensitiveConfig.sensitiveMode':'custom',generalRule:{sensitiveConfig:{sensitiveMode:'custom'}},rawUserConfig:{sensitiveConfig:{sensitiveMode:'inner'}}};
const cfg=owenEnforceConfig(legacy);
for(const c of [cfg,cfg.generalRule,cfg.rawUserConfig])assert.deepEqual(c.sensitiveConfig,{telemetry:false,sensitiveMode:'close'});
assert.ok(!Object.keys(cfg).some(k=>k.startsWith('sensitiveConfig.')));
// Popup, settings and side panel come from ui/: every referenced chunk exists, none is inline.
for(const file of ['options.html','popup.html','side-panel.html']){
 const html=read(file),refs=[...html.matchAll(/(?:src|href)=["']\.\/(ui\/[^"']+)/g)].map(x=>x[1]);
 assert.ok(refs.length>=3,file);for(const ref of refs)assert.ok(fs.existsSync(path.join(dir,ref)),file+': '+ref);
 assert.doesNotMatch(html,/<script(?![^>]*\bsrc=)[^>]*>|styles\/(?:pico|options|popup|notie|common|tailwind-compat)\.css/);
}
for(const name of ['popup.js','options.js','popup-layout-bootstrap.js','styles/pico.css','styles/options.css','styles/popup.css','styles/base.css','styles/owen-brand.css'])assert.ok(!fs.existsSync(path.join(dir,name)),'retired '+name);
const encodeNames={'background.js':'Dv','side-panel.js':'nV','content_main.js':'g$'};
for(const [file,encode]of Object.entries(encodeNames)){
 const code=read(file),p=new Patch(file,code);
 assert.doesNotMatch(code,/oneaifw\.com|funstory-ai\/aifw|offscreen\.html|\.offscreen\??\./);
 // The unused encode wrapper can disappear after its pipeline callers become no-ops.
 const f=p.functions(encode).length?vm.runInNewContext('('+p.text(p.function(encode))+')'):null;
 const samples=[{text:'Contact alice@example.com or +61 400 123 456.'},{text:'Keep __PII_1__ and 中文 intact.'}];
 if(f)Promise.resolve(f({sensitiveMode:'inner'},samples)).then(texts=>assert.deepEqual(Array.from(texts),samples.map(x=>x.text)));
}
const locales=JSON.parse(read('locales.json'));
for(const values of Object.values(locales)){
 for(const key of Object.keys(values))assert.ok(!/^(?:aiWriting|rewardCenter|messageCenter|imageTranslate|fileTranslate|sensitiveMode)\./.test(key),key);
 for(const key of ['subtitle.aiSegmentService','terms.title'])if(Object.hasOwn(JSON.parse(fs.readFileSync(path.resolve(__dirname,'../upstream/locales.json'),'utf8')).en,key))assert.ok(values[key],key);
}
console.log('PASS Phase 1 commands, CSP, locale references, HTML assets, legacy configuration and unchanged translation text');
