(() => {
  async function loadSharedFooter() {
    const mount = document.querySelector('[data-site-footer]');
    if (!mount) return;

    const currentScript = document.currentScript || document.querySelector('script[src$="/assets/site-footer.js"], script[src$="assets/site-footer.js"]');
    const scriptUrl = currentScript ? new URL(currentScript.getAttribute('src'), window.location.href) : new URL('/assets/site-footer.js', window.location.href);
    const rootUrl = new URL('..', scriptUrl).pathname.replace(/\/$/, '');
    const rootPath = rootUrl || '';
    const footerSrc = mount.getAttribute('data-footer-src') || `${rootPath}/site-footer.html`;

    try {
      const response = await fetch(footerSrc, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`Footer request failed: ${response.status}`);
      const html = (await response.text()).replaceAll('%ROOT%', rootPath);
      mount.outerHTML = html;
    } catch (error) {
      console.warn('Shared footer could not be loaded.', error);
      mount.hidden = true;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSharedFooter);
  } else {
    loadSharedFooter();
  }
})();
