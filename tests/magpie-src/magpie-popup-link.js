(() => {
  const a=document.createElement('a');a.textContent='Magpie 字幕分句设置 ↗';a.href=chrome.runtime.getURL('magpie-settings.html');a.target='_blank';
  a.style.cssText='display:block;margin:8px 14px;padding:8px 12px;border:1px solid #9aa7bb;border-radius:6px;text-align:center;font:13px system-ui;color:inherit;text-decoration:none';
  document.body.append(a);
})();
