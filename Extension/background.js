/**
 * Converts a function with a callback to an async function
 *
 * @param {*} _this
 * @param {string} func
 * @param {...*} args
 */
const async = (_this, func, ...args) => new Promise((resolve, reject) => {
  try {
    args.push(response => {
      if (chrome.runtime.lastError)
        reject(chrome.runtime.lastError.message);
      resolve(response);
    });
    _this[func].call(_this, ...args);
  } catch (e) {
    reject(e);
  }
});

// Inject content scripts into relevant tabs upon install
chrome.runtime.onInstalled.addListener(() => {
  chrome.runtime.getManifest().content_scripts.forEach(content_script => {
    if (!content_script.hasOwnProperty('js')) return;
    
    content_script.matches.forEach(async match => {
      const tabs = await async(chrome.tabs, 'query', {url: match});
      if (!tabs.length) return;
      
      for (const tab of tabs)
        for (const js of content_script.js)
          await async(chrome.tabs, 'executeScript', tab.id, {file: js});
    });
  });
});
