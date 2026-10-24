'use strict';
// Execute the actual patched persistence/CAS/coordinator functions in isolation.
// Storage is an in-memory implementation of Chrome's structured-clone contract;
// the IndexedDB fallback is checked for byte preservation, not simulated here.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const {Patch,walk}=require('../scripts/patch-lib.cjs');
const root=path.resolve(__dirname,'..'),files=new Map();
const ctx={walk,file(name){if(!files.has(name))files.set(name,new Patch(name,fs.readFileSync(path.join(root,'upstream',name),'utf8')));return files.get(name);}};
require('../scripts/patch-account.cjs')(ctx);
const original=ctx.file('background.js'),patched=new Patch('patched background',original.render());
const definitions=['_o','ni','Lc','Yw','Kw','Qw','sE','eE','gt','Q3','Bw','zn','da','ri'];
const source=definitions.map(n=>patched.text(patched.function(n))).join('\n');
let lock=Promise.resolve(),count=0,networkCalls=0;
const store=new Map(),clone=v=>v===undefined?undefined:structuredClone(v);
const sandbox={crypto:webcrypto,TextEncoder,structuredClone,Map,Date,console,module:{exports:{}},
 Y:{storage:{local:{}}},_m:new Map(),be:'owen-test',
 // Empty legacy database: new keys have no fallback record to migrate.
 async Gn(){return {transaction(){return {objectStore(){return {get(){const request={result:undefined};queueMicrotask(()=>request.onsuccess?.());return request;}}}}},close(){}};},
 Xr(fn){const next=lock.then(fn,fn);lock=next.catch(()=>{});return next;},
 te:{local:{async get(k,f){return clone(store.has(k)?store.get(k):f)},async set(k,v){store.set(k,clone(v));},async remove(k){for(const key of Array.isArray(k)?k:[k])store.delete(key);}}}};
vm.runInNewContext(source+'\nmodule.exports={'+definitions.join(',')+'};',sandbox);
const api=sandbox.module.exports;
function same(a,b,message){assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),message);count++;}
function ok(v,message){assert.ok(v,message);count++;}
async function main(){
 for(const n of ['_o','ni','Lc','Yw','Kw','Qw','sE']){assert.equal(patched.text(patched.function(n)),original.text(original.function(n)),n+' local implementation changed');count++;}
 const rollback=api.eE({});let dirty={},history=[],baselines={};
 const cloud=()=>{networkCalls++;throw new Error('unexpected cloud call');};
 const adapter={assertWriteAllowed:rollback.assertWriteAllowed,
  queryTerms:id=>api.ni(id,false),saveTerms:term=>api._o(term,false),deleteTerms:id=>api.Lc(id,true),
  readDirty:async()=>clone(dirty),writeDirty:async v=>{dirty=clone(v)},
  writeDirtyIntent:async v=>{dirty[v.glossaryId]=clone(v)},removeDirty:async id=>{delete dirty[id]},
  readHistory:async()=>clone(history),writeHistory:async v=>{history=clone(v)},
  readBaselines:async()=>clone(baselines),writeBaselines:async v=>{baselines=clone(v)},
  canSync:async()=>false,withLocalCommitLock:sandbox.Xr,recoverPendingIntents:async()=>{},
  getSyncSource:cloud,readRemote:cloud,upload:cloud,deleteRemote:cloud,
  platform:'native',isMobile:()=>false,createId:()=> 'restored-local',now:()=>1760000000000};
 const coordinator=api.sE(adapter);
 // Imported JSON uses the same local save path as editing. Include language,
 // punctuation, empty target and comma-bearing entries to expose data loss.
 const imported=JSON.parse(JSON.stringify({id:'custom-local-test',name:'本地词表',author:'self',active:true,glossaries:[{k:'token, key',v:'令牌，密钥',tl:'zh-CN'},{k:'OpenAI',v:'',tl:'auto'}]}));
 const created=await api.Yw(adapter,{term:imported,expectedHash:null});
 same(created.status,'saved','create imported glossary');
 same((await api.ni(imported.id,false)).glossaries,imported.glossaries,'local read preserves imported entries');
 ok(store.has('term_meta_'+imported.id)&&store.has('term_glossary_'+imported.id),'metadata and entries both persist');
 same(JSON.parse(JSON.stringify(await api.ni(imported.id,false))).glossaries,imported.glossaries,'JSON export roundtrip preserves entries');
 await api.Kw(adapter,{id:imported.id,name:'改名词表'});
 same((await api.ni(imported.id,false)).glossaries,imported.glossaries,'metadata-only edit preserves entries');
 same((await api.ni(imported.id,false)).name,'改名词表','metadata edit saved');
 const before=await api.ni(imported.id,false),hash=await api.gt(before);
 const outcomes=await Promise.all(['A','B'].map(name=>api.Yw(adapter,{term:{...before,name},expectedHash:hash})));
 same(outcomes.map(x=>x.status).sort(),['saved','stale'],'concurrent edits protect against lost updates');
 const live=await api.ni(imported.id,false);
 same((await api.Yw(adapter,{term:{...live,name:'stale'},expectedHash:hash})).status,'stale','stale editor cannot overwrite newer revision');
 same((await api.ni(imported.id,false)).name,live.name,'stale attempt preserves latest data');
 // A queued cloud intent can exist in old profiles. Local editing remains
 // available and its generation must advance atomically with the snapshot.
 dirty[imported.id]={glossaryId:imported.id,generation:3,phase:'queued',targetSnapshot:live,latestLocalHash:await api.gt(live)};
 const edited=await api.Yw(adapter,{term:{...live,name:'离线编辑'},expectedHash:await api.gt(live)});
 same(edited.status,'saved','old sync intent does not block local edit');
 same(dirty[imported.id].generation,4,'local intent generation advances');
 same(dirty[imported.id].phase,'queued','local commit finishes intent');
 same(dirty[imported.id].targetSnapshot.name,'离线编辑','intent contains committed snapshot');
 same(await coordinator.consume(),{[imported.id]:'not_needed'},'background consumes no cloud work');
 same(await coordinator.uploadIfClean(imported.id,await api.gt(edited.term)),false,'upload adapter is disabled');
 same(await rollback.getState(imported.id),null,'retired cloud rollback state does not lock editor');
 same((await rollback.rollback(imported.id)).status,'rejected','remote rollback cannot write local terms');
 history=[{id:'history-1',snapshot:{...edited.term,langsHash:{en:'old'},localLangsHash:{en:'old'},deleteRemoteGlossaries:['old']}}];
 const restored=await coordinator.restore('history-1');
 same(restored.id,'custom-restored-local','restore produces independent local glossary');
 same(restored.glossaries,imported.glossaries,'history restore preserves terms');
 ok(!('langsHash'in restored)&&!('localLangsHash'in restored)&&!('deleteRemoteGlossaries'in restored),'history restore drops remote bookkeeping');
 same((await coordinator.listHistory()).length,1,'local history remains readable');
 same(await coordinator.deleteHistory('history-1'),[],'local history deletion remains available');
 await coordinator.deleteWhenIdle(imported.id);
 ok(!store.has('term_meta_'+imported.id)&&!store.has('term_glossary_'+imported.id),'delete removes both local storage records');
 ok(!dirty[imported.id],'delete clears local pending intent');
 same((await api.ni(restored.id,false)).glossaries,imported.glossaries,'deleting original preserves restored copy');
 same(networkCalls,0,'CRUD, conflict checks, history and delete issue no cloud requests');
 console.log('PASS '+count+' patched local glossary persistence, CAS, concurrency, history and offline checks');
}
main().catch(e=>{console.error(e);process.exitCode=1});
