/* Applied after all remote/version/user configuration merges. */
function owenEnforceConfig(c, userOnly = false) {
  if (!c || typeof c !== 'object') return c;
  const disabled = ['activeCampaignTags','storeGuide','messageCenter','discountActivity',
    'enableSelfServiceReport','enableTranslateLeaveReport','enablePerformanceReport',
    'batchReportConfig','enableNewUserActivity','isEnableNotification','enableFloatShare',
    'popupMoreMenus','adBanner','sidePanel','pcFloatBall','monkeyH5FloatBall',
    'serviceRecommendation','mappedTranslationServices','loginAiQuotaGift'];
  for (const key of Object.keys(c)) {
    if (disabled.some(base => key.startsWith(base+'.'))) delete c[key];
  }
  Object.assign(c, {
    popupMode:"full",
    disableReport:true, enableLangDetectReport:false,
    enableSelfServiceReport:false, enableTranslateLeaveReport:false,
    enablePerformanceReport:false, enableNewUserActivity:false,
    isEnableNotification:false, enableFloatShare:false,
    enableShowFloatingBallGuide:false, enableSelectionTranslationGuideExperiment:false,
    activeCampaignTags:{enabled:false}, storeGuide:{enable:false,enabled:false},
    messageCenter:{enable:false,l3:{enable:false}}, discountActivity:{enable:false},
    batchReportConfig:{enabled:false}, popupMoreMenus:[], supportedMangaSites:[],
    donateUrl:'', uninstallUrl:'', feedbackUrl:'',
    disableRuleUpdate:true, enableRemoteConfig:false,
    pcFloatBall:{enable:false,enableSidePanel:false,enablePinSidePanel:false},
    monkeyH5FloatBall:{enable:false,enableSidePanel:false,enablePinSidePanel:false},
    loginAiQuotaGift:{enabled:false}, serviceRecommendation:{}, mappedTranslationServices:{},
    autoSync:false, proSyncAPIKey:false, termsBaseUrl:'',
    enableServerLanguageDetect:false, serverDetect:false,
    enableAsr:false, enableAsrTrial:false
  });
  // This allowlist describes direct adapters, including the base templates used by
  // user-created services. Unknown user IDs remain valid when their adapter is direct.
  const direct = new Set(['ai','bing','google','deepl','transmart','yandex','baidu',
    'caiyun','youdao','youdao-ziyue','qwen-mt','aliyun','tencent','volc','volcAlpha',
    'tenAlpha','custom','deeplx','papago','azure','openl','niu','custom-ai',
    'openai','gemini','claude','openai-custom','claude-custom','qianfan','qianfan2',
    'deepseek','aliyun-bailian','qwen','kimi','doubao','hunyuan','tokenhub',
    'siliconcloud','lingyiwanwu','grok','mimo','plamo','ollama','groq',
    'azure-openai','openrouter','zhipu','bing-free','google-free',
    'transmart-free','yandex-free','transmart-custom','yandex-custom','mock','magpie','magpie-custom']);
  const coreTemplates = new Set(['ai','bing','google','deeplx','magpie','openai',
    'claude','gemini','deepseek','openrouter','ollama','custom-ai','deepl']);
  const selected = ['translationService','inputTranslationService','subtitleTranslateService','mouseHoverTranslationService'].map(key => c[key]);
  const vendor = /(?:immersivetranslate\.(?:com|cn)|imtintl\.com)/i;
  const retired = id => typeof id === 'string' &&
    (/^(?:(?:openai|claude|gemini|deepseek|hunyuan|qwen-mt|qwen|babelfast|grok|plamo|deepl|zhipu|zhipu-air|kimi)-(?:pro|max)|pro-translate-trial|trial-pro|free-model(?:-stream)?|babel-lite(?:-free)?|hymt-free|stepfun-free|siliconcloud-free|zhipu-free|chatgpt|you)$/.test(id));
  const removedServices = new Set();
  if (c.translationServices && typeof c.translationServices === 'object') {
    const services = {};
    for (const [id,value] of Object.entries(c.translationServices)) {
      if (!value || typeof value !== 'object' || id.includes('.add') || retired(id)) continue;
      if (!direct.has(id) && (retired(value.extends) || retired(value.type) ||
          ['pro','max'].includes(value.group) || value.provider === 'pro' ||
          vendor.test(value.apiUrl || ''))) {removedServices.add(id);continue;}
      services[id] = {...value};
      for (const key of Object.keys(services[id])) {
        if (key.includes('.add') || /^(?:immersive|pro[A-Z]|sponsor|freeModels|enableImtServe|migrateToService)/.test(key)) delete services[id][key];
      }
      services[id].provider = 'custom';
      if (vendor.test(services[id].apiUrl || '')) delete services[id].apiUrl;
      if (Array.isArray(services[id].supportFeatures)) services[id].supportFeatures = services[id].supportFeatures.filter(x => x !== 'aiWriting');
      if (['pro','max'].includes(services[id].group)) services[id].group = 'custom';
      services[id].enableImtServe = false;
      // Keep adapter metadata for imported configurations, but remove unused
      // legacy templates and duplicate aliases from every service picker.
      if (!userOnly && direct.has(id) && !coreTemplates.has(id) &&
          !c.rawUserConfig?.translationServices?.[id] &&
          !c.userTranslationServices?.includes?.(id) && !selected.includes(id) &&
          (!value.APIKEY || id === 'magpie-custom')) {
        services[id].hidden = true;
        services[id].visible = false;
        services[id].owenCatalogHidden = true;
      } else if (!userOnly && value.owenCatalogHidden) {
        delete services[id].owenCatalogHidden;
        services[id].hidden = c.rawUserConfig?.translationServices?.[id]?.hidden ?? false;
        services[id].visible = c.rawUserConfig?.translationServices?.[id]?.visible ?? true;
      }

    }
    c.translationServices = services;
  }
  for (const key of ['translationService','inputTranslationService','subtitleTranslateService','mouseHoverTranslationService']) {
    if (retired(c[key]) || removedServices.has(c[key])) c[key] = key === 'translationService' ? 'bing' : 'inherit';
  }
  if (Array.isArray(c.userTranslationServices)) c.userTranslationServices = c.userTranslationServices.filter(x => !retired(typeof x === 'string' ? x : x?.id));
  if (Array.isArray(c.defaultTranslationServicesOrder)) {
    const previous = c.defaultTranslationServicesOrder.filter(x => !retired(x));
    c.defaultTranslationServicesOrder = userOnly ? previous : [...new Set([
      ...previous.map(x => x === 'bing-free' ? 'bing' : x === 'google-free' ? 'google' : x)
        .filter(x => coreTemplates.has(x) || c.translationServices?.[x]?.owenCatalogHidden !== true),
      ...[...coreTemplates].filter(x => x !== 'ai')
    ])];
  }
  if (!c.interfaceLanguage || !['en','zh-CN','zh-TW','zh-HK'].includes(c.interfaceLanguage)) c.interfaceLanguage = 'zh-CN';
  if (!c.targetLanguage) c.targetLanguage = 'zh-CN';
  delete c.adBanner;
  c.sidePanel = {navItems:{text:{platform:''}},rewardCenter:{disabledAt:'2000-01-01 00:00:00'}};
  c.sensitiveConfig = {telemetry:false,sensitiveMode:'close'};
  if (c.shortcuts) {
    delete c.shortcuts.openAiWritingModal;
    delete c.shortcuts.shareToDraft;
  }
  const seen = new Set();
  function rules(value) {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    for (const key of Object.keys(value)) {
      if (['translationService','inputTranslationService','subtitleTranslateService','mouseHoverTranslationService'].includes(key) && (retired(value[key]) || removedServices.has(value[key]))) value[key] = key === 'translationService' ? 'bing' : 'inherit';
      else if (key.startsWith('sensitiveConfig.')) delete value[key];
      else if (key === 'sensitiveConfig') value[key] = {telemetry:false,sensitiveMode:'close'};
      else if (/^(aiWriting|imageRule)\./.test(key)) delete value[key];
      else if (key === 'aiWriting') value[key] = {enable:false,disabledAt:'2000-01-01'};
      else if (key === 'imageRule') value[key] = {enable:false,enableTools:false,enableMouseHover:false,enableMangaFloatBall:false,enableImageTranslation:'none'};
      else if (key === 'screenshotArea') value[key] = {enable:false};
      else if (key === 'ytAsrConfig') value[key] = {...value[key],aiEnable:false}; // official server ASR only; the local basic optimization stays a user choice
      else if (/^(?:pcFloatBall|monkeyH5FloatBall)(?:\.|$)/.test(key)) value[key] = {enable:false,enableSidePanel:false,enablePinSidePanel:false};
      else if (key !== 'rawUserConfig') rules(value[key]);
    }
  }
  rules(c);
  // Do not mutate the caller's stored preference object.
  if (c.rawUserConfig) {
    c.rawUserConfig = owenEnforceConfig({...c.rawUserConfig}, true);
  }
  return c;
}
module.exports = {owenEnforceConfig};
