(async () => {
  const dev = localStorage.getItem('dev') == 'true';
  
  function minifyCss(css) {
    return css
    .replace(/\/\*(?:(?!\*\/)[\s\S])*\*\/|[\r\n\t]+/g, '')
    .replace(/ {2,}/g, ' ')
    .replace(/ ([{:}]) /g, '$1')
    .replace(/([;,]) /g, '$1')
    .replace(/ !/g, '!');
  }
  
  const updateStyle = (id, css) => {
    const existingStyle = document.getElementById(id);
    if (existingStyle)
      if (existingStyle.tagName == 'STYLE') {
        existingStyle.innerHTML = css;
        return;
      } else {
        existingStyle.parentNode.removeChild(existingStyle);
      }
    
    const style = document.createElement('style');
    style.id = id;
    style.innerHTML = css;
    document.documentElement.appendChild(style);
  };
  
  const loadLocalCss = (id, file) => {
    const href = chrome.extension.getURL(chrome.runtime.getURL('css/' + file + '.css') + '?_=' + Date.now());
    
    const existingStyle = document.getElementById(id);
    if (existingStyle)
      if (existingStyle.tagName == 'LINK') {
        existingStyle.href = href;
        return;
      } else {
        existingStyle.parentNode.removeChild(existingStyle);
      }
    
    const link = document.createElement('link');
    link.href = href;
    link.id = id;
    link.type = 'text/css';
    link.rel = 'stylesheet';
    document.documentElement.appendChild(link);
  };
  
  const httpRequest = url => new Promise(resolve => {
    chrome.runtime.sendMessage({
      action: 'ajax-request',
      url: url,
    }, resolve);
  });
  
  let file;
  
  switch (window.origin) {
    case 'https://ifttt.com':
      file = 'ifttt';
      break;
    case 'https://platform.ifttt.com':
      file = 'ifttt_platform';
      break;
  }
  
  if (!file) return;
  
  const id = file + '_style';
  
  if (dev) {
    loadLocalCss(id, file);
  } else {
    const cachedCss = localStorage.getItem(id);
    if (cachedCss)
      updateStyle(id, cachedCss);
    else
      loadLocalCss(id, file);
    
    let css = await httpRequest('https://raw.githubusercontent.com/burkybang/Better-IFTTT-UI/master/Extension/css/' + file + '.css?_=' + Date.now());
    
    if (css) {
      css = minifyCss(css);
      updateStyle(id, css);
      localStorage.setItem(id, css);
    } else {
      loadLocalCss(id, file);
    }
  }
  
})();


if (!window.init) {
  (() => {
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    
    const pageChange = async arg => {
      // Wait until finished navigating
      if (document.documentElement.classList.length) return;
      
      // Events: navigate, ready, load
      const event = arg && arg.constructor.name == 'Array' ? 'navigate' :
        (arg.type == 'DOMContentLoaded' ? 'ready' : arg.type);
      
      switch (location.href) {
        case 'https://ifttt.com/':
          document.title = document.title.replace('My services - ', '');
          break;
        case 'https://ifttt.com/my_applets':
          if (event == 'navigate')
            await delay(0);
          location.href = 'javascript:(()=>{const el=document.querySelector(".web-applet-cards.my-applets.js-dashboard-applet-grid");if(el)el.dispatchEvent(new CustomEvent("force-resize"));})();';
          break;
      }
    };
  
    document.addEventListener('DOMContentLoaded', pageChange, false);
    window.onload = pageChange;
    
    new MutationObserver(pageChange).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
      childList: false,
      characterData: false
    });
    
  })();
  window.init = true;
}