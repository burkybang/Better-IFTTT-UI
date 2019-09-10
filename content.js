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
  const existingStyle = document.getElementById(id);
  if (existingStyle)
    existingStyle.parentNode.removeChild(existingStyle);
  
  const link = document.createElement('link');
  link.href = chrome.extension.getURL(chrome.runtime.getURL('css/' + style + '.css'));
  link.id = id;
  link.type = 'text/css';
  link.rel = 'stylesheet';
  document.documentElement.appendChild(link);
}