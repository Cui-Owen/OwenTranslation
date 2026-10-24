(() => {
  'use strict';
  const C=globalThis.ImtMagpieCore;
  const send=async (op,data={})=>{const r=await chrome.runtime.sendMessage({namespace:'imt-magpie-v1',op,...data});if(!r?.ok)throw Error(r?.error || 'Magpie 后台无响应');return r.data;};
  const sessions=new WeakMap();let active,sequence=0;
  function stop(){sequence++;if(active){clearInterval(active.timer);active.stopped=true;active=null;}send('cancel').catch(()=>{});}
  const currentUrl=()=>location.href;
  async function begin(host){
    stop();const token=sequence,url=currentUrl();
    let config;
    try{config=await send('settings');}catch{return {enabled:false};}
    if(token!==sequence || url!==currentUrl())return {enabled:false,stale:true};
    const run={enabled:config.enabled,token,url,stopped:false,host,initialAttach:null};
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
    for(const index of order){
      if(!await check(run,videoId) || host.lastAttachSubtitle!==run.initialAttach)break;
      let response;
      try{response=await send('segment',{id:run.token+':'+index,chunk:blocks[index],lang});}
      catch{if(!valid(run))break;continue;}
      if(!await check(run,videoId) || host.lastAttachSubtitle!==run.initialAttach)break;
      try{result[index]=C.cues(blocks[index].units,C.parseEnds(JSON.stringify(response),blocks[index].units.length));}catch{continue;}
      let items=flatten();
      if(hooks.prepare)items=hooks.prepare(items);
      const detail={subtitleItems:items,lang,video,magpie:true};
      globalThis.dispatchEvent(new CustomEvent('imt-attach-subtitle-update',{detail}));
      run.initialAttach.subtitleItems=detail.subtitleItems;
      hooks.cache(detail.subtitleItems);
      video?.dispatchEvent?.(new Event('timeupdate'));
    }
    if(active===run){clearInterval(run.timer);active=null;}
  }
  globalThis.addEventListener('pagehide',stop);
  globalThis.addEventListener('yt-navigate-start',stop);
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local' && changes.imtMagpieSettingsV1)stop();});
  globalThis.ImtMagpieLocal={begin,start,stop};
})();
