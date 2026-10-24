#!/usr/bin/env python3
"""Reproducible, guarded patch for the user's installed 1.34.3 bundle."""
import argparse, hashlib, json, shutil
from pathlib import Path
HERE=Path(__file__).resolve().parent
parser=argparse.ArgumentParser()
parser.add_argument('--source',required=True,type=Path)
parser.add_argument('--output',required=True,type=Path)
a=parser.parse_args()
source=a.source.resolve();out=a.output.resolve()
if source==out or source in out.parents:raise SystemExit('Output must be outside the installed extension.')
manifest=json.loads((source/'manifest.json').read_text())
if manifest['version']!='1.34.3':raise SystemExit('This patch targets version 1.34.3 only.')
raw=(source/'content_main.js').read_bytes()
if hashlib.sha256(raw).hexdigest()!='31c56e0a3fc223a4303c3117ac444866f56b90b50c073cc4309e784231027f7a':raise SystemExit('Source content_main.js hash mismatch.')
s=raw.decode()
def replace_once(text,old,new):
    if text.count(old)!=1:raise SystemExit('Patch anchor not unique: '+old[:80])
    return text.replace(old,new,1)
start='async loadSubtitle({input:t,responseText:n,skipYoutubeTranslatedSubtitle:r=!1,expectedVideoId:i}){try{'
s=replace_once(s,start,'async loadSubtitle({input:t,responseText:n,skipYoutubeTranslatedSubtitle:r=!1,expectedVideoId:i}){let __ml=await globalThis.ImtMagpieLocal.begin(this);try{if(__ml.stale)return null;')
gate='let l=this.ctx.rule.ytAsrConfig,u=this.config.preTranslation&&l?.enable,c=!!l?.aiSupportLanguages?.find(h=>h===a),g=this.config.preTranslation&&l?.aiEnable&&this.ctx.isPro&&c;'
new='''let l=this.ctx.rule.ytAsrConfig,u=this.config.preTranslation&&l?.enable,c=!!l?.aiSupportLanguages?.find(h=>h===a),g=this.config.preTranslation&&!__ml.enabled&&l?.aiEnable&&this.ctx.isPro&&c;
if(__ml.enabled&&this.config.preTranslation&&lCe(t)){
 let __events=await this.requestOriginalEvents(t,n),__units;
 try{__units=globalThis.ImtMagpieCore.units(__events)}catch{}
 if(__units?.length){
  globalThis.ImtMagpieLocal.start(this,__events,a,i,__ml,{
   prepare:items=>cCe({items,config:this.config.youtubeSubtitleReadingSpeed,sourceLanguage:a}),
   cache:items=>this.sourceSubtitleMap.set(globalThis.location.href,items)
  }).catch(()=>{});
  return;
 }
}
'''
s=replace_once(s,gate,new)
event='i.current=QSe(i.current,k.subtitleItems),f&&(v(),b.current?.()),a({})'
event_patch='i.current=k.magpie?globalThis.ImtMagpieCore.reconcile(i.current,k.subtitleItems):QSe(i.current,k.subtitleItems),k.magpie&&(k.subtitleItems=i.current,x()),f&&(v(),b.current?.()),a({})'
s=replace_once(s,event,event_patch)
if out.exists():raise SystemExit('Output already exists; select a new directory.')
shutil.copytree(source,out,ignore=shutil.ignore_patterns('_metadata','.DS_Store'))
for name in ['key','update_url']:manifest.pop(name,None)
manifest['name']='沉浸式翻译 · Magpie 字幕分句'
manifest['description']='本机 Magpie 提供 YouTube 自动字幕 AI 分句；独立安装版本。'
manifest['version_name']='1.34.3 + Magpie 1.0.0'
manifest['options_page']='magpie-settings.html'
(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
for p in HERE.glob('magpie-*'):
    if p.is_file():shutil.copy2(p,out/p.name)
(out/'content_main.js').write_text((HERE/'magpie-core.js').read_text()+'\n'+(HERE/'magpie-content.js').read_text()+'\n'+s)
bg=(source/'background.js').read_text(encoding='utf-8-sig')
(out/'background.js').write_text('importScripts("magpie-core.js", "magpie-background.js");\n'+bg)
popup=(out/'popup.html').read_text()
popup=popup.replace('</body>','<script src="magpie-popup-link.js"></script></body>')
(out/'popup.html').write_text(popup)
identity={'baseVersion':'1.34.3','adapterVersion':'1.0.0','sourceContentSHA256':hashlib.sha256(raw).hexdigest(),'patchedContentSHA256':hashlib.sha256((out/'content_main.js').read_bytes()).hexdigest(),'patches':['independent local gate','local segmentation and timing reconstruction','MV3 cancellable local transport','settings page and popup entry','preserve pending translation objects and synchronize export'],'newFiles':sorted(p.name for p in HERE.glob('magpie-*') if p.is_file())}
(out/'MAGPIE-BUILD.json').write_text(json.dumps(identity,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(identity,ensure_ascii=False,indent=2))
