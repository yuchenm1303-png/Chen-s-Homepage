(() => {
  'use strict';

  const script = document.currentScript;
  const scriptUrl = script?.src ? new URL(script.src, document.baseURI) : new URL(document.baseURI);
  const version = scriptUrl.searchParams.get('v') || '';
  const directoryUrl = new URL('./', scriptUrl);
  const nativeFetch = window.fetch.bind(window);

  const sourceFiles = [
    'astra-deep-nebula-mid-variants-loader.js',
    'astra-deep-nebula-loader.js',
    'astra-milkyway-layered.js',
  ];

  const targetByPath = new Map();
  const requestedPaths = new Set();

  function versionedUrl(name) {
    const url = new URL(name, directoryUrl);
    if (version) url.searchParams.set('v', version);
    return url;
  }

  function preloadSource(name) {
    const url = versionedUrl(name);
    const promise = nativeFetch(url, {
      cache: 'force-cache',
      credentials: 'same-origin',
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Galaxy source preload failed: ${response.status} ${url.pathname}`);
      }
      return {
        text: await response.text(),
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type') || 'text/javascript; charset=utf-8',
      };
    }).catch((error) => {
      console.warn('[homepage-galaxy-preload] source preload failed; falling back to normal fetch', error);
      return null;
    });
    targetByPath.set(url.pathname, promise);
  }

  for (const name of sourceFiles) preloadSource(name);

  function restoreFetchWhenComplete() {
    if (requestedPaths.size !== targetByPath.size) return;
    queueMicrotask(() => {
      if (window.fetch === interceptedFetch) window.fetch = nativeFetch;
    });
  }

  function interceptedFetch(input, init) {
    let url;
    try {
      const value = input instanceof Request ? input.url : input;
      url = new URL(value, document.baseURI);
    } catch (_) {
      return nativeFetch(input, init);
    }

    const prefetched = targetByPath.get(url.pathname);
    if (!prefetched || url.origin !== location.origin) {
      return nativeFetch(input, init);
    }

    requestedPaths.add(url.pathname);
    return prefetched.then((entry) => {
      if (!entry) return nativeFetch(input, init);
      restoreFetchWhenComplete();
      return new Response(entry.text, {
        status: entry.status,
        statusText: entry.statusText,
        headers: { 'content-type': entry.contentType },
      });
    });
  }

  window.fetch = interceptedFetch;
})();
