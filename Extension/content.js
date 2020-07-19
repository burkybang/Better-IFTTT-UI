(async () => {
  /**
   * @param {number} ms
   * @return {Promise<void>}
   */
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  
  /**
   * Inject JavaScript into the page's context
   *
   * @param {object} obj
   * @param {function} obj.inject
   * @param {object} [obj.data]
   * @return {void}
   */
  const injectJavaScript = obj => {
    if (!obj.hasOwnProperty('inject')) return;
    
    /** @type {string} */
    const inject = ('' + obj.inject).replace(/\s*\/\/.*$/gm, '');
    /** @type {string} */
    const data = obj.hasOwnProperty('data') ? JSON.stringify(obj.data) : '{}';
    
    /** @type {HTMLScriptElement} */
    const script = document.createElement('script');
    script.appendChild(document.createTextNode('(' + inject + ')(' + data + ');'));
    (document.head || document.body || document.documentElement).appendChild(script);
    script.parentNode.removeChild(script);
  };
  
  /** @type {boolean} */
  const dev = localStorage.getItem('dev') === 'true';
  
  /**
   * Minify CSS
   *
   * @param {string} css
   * @return {string}
   */
  const minifyCss = css => css
    .replace(/\/\*(?:(?!\*\/)[\s\S])*\*\/|[\r\n\t]+/g, '')
    .replace(/ {2,}/g, ' ')
    .replace(/ ([{:}]) /g, '$1')
    .replace(/([;,]) /g, '$1')
    .replace(/ !/g, '!');
  
  /**
   * Apply CSS from string
   *
   * @param {string} id
   * @param {string} css
   * @return {void}
   */
  const updateStyle = (id, css) => {
    /** @type {HTMLElement} */
    const existingStyle = document.getElementById(id);
    if (existingStyle)
      if (existingStyle.tagName === 'STYLE') {
        existingStyle.innerHTML = css;
        return;
      } else {
        existingStyle.parentNode.removeChild(existingStyle);
      }
    
    /** @type {HTMLStyleElement} */
    const style = document.createElement('style');
    style.id = id;
    style.innerHTML = css;
    document.documentElement.appendChild(style);
  };
  
  /**
   * Apply CSS from local file
   *
   * @param {string} id
   * @param {string} file
   * @return {void}
   */
  const loadLocalCss = (id, file) => {
    /** @type {string} */
    const href = chrome.runtime.getURL('css/' + file + '.css') + '?_=' + Date.now();
    
    /** @type {HTMLElement} */
    const existingStyle = document.getElementById(id);
    if (existingStyle)
      if (existingStyle.tagName === 'LINK') {
        existingStyle.href = href;
        return;
      } else {
        existingStyle.parentNode.removeChild(existingStyle);
      }
    
    /** @type {HTMLLinkElement} */
    const link = document.createElement('link');
    link.href = href;
    link.id = id;
    link.type = 'text/css';
    link.rel = 'stylesheet';
    document.documentElement.appendChild(link);
  };
  
  /**
   * Do HTTP request
   *
   * @param {string} url
   * @return {Promise<string>}
   */
  const httpRequest = url => new Promise(resolve => {
    chrome.runtime.sendMessage({
      action: 'ajax-request',
      url: url,
    }, resolve);
  });
  
  /** @type {string} */
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
  
  /** @type {string} */
  const id = file + '_style';
  
  if (dev) {
    loadLocalCss(id, file);
  } else {
    /** @type {string} */
    const cachedCss = localStorage.getItem(id);
    if (cachedCss)
      updateStyle(id, cachedCss);
    else
      loadLocalCss(id, file);
    
    /** @type {string} */
    let css = await httpRequest('https://raw.githubusercontent.com/burkybang/Better-IFTTT-UI/master/Extension/css/' + file + '.css?_=' + Date.now());
    
    if (css) {
      css = minifyCss(css);
      updateStyle(id, css);
      localStorage.setItem(id, css);
    } else {
      loadLocalCss(id, file);
    }
  }
  
  await delay(100);
  
  injectJavaScript({
    inject: () => {
      if (window.hasOwnProperty('App') && window.App.hasOwnProperty('authenticityToken'))
        localStorage.setItem('authenticityToken', window.App.authenticityToken);
    },
  });
  
})();


