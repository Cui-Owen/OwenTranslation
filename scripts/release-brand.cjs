'use strict';
const fs=require('node:fs'),path=require('node:path');

const project='https://github.com/Cui-Owen/OwenTranslation';
// Display names only: storage keys, CSS selectors and message channels stay stable.
const display=text=>text.replace(/沉浸式翻译/g,'欧文翻译').replace(/沉浸式翻譯/g,'歐文翻譯').replace(/Immersive Translate/g,'Owen Translation');
function finish(dir){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);
  if(entry.isDirectory()){finish(file);continue;}
  if(!/\.(?:js|json|html|css)$/.test(entry.name))continue;
  const source=fs.readFileSync(file,'utf8');
  let result=display(source);
  if(entry.name==='locales.json'){
   // Help and support destinations in the packaged language dictionaries.
   result=result.replace(/https?:\/\/(?:[\w-]+\.)*(?:immersivetranslate\.(?:com|cn|net)|imtintl\.com|immersive-translate\.github\.io)[^\s<>"'\\]*/g,project);
   result=result.replace(/support@immersivetranslate\.com/g,project+'/issues');
  }
  if(/^default_config(?:\.content)?\.json$/.test(entry.name)){
   const config=JSON.parse(result);
   const headers=config.translationServices?.openrouter?.headerConfigs;
   if(headers){headers['HTTP-Referer']=project;headers['X-Title']='Owen Translation';}
   result=JSON.stringify(config)+'\n';
  }
  if(source!==result)fs.writeFileSync(file,result);
 }
}
module.exports={display,finish};
