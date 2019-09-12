(() => {
  const dev = localStorage.getItem('dev') == 'true';
  
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
    
    chrome.runtime.sendMessage({
      action: 'ajax-request',
      url: 'https://raw.githubusercontent.com/burkybang/Better-IFTTT-UI/master/Extension/css/' + file + '.css?_=' + Date.now()
    }, css => {
      if (css) {
        updateStyle(id, css);
        localStorage.setItem(id, css);
        return;
      }
      
      loadLocalCss(id, file);
    });
  }
  
})();


if (!window.init) {
  (() => {
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    
    const pageChange = async arg => {
      if (document.documentElement.classList.length) return;
      
      if (arg && arg.constructor.name == 'Array')
        await delay(0);
      
      if (location.href == 'https://ifttt.com/my_applets')
        location.href = 'javascript:(()=>{const el=document.querySelector(".web-applet-cards.my-applets.js-dashboard-applet-grid");if(el)el.dispatchEvent(new CustomEvent("force-resize"));})();';
      
    };
    
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