if (!window.init) {
  (() => {
    /**
     * @param {number} ms
     * @return {Promise<void>}
     */
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    
    /**
     * @param {'navigate'|'ready'|'load'} eventType
     * @return {Promise<void>}
     */
    const pageChange = async eventType => {
      // Wait until finished navigating
      if (document.documentElement.classList.length) return;
      
      /** @type {DOMTokenList} */
      const bodyClass = document.body.classList;
      
      if (window.hasOwnProperty('currentStepObserver'))
        window.currentStepObserver.disconnect();
      
      switch (window.origin) {
        case 'https://ifttt.com':
          
          switch (location.href) {
            case 'https://ifttt.com/':
              if (eventType !== 'load')
                document.title = document.title.replace('My services - ', '');
              
              break;
            
            case 'https://ifttt.com/my_applets':
              if (eventType === 'navigate')
                await delay(0);
              if (eventType !== 'ready')
                location.href = 'javascript:(()=>{const el=document.querySelector(".web-applet-cards.my-applets.js-dashboard-applet-grid");if(el)el.dispatchEvent(new CustomEvent("force-resize"));})();';
              
              break;
            
            default:
              if (!window.hasOwnProperty('getTriggersActionsCache'))
                /** @type {Object<string, Object>} */
                window.getTriggersActionsCache = {};
              
              /**
               * @param {string} serviceModuleName
               * @return {Promise<Object>}
               */
              const getTriggersActions = async serviceModuleName => {
                if (!window.getTriggersActionsCache.hasOwnProperty(serviceModuleName)) {
                  /** @type {string} */
                  const authenticityToken = localStorage.getItem('authenticityToken');
                  if (!authenticityToken) return;
                  
                  /** @type {Response} */
                  const serviceResponse = await fetch('https://ifttt.com/graph/query', {
                    credentials: 'include',
                    headers: {
                      'accept': '*/*',
                      'accept-language': 'en-AU,en-US;q=0.9,en;q=0.8',
                      'content-type': 'application/json',
                      'sec-fetch-mode': 'cors',
                      'sec-fetch-site': 'same-origin',
                      'x-requested-with': 'XMLHttpRequest'
                    },
                    referrerPolicy: 'strict-origin-when-cross-origin',
                    body: JSON.stringify({
                      query: 'query($serviceModuleName: String!) {channel(module_name: $serviceModuleName) {public_triggers {name description trigger_fields {label required}}public_actions {name description action_fields {label required}}}}',
                      variables: {
                        serviceModuleName: serviceModuleName
                      },
                      authenticity_token: authenticityToken
                    }),
                    method: 'POST',
                    mode: 'cors'
                  });
                  window.getTriggersActionsCache[serviceModuleName] = await serviceResponse.json();
                }
                
                return window.getTriggersActionsCache[serviceModuleName];
              };
              
              /**
               * @return {Promise<void>}
               */
              const appendTriggersActions = async () => {
                if (eventType === 'load') return;
                
                /** @type {boolean} */
                const isConnect = location.href.indexOf('https://ifttt.com/create/connect-') === 0;
                
                // Example Query: '\nquery($serviceModuleName: String!) {\nchannel(module_name: $serviceModuleName) {\nid\nbrand_color\nvariant_image_url\nmonochrome_image_url\nmodule_name\nname\ntext_only_description\npreview_mode\nconnected\ncan_be_autoactivated\npublic_triggers {\nid\nname\ndescription\nmodule_name\nweight\ntrigger_fields {\nname\nlabel\nrequired\nshareable\nfield_ui_type\nnormalized_field_type\nhelper_text\n}\n}\npublic_actions {\nid\nname\ndescription\nmodule_name\nweight\naction_fields {\nname\nlabel\nrequired\nshareable\nfield_ui_type\nnormalized_field_type\nhelper_text\n}\nincompatible_triggers\n}\n}\n}\n'
                
                /** @type {string} */
                const serviceModuleName = new URL(location.href).pathname.replace(/^\/(create\/connect-)?/, '');
                
                if (document.querySelector('.triggers-actions-container[data-service-module-name="' + serviceModuleName + '"]')) return;
                /** @type {Element} */
                const oldElem = document.querySelector('.triggers-actions-container');
                if (oldElem)
                  oldElem.parentNode.removeChild(oldElem);
                
                if (!isConnect)
                  delay(100).then(() => {
                    /** @type {HTMLDivElement} */
                    const elem = document.querySelector('div[data-react-class="App.Comps.MyServiceView"]');
                    if (!elem) return;
                    elem.insertAdjacentHTML('afterbegin', '<h2 style="text-align:center;">My Applets</h2>');
                  });
                
                let html = '';
                /** @type {Object} */
                const serviceJSON = await getTriggersActions(serviceModuleName);
                if (
                  !serviceJSON ||
                  !serviceJSON.hasOwnProperty('data') ||
                  !serviceJSON.data.hasOwnProperty('channel') ||
                  !serviceJSON.data.channel ||
                  !serviceJSON.data.channel.hasOwnProperty('public_triggers') ||
                  !serviceJSON.data.channel.hasOwnProperty('public_actions')
                ) return;
                html += '<h2>Triggers</h2><br/>';
                if (serviceJSON.data.channel.public_triggers.length) {
                  html += serviceJSON.data.channel.public_triggers.map(trigger =>
                    '<div class="triggers-actions">' +
                    '<div class="title">' + trigger.name + '</div>' +
                    '<div class="description">' + trigger.description + '</div>' +
                    (trigger.hasOwnProperty('trigger_fields') && trigger.trigger_fields.length ?
                      '<div class="fields"><i>Fields:</i> ' + trigger.trigger_fields.map(field => field.label).join(', ') + '</div>'
                      : '') +
                    '</div>'
                  ).join('');
                } else {
                  html += '<div class="triggers-actions"><span class="title">None</span></div>';
                }
                html += '<h2>Actions</h2><br/>';
                if (serviceJSON.data.channel.public_actions.length) {
                  html += serviceJSON.data.channel.public_actions.map(action =>
                    '<div class="triggers-actions">' +
                    '<div class="title">' + action.name + '</div>' +
                    '<div class="description">' + action.description + '</div>' +
                    (action.hasOwnProperty('action_fields') && action.action_fields.length ?
                      '<div class="fields"><i>Fields:</i> ' + action.action_fields.map(field => field.label).join(', ') + '</div>'
                      : '') +
                    '</div>'
                  ).join('');
                } else {
                  html += '<div class="triggers-actions"><span class="title">None</span></div>';
                }
                if (html.length) {
                  /** @type {Element} */
                  const elem = document.querySelector('body > .container.web' + (isConnect ? ' > #composer > .diy-composer' : ''));
                  if (elem) {
                    /** @type {'beforeend'|'afterbegin'} */
                    const where = isConnect ? 'beforeend' : 'afterbegin';
                    elem.insertAdjacentHTML(
                      where,
                      '<section class="triggers-actions-container" data-service-module-name="' + serviceModuleName + '"><div class="web-applet-cards">' + html + '</div></section>'
                    );
                  }
                }
              };
              
              if (location.href.indexOf('https://ifttt.com/create') === 0
                && bodyClass.contains('diy-creation-body')
                && bodyClass.contains('show-action')
              ) {
                (() => {
                  if (eventType === 'load') return;
                  
                  /** @type {HTMLDivElement} */
                  const currentStepE = document.querySelector('.current-step > div');
                  if (!currentStepE) {
                    document.body.style.setProperty('--header-background-color', '#000000');
                    return;
                  }
                  
                  /** @type {Element} */
                  const triggersActionsContainer = document.querySelector('.triggers-actions-container');
                  if (triggersActionsContainer)
                    triggersActionsContainer.parentNode.removeChild(triggersActionsContainer);
                  
                  /**
                   * @return {void}
                   */
                  const stepChange = () => {
                    window.scrollTo(0, 0);
                    delay(100).then(() => {
                      if (location.href.indexOf('https://ifttt.com/create/connect-') === 0 &&
                        bodyClass.contains('diy-creation-body') &&
                        bodyClass.contains('show-action')
                      ) appendTriggersActions().then();
                    });
                  };
                  
                  stepChange();
                  window.currentStepObserver = new MutationObserver(stepChange);
                  window.currentStepObserver.observe(currentStepE, {
                    childList: true,
                  });
                })();
              } else if (
                bodyClass.contains('services-body') &&
                bodyClass.contains('show-action') &&
                bodyClass.contains('service-landing-page')
              ) {
                appendTriggersActions().then();
              } else {
                /** @type {Element} */
                const triggersActionsContainer = document.querySelector('.triggers-actions-container');
                if (triggersActionsContainer)
                  triggersActionsContainer.parentNode.removeChild(triggersActionsContainer);
              }
          }
          
          break;
        
        case 'https://platform.ifttt.com':
          
          if (location.href.indexOf('https://platform.ifttt.com/docs') === 0) {
            if (eventType !== 'load') {
              // Scroll down a little after clicking on sidebar links to account for floating header
              /** @type {NodeListOf<HTMLAnchorElement>} */
              const links = document.querySelectorAll('.sidebar-nav a');
              for (const /*HTMLAnchorElement*/link of links)
                link.addEventListener('click', async () => {
                  await delay(0);
                  window.scrollBy(0, -80);
                });
            }
          }
          
          break;
      }
    };
    
    document.addEventListener('DOMContentLoaded', () => pageChange('ready'), false);
    window.onload = () => pageChange('load');
    
    new MutationObserver(() => pageChange('navigate')).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    
  })();
  window.init = true;
}