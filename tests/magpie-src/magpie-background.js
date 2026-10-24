/* Loaded before the original MV3 worker. Own message namespace and storage keys. */
(() => {
  'use strict';
  const C=globalThis.ImtMagpieCore, KEY='imtMagpieSettingsV1', CACHE='imtMagpieBoundaryCacheV1', STATUS='imtMagpieStatusV1';
  const jobs=new Map(), epochs=new Map(); let cachePromise, writes=Promise.resolve(), settingsEpoch=0;
  const owner=s=>`${s.tab?.id ?? 'extension'}:${s.frameId ?? 0}`;
  async function prefs(){return C.settings((await chrome.storage.local.get(KEY))[KEY]);}
  async function cache(){return cachePromise ||= chrome.storage.local.get(CACHE).then(x=>new Map(Object.entries(x[CACHE] || {})));}
  async function hash(value){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));return Array.from(new Uint8Array(d),x=>x.toString(16).padStart(2,'0')).join('');}
  function headers(){return {'Content-Type':'application/json','Authorization':'Bearer magpie-immersive-subtitles'};}
  async function saveStatus(data){await chrome.storage.local.set({[STATUS]:{...data,at:Date.now()}});}
  function cancel(who){epochs.set(who,(epochs.get(who)||0)+1);for(const [id,job] of jobs) if(job.owner===who){job.controller.abort();jobs.delete(id);}}
  async function request(url, init, controller, timeout){
    const timer=setTimeout(()=>controller.abort(),timeout);
    try {const r=await fetch(url,{...init,signal:controller.signal,redirect:'error'});if(!r.ok) throw Error(`Magpie HTTP ${r.status}`);return await r.json();}
    finally{clearTimeout(timer);}
  }
  async function handle(m,sender){
    const who=owner(sender);
    if(m.op==='settings') return prefs();
    if(m.op==='cancel'){cancel(who);return true;}
    if(m.op==='clearCache'){const c=await cache();c.clear();writes=writes.catch(()=>{}).then(()=>chrome.storage.local.remove(CACHE));await writes;return true;}
    const epoch=epochs.get(who)||0, revision=settingsEpoch;
    if(m.op==='segment' && !epochs.has(who))epochs.set(who,epoch);
    const p=await prefs();
    if(m.op==='segment' && (epoch!==(epochs.get(who)||0) || revision!==settingsEpoch))throw Error('已取消');
    if(m.op==='models'){
      const controller=new AbortController();
      const data=await request(C.endpoint(m.baseUrl || p.baseUrl)+'/models',{headers:headers()},controller,10000);
      return (data.data || []).map(x=>({id:x.id,name:x.display_name || x.id}));
    }
    if(m.op!=='segment') throw Error('未知 Magpie 操作');
    if(!p.enabled) throw Error('Magpie 分句已关闭');
    const chunk=m.chunk;
    if(!chunk || !Array.isArray(chunk.units) || !chunk.units.length || chunk.units.length>500 || JSON.stringify(chunk).length>100000) throw Error('字幕分块无效');
    const controller=new AbortController(), id=who+':'+String(m.id);
    jobs.get(id)?.controller.abort();
    jobs.set(id,{owner:who,controller});
    try {
      const key=await hash([C.VERSION,p.baseUrl,p.model,m.lang,chunk]);
      const store=await cache(), saved=store.get(key);
      if(controller.signal.aborted) throw Error('已取消');
      if(saved && Date.now()-saved.at<7*86400000){
        try{const ends=C.parseEnds(JSON.stringify({ends:saved.ends}),chunk.units.length);await saveStatus({state:'cache',model:p.model});return {ends,cached:true};}
        catch{store.delete(key);}
      }
      const data=await request(p.baseUrl+'/chat/completions',{
        method:'POST',headers:headers(),body:JSON.stringify({model:p.model,messages:C.messages(chunk,m.lang),stream:false,max_tokens:4096})
      },controller,p.timeout);
      if(controller.signal.aborted) throw Error('已取消');
      const content=data.choices?.[0]?.message?.content;
      const text=Array.isArray(content)?content.map(x=>x.text || '').join(''):content;
      const ends=C.parseEnds(text,chunk.units.length);
      store.delete(key);store.set(key,{at:Date.now(),ends});
      while(store.size>120)store.delete(store.keys().next().value);
      writes=writes.catch(()=>{}).then(()=>chrome.storage.local.set({[CACHE]:Object.fromEntries(store)}));await writes;
      await saveStatus({state:'ok',model:p.model,cues:ends.length});
      return {ends,cached:false};
    } catch(e){
      if(!controller.signal.aborted)await saveStatus({state:'fallback',model:p.model,error:String(e.message || e).slice(0,180)});
      throw e;
    } finally{if(jobs.get(id)?.controller===controller)jobs.delete(id);}
  }
  chrome.runtime.onMessage.addListener((m,sender,respond)=>{
    if(!m || m.namespace!=='imt-magpie-v1' || sender.id!==chrome.runtime.id)return;
    handle(m,sender).then(data=>respond({ok:true,data}),e=>respond({ok:false,error:e.message || String(e)}));
    return true;
  });
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local' && changes[KEY]){settingsEpoch++;for(const job of jobs.values())job.controller.abort();}});
  chrome.tabs.onRemoved.addListener(tabId=>{for(const who of epochs.keys())if(who.startsWith(tabId+':'))epochs.set(who,epochs.get(who)+1);for(const [id,job] of jobs)if(job.owner.startsWith(tabId+':')){job.controller.abort();jobs.delete(id);}});
})();
