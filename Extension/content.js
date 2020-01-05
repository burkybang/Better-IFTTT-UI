(async () => {
  /**
   * @param {number} ms
   */
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  
  /**
   * Inject JavaScript into the page's context
   *
   * @param {object} obj
   * @param {function} obj.inject
   * @param {object} [obj.data]
   */
  const injectJavaScript = obj => {
    if (!obj.hasOwnProperty('inject')) return;
    
    const inject = ('' + obj.inject).replace(/\s*\/\/.*$/gm, '');
    const data = obj.hasOwnProperty('data') ? JSON.stringify(obj.data) : '{}';
    
    const script = document.createElement('script');
    script.appendChild(document.createTextNode('(' + inject + ')(' + data + ');'));
    (document.head || document.body || document.documentElement).appendChild(script);
    script.parentNode.removeChild(script);
  };
  
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
    const href = chrome.runtime.getURL('css/' + file + '.css') + '?_=' + Date.now();
    
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
     */
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    
    const pageChange = async arg => {
      // Wait until finished navigating
      if (document.documentElement.classList.length) return;
      
      const bodyClass = document.body.classList;
      
      // Events: navigate, ready, load
      const event = arg && arg.constructor.name == 'Array' ? 'navigate' :
        (arg.type == 'DOMContentLoaded' ? 'ready' : arg.type);
      
      if (window.hasOwnProperty('currentStepObserver'))
        window.currentStepObserver.disconnect();
      
      switch (window.origin) {
        case 'https://ifttt.com':
          
          switch (location.href) {
            case 'https://ifttt.com/':
              if (event != 'load')
                document.title = document.title.replace('My services - ', '');
              break;
            case 'https://ifttt.com/my_applets':
              if (event == 'navigate')
                await delay(0);
              if (event != 'ready')
                location.href = 'javascript:(()=>{const el=document.querySelector(".web-applet-cards.my-applets.js-dashboard-applet-grid");if(el)el.dispatchEvent(new CustomEvent("force-resize"));})();';
              break;
            default:
              if (!window.hasOwnProperty('getTriggersActionsCache'))
                window.getTriggersActionsCache = {};
              
              const getTriggersActions = async serviceModuleName => {
                if (!window.getTriggersActionsCache.hasOwnProperty(serviceModuleName)) {
                  const authenticityToken = localStorage.getItem('authenticityToken');
                  if (!authenticityToken) return;
                  const serviceResponse = await fetch('https://ifttt.com/graph/query', {
                    'credentials': 'include',
                    'headers': {
                      'accept': '*/*',
                      'accept-language': 'en-AU,en-US;q=0.9,en;q=0.8',
                      'content-type': 'application/json',
                      'sec-fetch-mode': 'cors',
                      'sec-fetch-site': 'same-origin',
                      'x-requested-with': 'XMLHttpRequest'
                    },
                    'referrerPolicy': 'strict-origin-when-cross-origin',
                    'body': JSON.stringify({
                      'query': 'query($serviceModuleName: String!) {channel(module_name: $serviceModuleName) {public_triggers {name description trigger_fields {label required}}public_actions {name description action_fields {label required}}}}',
                      'variables': {
                        'serviceModuleName': serviceModuleName
                      },
                      'authenticity_token': authenticityToken
                    }),
                    'method': 'POST',
                    'mode': 'cors'
                  });
                  window.getTriggersActionsCache[serviceModuleName] = await serviceResponse.json();
                }
                
                return window.getTriggersActionsCache[serviceModuleName];
              };
              
              const appendTriggersActions = async () => {
                if (event == 'load') return;
                
                const isConnect = location.href.indexOf('https://ifttt.com/create/connect-') === 0;
                
                // Example Query: '\nquery($serviceModuleName: String!) {\nchannel(module_name: $serviceModuleName) {\nid\nbrand_color\nvariant_image_url\nmonochrome_image_url\nmodule_name\nname\ntext_only_description\npreview_mode\nconnected\ncan_be_autoactivated\npublic_triggers {\nid\nname\ndescription\nmodule_name\nweight\ntrigger_fields {\nname\nlabel\nrequired\nshareable\nfield_ui_type\nnormalized_field_type\nhelper_text\n}\n}\npublic_actions {\nid\nname\ndescription\nmodule_name\nweight\naction_fields {\nname\nlabel\nrequired\nshareable\nfield_ui_type\nnormalized_field_type\nhelper_text\n}\nincompatible_triggers\n}\n}\n}\n'
                
                const serviceModuleName = new URL(location.href).pathname.replace(/^\/(create\/connect-)?/, '');
                
                if (document.querySelector('.triggers-actions-container[data-service-module-name="' + serviceModuleName + '"]')) return;
                const oldElem = document.querySelector('.triggers-actions-container');
                if (oldElem)
                  oldElem.parentNode.removeChild(oldElem);
                
                if (!isConnect)
                  setTimeout(() => {
                    const elem = document.querySelector('div[data-react-class="App.Comps.MyServiceView"]');
                    if (!elem) return;
                    elem.insertAdjacentHTML('afterbegin', '<h2 style="text-align:center;">My Applets</h2>');
                  }, 100);
                
                let html = '';
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
                  const elem = document.querySelector('body > .container.web' + (isConnect ? ' > #composer > .diy-composer' : ''));
                  if (elem)
                    elem.insertAdjacentHTML(
                      isConnect ? 'beforeend' : 'afterbegin',
                      '<section class="triggers-actions-container" data-service-module-name="' + serviceModuleName + '"><div class="web-applet-cards">' + html + '</div></section>'
                    );
                }
              };
              
              if (location.href.indexOf('https://ifttt.com/create') === 0
                && bodyClass.contains('diy-creation-body')
                && bodyClass.contains('show-action')
              ) {
                (() => {
                  if (event == 'load') return;
                  
                  const currentStepE = document.querySelector('.current-step > div');
                  if (!currentStepE) {
                    document.body.style.setProperty('--header-background-color', '#000000');
                    return;
                  }
                  
                  const triggersActionsContainer = document.querySelector('.triggers-actions-container');
                  if (triggersActionsContainer)
                    triggersActionsContainer.parentNode.removeChild(triggersActionsContainer);
                  
                  const stepChange = () => {
                    const headerLogoE = document.querySelector('.header > .logo');
                    document.body.style.setProperty(
                      '--header-background-color',
                      headerLogoE ? headerLogoE.style.backgroundColor : '#000000'
                    );
                    window.scrollTo(0, 0);
                    setTimeout(() => {
                      if (location.href.indexOf('https://ifttt.com/create/connect-') === 0 &&
                        bodyClass.contains('diy-creation-body') &&
                        bodyClass.contains('show-action')
                      ) appendTriggersActions().then();
                    }, 100);
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
                const triggersActionsContainer = document.querySelector('.triggers-actions-container');
                if (triggersActionsContainer)
                  triggersActionsContainer.parentNode.removeChild(triggersActionsContainer);
              }
          }
          
          break;
        case 'https://platform.ifttt.com':
          
          if (location.href.indexOf('https://platform.ifttt.com/docs') === 0) {
            if (event != 'load') {
              // Scroll down a little after clicking on sidebar links to account for floating header
              const links = document.querySelectorAll('.sidebar-nav a');
              for (const link of links)
                link.addEventListener('click', async () => {
                  await delay(0);
                  window.scrollBy(0, -80);
                });
            }
          }
          
          break;
      }
    };
    
    document.addEventListener('DOMContentLoaded', pageChange, false);
    window.onload = pageChange;
    
    new MutationObserver(pageChange).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    
  })();
  window.init = true;
}