(() => {
  
  let style;
  
  switch (window.origin) {
    case 'https://ifttt.com':
      style = 'ifttt';
      break;
    case 'https://platform.ifttt.com':
      style = 'ifttt_platform';
      break;
  }
  
  if (style) {
    const id = style + '_style';
    const href = chrome.extension.getURL(chrome.runtime.getURL('css/' + style + '.css') + '?_=' + Date.now());
    
    const existingStyle = document.getElementById(id);
    if (existingStyle) {
      existingStyle.href = href;
      return;
    }
    
    const link = document.createElement('link');
    link.href = href;
    link.id = id;
    link.type = 'text/css';
    link.rel = 'stylesheet';
    document.documentElement.appendChild(link);
  }
  
})();