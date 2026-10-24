const {owenEnforceConfig}=require('./policy.cjs');
const mergeNames={'background.js':'$a','side-panel.js':'Cs','content_main.js':'Jf'};
const telemetry={
  'background.js':{ga:['d0'],noop:['Ez','$7','wk'],report:['rq']},
  'side-panel.js':{ga:['rO'],noop:['h2e','dA','nie','rie','P_e'],nil:['wTe'],report:['BTe']},
  'content_main.js':{ga:['NV'],noop:['k_e','XD','Wle','Qle','XQe'],nil:['ORe'],report:['YRe']}
};
module.exports=ctx=>{
  for(const [name,fn] of Object.entries(mergeNames)){
    const p=ctx.file(name), n=p.function(fn);
    const ret=n.body.body.findLast(x=>x.type==='ReturnStatement');
    if(!ret || ret.argument.type!=='SequenceExpression') throw new Error(name+': config return changed');
    const last=ret.argument.expressions.at(-1);
    if(last.type!=='Identifier') throw new Error(name+': config result changed');
    p.replace(last.start,last.end,`owenEnforceConfig(${last.name})`,'final configuration policy');
    p.replace(0,0,owenEnforceConfig.toString()+'\n','configuration policy definition');
    // DeepLX is part of the public core catalogue, independent of upstream beta.
    const deeplx=p.nodes('ObjectExpression').flatMap(o=>o.properties).filter(x=>(x.key?.name??x.key?.value)==='deeplx'&&x.value?.type==='ObjectExpression');
    let gates=0;
    for(const service of deeplx){
      const beta=service.value.properties.find(x=>(x.key?.name??x.key?.value)==='beta');
      if(beta){p.replace(beta.value.start,beta.value.end,'false','core: expose DeepLX template');gates++;}
    }
    if(gates!==1)throw new Error(name+': DeepLX descriptor changed');
    const t=telemetry[name];
    for(const x of t.ga||[])p.body(x,'return [];','remove analytics endpoints');
    for(const x of t.noop||[])p.body(x,'','remove telemetry gateway '+x);
    for(const x of t.nil||[])p.body(x,'return null;','remove telemetry preparation');
    for(const x of t.report||[])p.body(x,'return {async report(){}};','remove language statistics');
  }
  const bg=ctx.file('background.js');
  bg.body('i5','return null;','remove background analytics endpoint');
  bg.body('jE','Y.runtime.onInstalled.addListener(()=>{Zm()});','local installation initialization');
  bg.body('jc','','remove uninstall survey');
  const content=ctx.file('content_main.js');
  content.body('HZ','return Fl.initialize({defaultEnabled:false,read:async()=>({sensitiveConfig:{telemetry:false}}),subscribe:async()=>({ready:true,dispose(){}})});','disable consent telemetry watcher');

  const langTargets={
    'background.js':['targetLanguage:ta,interfaceLanguage:"en",','targetLanguage:ta,interfaceLanguage:"zh-CN",','let r=e.map(n=>wr(n)).find(n=>d5.find(a=>a===n));return r||"en"','let r=e.map(n=>wr(n)).find(n=>d5.find(a=>a===n));return r||"zh-CN"'],
    'side-panel.js':['targetLanguage:bs,interfaceLanguage:"en",','targetLanguage:bs,interfaceLanguage:"zh-CN",','let n=e.map(r=>gn(r)).find(r=>lO.find(i=>i===r));return n||"en"','let n=e.map(r=>gn(r)).find(r=>lO.find(i=>i===r));return n||"zh-CN"']
  };
  for(const [file,[t1,r1,t2,r2]] of Object.entries(langTargets)){
    const p=ctx.file(file);
    p.once(t1,r1,file+': default interface language to zh-CN');
    p.once(t2,r2,file+': language detection fallback to zh-CN');
  }
};
