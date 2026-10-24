(() => {
  'use strict';
  const C=globalThis.ImtSegmentCore, TIMEOUT=45000, MAX_FAILURES=2;
  // The background only keeps the boundary cache; requests go through the page's own translator.
  const send=async (op,data={})=>{const r=await chrome.runtime.sendMessage({namespace:'owen-segment-v1',op,...data});if(!r?.ok)throw Error(r?.error || '分句缓存无响应');return r.data;};
  const sessions=new WeakMap();let active,sequence=0;
  function stop(){sequence++;if(active){clearInterval(active.timer);active.controller.abort();active.stopped=true;active=null;}}
  const currentUrl=()=>location.href;
  function selected(host){
    const id=host.config?.aiSegmentService, service=id && host.ctx?.config?.translationServices?.[id];
    // Cache entries follow the model actually asked, so changing either invalidates them.
    return service ? {id,cacheId:[id,service.type||'',service.model||'',service.apiUrl||'']} : null;
  }
  async function begin(host){
    stop();const token=sequence,url=currentUrl(),service=selected(host);
    const run={enabled:!!service,service:service?.id,cacheId:service?.cacheId,token,url,stopped:false,host,initialAttach:null,controller:new AbortController()};
    sessions.set(host,run);
    if(run.enabled)active=run;
    return run;
  }
  function valid(run){return !run.stopped && run.token===sequence && run.url===currentUrl() && !run.host.tempDisableSubtitle;}
  async function check(run,id){
    if(!valid(run))return false;
    if(id && !await run.host.isYoutubeSubtitleRequestCurrent(id))return false;
    return valid(run);
  }
  async function boundaries(run,block,lang,request){
    const key=[C.VERSION,run.cacheId,lang,block];
    const saved=await send('cacheGet',{key}).catch(()=>null);
    if(saved){try{return C.parseEnds(JSON.stringify({ends:saved}),block.units.length);}catch{}}
    const {system,user}=C.prompt(block,lang);
    const text=await request(system,user,AbortSignal.any([run.controller.signal,AbortSignal.timeout(TIMEOUT)]));
    const ends=C.parseEnds(text,block.units.length);
    send('cachePut',{key,ends}).catch(()=>{});
    return ends;
  }
  async function start(host,events,lang,videoId,run,hooks){
    if(sessions.get(host)!==run || !run.enabled || !await check(run,videoId))return;
    let all;
    try{all=C.units(events);}catch{return;}
    if(!all.length)return;
    const blocks=C.chunks(all), result=blocks.map(b=>C.cues(b.units,C.fallbackEnds(b.units)));
    const flatten=()=>result.flat();
    // Snapshot the attachment; never reattach after navigation, disable or another track wins.
    host.attachSubtitle(flatten(),lang);
    run.initialAttach=host.lastAttachSubtitle;
    if(!run.initialAttach)return;
    run.timer=setInterval(()=>{if(currentUrl()!==run.url || host.tempDisableSubtitle || host.lastAttachSubtitle!==run.initialAttach)stop();},300);
    const video=document.querySelector(host.config.videoSelector || 'video');
    const cursor=(video?.currentTime || 0)*1000;
    const order=blocks.map((b,i)=>i).sort((a,b)=>{
      const distance=i=>cursor>=blocks[i].units[0].start && cursor<=blocks[i].units.at(-1).end ? -1 : Math.abs(blocks[i].units[0].start-cursor);
      return distance(a)-distance(b);
    });
    let failures=0;
    for(const index of order){
      if(!await check(run,videoId) || host.lastAttachSubtitle!==run.initialAttach)break;
      let ends;
      try{ends=await boundaries(run,blocks[index],lang,hooks.request);failures=0;}
      // An unreachable or misconfigured service keeps the local cues instead of stalling every block.
      catch{if(!valid(run) || ++failures>=MAX_FAILURES)break;continue;}
      if(!await check(run,videoId) || host.lastAttachSubtitle!==run.initialAttach)break;
      result[index]=C.cues(blocks[index].units,ends);
      let items=flatten();
      if(hooks.prepare)items=hooks.prepare(items);
      const detail={subtitleItems:items,lang,video,aiSegment:true};
      globalThis.dispatchEvent(new CustomEvent('imt-attach-subtitle-update',{detail}));
      run.initialAttach.subtitleItems=detail.subtitleItems;
      hooks.cache(detail.subtitleItems);
      video?.dispatchEvent?.(new Event('timeupdate'));
    }
    if(active===run){clearInterval(run.timer);active=null;}
  }
  globalThis.addEventListener('pagehide',stop);
  globalThis.addEventListener('yt-navigate-start',stop);
  globalThis.ImtSegmentLocal={begin,start,stop};
})();
