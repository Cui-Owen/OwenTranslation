'use strict';
const fs=require('node:fs'),path=require('node:path');
const ids=[2,200,3,4,5,315,316];
module.exports=ctx=>{
 const rules=JSON.parse(fs.readFileSync(path.join(__dirname,'../upstream/request_modifier_rule.json'),'utf8')).filter(r=>ids.includes(r.id));
 for(const rule of rules)delete rule.condition.initiatorDomains;
 const p=ctx.file('background.js');
 p.replace(0,0,`{const api=globalThis.chrome;const rules=${JSON.stringify(rules)};for(const rule of rules){rule.condition.initiatorDomains=[api.runtime.id];for(const header of rule.action.requestHeaders||[]){if(header.value==='chrome-extension://cofdbpoegempjloogbagkncekinflcnj')header.value='chrome-extension://'+api.runtime.id;}}api.declarativeNetRequest.getDynamicRules().then(old=>api.declarativeNetRequest.updateDynamicRules({removeRuleIds:old.map(r=>r.id),addRules:rules})).catch(console.error);}\n`,'retain direct provider and local model request headers only');
};
