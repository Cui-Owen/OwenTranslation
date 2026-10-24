(async()=>{
  'use strict';
  const $=id=>document.getElementById(id), KEY='imtMagpieSettingsV1';
  const C=globalThis.ImtMagpieCore;
  const send=async(op,data={})=>{const r=await chrome.runtime.sendMessage({namespace:'imt-magpie-v1',op,...data});if(!r?.ok)throw Error(r?.error || '后台无响应');return r.data;};
  let saved=C.settings((await chrome.storage.local.get(KEY))[KEY]);
  $('enabled').checked=saved.enabled;$('baseUrl').value=saved.baseUrl;$('timeout').value=saved.timeout/1000;
  function option(id,name){const o=document.createElement('option');o.value=id;o.textContent=name || id;$('model').append(o);}
  option(saved.model);$('model').value=saved.model;
  const read=()=>C.settings({enabled:$('enabled').checked,baseUrl:$('baseUrl').value,model:$('model').value,timeout:Number($('timeout').value)*1000});
  const notice=text=>$('notice').textContent=text;
  async function models(){
    const list=await send('models',{baseUrl:C.endpoint($('baseUrl').value)}), selected=$('model').value;
    $('model').replaceChildren();for(const x of list)option(x.id,x.name);
    if(!list.some(x=>x.id===selected))option(selected);
    $('model').value=selected;notice(`已连接 Magpie，发现 ${list.length} 个模型。`);
  }
  $('models').onclick=()=>models().catch(e=>notice(e.message));
  $('settings').onsubmit=async e=>{e.preventDefault();try{saved=read();await chrome.storage.local.set({[KEY]:saved});notice('已保存。刷新视频页面后生效。');}catch(e){notice(e.message);}};
  $('clear').onclick=async()=>{try{await send('clearCache');notice('分句缓存已清除。');}catch(e){notice(e.message);}};
  $('test').onclick=async()=>{
    const button=$('test');button.disabled=true;
    try{
      saved=read();await chrome.storage.local.set({[KEY]:saved});if(!saved.enabled)throw Error('先启用 Magpie 分句再测试');
      const words=['Hello',' world.',' This',' is',' a',' subtitle',' test.'];
      const chunk={before:'',after:'',units:words.map((text,i)=>({text,start:i*400,end:(i+1)*400}))};
      notice('正在测试模型分句…');const r=await send('segment',{id:'connection-test',chunk,lang:'en'});
      notice(`连接成功，模型返回 ${r.ends.length} 个分句。${r.cached?'（缓存）':''}`);
    }catch(e){notice(e.message);}finally{button.disabled=false;}
  };
  function status(value){if(!value)return;$('status').textContent=`最近分句：${{ok:'成功',cache:'命中缓存',fallback:'使用基础分句'}[value.state] || value.state} · ${value.model} · ${new Date(value.at).toLocaleString()}${value.error?' · '+value.error:''}`;}
  status((await chrome.storage.local.get('imtMagpieStatusV1')).imtMagpieStatusV1);
  chrome.storage.onChanged.addListener((c,a)=>{if(a==='local' && c.imtMagpieStatusV1)status(c.imtMagpieStatusV1.newValue);});
  await models().catch(e=>notice(e.message));
})();
