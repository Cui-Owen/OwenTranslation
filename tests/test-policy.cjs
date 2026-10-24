'use strict';
const assert=require('node:assert/strict');
const {owenEnforceConfig:apply}=require('../scripts/policy.cjs');
const source={translationService:'openai-pro',subtitleTranslateService:'free-model',inputTranslationService:'inherit',pcFloatBall:{enable:true},'pcFloatBall.add_v.[1.30.3]':{enable:true},interfaceLanguage:'fr',translationServices:{openai:{provider:'pro',APIKEY:'preserved-key'},'openai-pro':{provider:'pro',extends:'openai'},'siliconcloud-free':{provider:'custom',enableImtServe:true},myLocal:{extends:'custom-ai',apiUrl:'http://127.0.0.1:3425/v1/chat/completions',APIKEY:'local-key',model:'local-model'},myProxy:{extends:'custom-ai',apiUrl:'https://my.example.com/v1/chat/completions',APIKEY:'proxy-key'},oldGateway:{apiUrl:'https://aigw1.immersivetranslate.com/v1/chat/completions'}},rawUserConfig:{translationService:'claude-max',pcFloatBall:{enable:true}},generalRule:{ytAsrConfig:{aiEnable:true},paragraphMinTextCount:21}};
const config=apply(structuredClone(source));
assert.equal(apply({translationService:'custom-ai-team-pro',translationServices:{'custom-ai-team-pro':{extends:'custom-ai',APIKEY:'keep'}}}).translationServices['custom-ai-team-pro'].APIKEY,'keep');
assert.equal(config.translationService,'bing');assert.equal(config.subtitleTranslateService,'inherit');assert.equal(config.inputTranslationService,'inherit');
assert.equal(config.rawUserConfig.translationService,'bing');assert.equal(config.pcFloatBall.enable,false);assert.equal(config['pcFloatBall.add_v.[1.30.3]'],undefined);
assert.equal(config.translationServices.openai.APIKEY,'preserved-key');assert.equal(config.translationServices.openai.provider,'custom');
assert.deepEqual(config.translationServices.myLocal,{...source.translationServices.myLocal,provider:'custom',enableImtServe:false});assert.equal(config.translationServices.myProxy.APIKEY,'proxy-key');
for(const key of ['openai-pro','siliconcloud-free','oldGateway'])assert.equal(config.translationServices[key],undefined);
assert.equal(apply({userTranslationServices:{translationService:'openai-pro'},accurateConfigs:{AO3:{enable:true,translationService:'deepseek-pro'}}}).accurateConfigs.AO3.translationService,'bing');
assert.equal(apply({userTranslationServices:{translationService:'openai-pro'}}).userTranslationServices.translationService,'bing');
assert.equal(config.disableRuleUpdate,true);assert.equal(config.generalRule.ytAsrConfig.aiEnable,false);
// Only the official server ASR is retired; the local basic optimization follows the user.
for(const enable of [true,false])assert.equal(apply({generalRule:{ytAsrConfig:{enable,aiEnable:true}}}).generalRule.ytAsrConfig.enable,enable);
assert.deepEqual(apply({translationServices:{'magpie-a1':{type:'magpie',extends:'magpie',group:'custom',name:'Magpie 1'}}}).translationServices['magpie-a1'],{type:'magpie',extends:'magpie',group:'custom',name:'Magpie 1',provider:'custom',enableImtServe:false});
assert.equal(config.generalRule.paragraphMinTextCount,21);assert.equal(config.interfaceLanguage,'zh-CN');
assert.equal(apply({translationService:'babelfast',translationServices:{babelfast:{provider:'pro'}}}).translationService,'bing');
assert.deepEqual(apply(structuredClone(config)),config,'policy must be idempotent');
console.log('PASS direct-service migration, key preservation, stale overrides, frozen rules, basic segmentation choice, Magpie services, idempotence');

// Phase 2 retires a saved layout and curates templates without discarding keys.
assert.equal(apply({popupMode:'simple',rawUserConfig:{popupMode:'simple'}}).rawUserConfig.popupMode,'full');
const curated=apply({translationServices:{tencent:{},mimo:{},google:{},'my-legacy':{type:'tencent',APIKEY:'kept'}},rawUserConfig:{translationServices:{tencent:{APIKEY:'saved'}}}});
assert.equal(curated.translationServices.mimo.hidden,true);
assert.equal(curated.translationServices.google.hidden,undefined);
assert.equal(curated.translationServices.tencent.hidden,undefined);
assert.equal(curated.rawUserConfig.translationServices.tencent.APIKEY,'saved');
assert.equal(curated.translationServices['my-legacy'].APIKEY,'kept');
assert.equal(apply({translationService:'tencent',translationServices:{tencent:{APIKEY:'active'}}}).translationServices.tencent.APIKEY,'active');
console.log('PASS unified popup mode, twelve core templates, legacy service and credential compatibility');
const hiddenDefault=apply({translationServices:{tencent:{}}}).translationServices.tencent;
const restoredLegacy=apply({translationServices:{tencent:{...hiddenDefault,APIKEY:'saved'}},rawUserConfig:{translationServices:{tencent:{APIKEY:'saved'}}}});
assert.equal(restoredLegacy.translationServices.tencent.hidden,false);
assert.equal(restoredLegacy.translationServices.tencent.visible,true);
