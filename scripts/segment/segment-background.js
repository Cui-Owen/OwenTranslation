/* Loaded before the original MV3 worker: boundary cache for AI subtitle segmentation. */
(() => {
  'use strict';
  const CACHE='owenSegmentCacheV1', LIMIT=120, AGE=7*86400000;
  let cachePromise, writes=Promise.resolve();
  async function cache(){return cachePromise ||= chrome.storage.local.get(CACHE).then(x=>new Map(Object.entries(x[CACHE] || {})));}
  async function hash(value){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));return Array.from(new Uint8Array(d),x=>x.toString(16).padStart(2,'0')).join('');}
  function persist(store){writes=writes.catch(()=>{}).then(()=>store.size?chrome.storage.local.set({[CACHE]:Object.fromEntries(store)}):chrome.storage.local.remove(CACHE));return writes;}
  async function handle(m){
    const store=await cache();
    if(m.op==='clearCache'){store.clear();await persist(store);return true;}
    if(!Array.isArray(m.key) || JSON.stringify(m.key).length>200000) throw Error('分句缓存键无效');
    const key=await hash(m.key);
    if(m.op==='cacheGet'){
      const saved=store.get(key);
      if(!saved)return null;
      if(Date.now()-saved.at<AGE && Array.isArray(saved.ends))return saved.ends;
      store.delete(key);await persist(store);return null;
    }
    if(m.op==='cachePut'){
      if(!Array.isArray(m.ends) || !m.ends.every(Number.isInteger)) throw Error('分句边界无效');
      store.delete(key);store.set(key,{at:Date.now(),ends:m.ends});
      while(store.size>LIMIT)store.delete(store.keys().next().value);
      await persist(store);return true;
    }
    throw Error('未知分句操作');
  }
  chrome.runtime.onMessage.addListener((m,sender,respond)=>{
    if(!m || m.namespace!=='owen-segment-v1' || sender.id!==chrome.runtime.id)return;
    handle(m).then(data=>respond({ok:true,data}),e=>respond({ok:false,error:e.message || String(e)}));
    return true;
  });
  // Storage left by the retired Magpie-only adapter (0.3): cache and status carry no settings.
  chrome.runtime.onInstalled.addListener(()=>{chrome.storage.local.remove(['imtMagpieBoundaryCacheV1','imtMagpieStatusV1']).catch(()=>{});});
})();
