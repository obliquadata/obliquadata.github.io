(function () {
  const currentScript = document.currentScript;
  const base = currentScript?.dataset?.base || "./";

  async function inject(selector, partialPath) {
    const target = document.querySelector(selector);
    if (!target) return;

    try {
      const response = await fetch(`${base}${partialPath}`, { cache: "no-cache" });
      if (!response.ok) throw new Error(`Could not load ${partialPath}`);
      const html = (await response.text()).replaceAll("{BASE}", base);
      target.outerHTML = html;
    } catch (error) {
      console.error(error);
      target.hidden = true;
    }
  }

  inject("[data-site-header]", "partials/site-header.html");
  inject("[data-site-footer]", "partials/site-footer.html");
})();
