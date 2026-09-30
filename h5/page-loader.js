(() => {
  const pageOrder = ['home', 'talent', 'recruit', 'roster', 'shop', 'duel', 'result', 'profile', 'pointshop'];
  const root = document.getElementById('page-root');
  const forbiddenElements = 'script,iframe,object,embed,base,form,link,meta';
  const safeAssetPath = /^assets\/[a-z0-9._/-]+$/i;
  const safeInlineStyle = /^width:\s*(?:100|[0-9]{1,2})%;?$/i;

  function sanitizeTemplate(page, source) {
    if (typeof source !== 'string') throw new Error(`Missing bundled page template: ${page}`);
    const parsed = new DOMParser().parseFromString(source, 'text/html');
    const main = parsed.body.firstElementChild;
    if (!main || parsed.body.children.length !== 1 || main.tagName !== 'MAIN' || main.id !== page || !main.classList.contains('screen')) {
      throw new Error(`Invalid root element in page template: ${page}`);
    }
    if (main.querySelector(forbiddenElements)) throw new Error(`Forbidden element in page template: ${page}`);

    for (const element of [main, ...main.querySelectorAll('*')]) {
      for (const attribute of [...element.attributes]) {
        const name = attribute.name.toLowerCase();
        const value = attribute.value.trim();
        if (name.startsWith('on') || name === 'srcdoc' || name === 'formaction' || name === 'action') {
          element.removeAttribute(attribute.name);
        } else if (name === 'src' && !safeAssetPath.test(value)) {
          element.removeAttribute(attribute.name);
        } else if (name === 'href' || name === 'xlink:href') {
          element.removeAttribute(attribute.name);
        } else if (name === 'style' && !safeInlineStyle.test(value)) {
          element.removeAttribute(attribute.name);
        }
      }
    }
    return document.importNode(main, true);
  }

  function loadPages() {
    const templates = window.SupFusionPageTemplates;
    const fragment = document.createDocumentFragment();
    for (const page of pageOrder) fragment.appendChild(sanitizeTemplate(page, templates?.[page]));
    root.replaceChildren(fragment);

    const script = document.createElement('script');
    script.src = window.SupFusionUiScript || 'game-ui.js';
    script.onerror = () => showError(new Error('Unable to load game-ui.js'));
    document.body.appendChild(script);
  }

  function showError(error) {
    console.error(error);
    const main = document.createElement('main');
    main.className = 'screen active';
    const message = document.createElement('div');
    message.className = 'panel page-load-error m-5 p-5 text-center';
    message.textContent = '页面加载失败，请刷新后重试。';
    main.appendChild(message);
    root.replaceChildren(main);
  }

  try { loadPages(); } catch (error) { showError(error); }
})();
