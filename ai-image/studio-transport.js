(() => {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('mode');
  const mode = ['studio', 'lock', 'legacy'].includes(requested) ? requested : 'studio';
  if (mode !== 'studio') return;

  const nativeFetch = window.fetch.bind(window);
  const SMART_SOURCE = '/functions/v1/ai-image-generate';
  const SMART_TARGET = '/functions/v1/ai-image-studio-generate';
  const BACKGROUND_SOURCE = '/functions/v1/ai-image-background';
  const BACKGROUND_TARGET = '/functions/v1/ai-image-studio-background';
  const MAX_ATTEMPTS = 4;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function transportTarget(url) {
    if (url.includes(SMART_SOURCE)) return url.replace(SMART_SOURCE, SMART_TARGET);
    if (url.includes(BACKGROUND_SOURCE)) return url.replace(BACKGROUND_SOURCE, BACKGROUND_TARGET);
    return '';
  }

  async function bodyText(input, init) {
    if (typeof init?.body === 'string') return init.body;
    if (input instanceof Request) return input.clone().text();
    return '';
  }

  async function fingerprint(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  function newRequestId() {
    if (crypto?.randomUUID) return `studio_${crypto.randomUUID()}`;
    return `studio_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  window.fetch = async function resilientStudioFetch(input, init = {}) {
    const sourceUrl = typeof input === 'string' || input instanceof URL ? String(input) : input?.url || '';
    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const targetUrl = transportTarget(sourceUrl);
    if (!targetUrl) return nativeFetch(input, init);

    // Health checks must go through the same proxy path as generation. The
    // direct legacy Edge endpoints still use Supabase's older JWT gate, while
    // the studio proxies authenticate the browser key inside the function and
    // forward upstream using the project's current publishable key.
    if (method !== 'POST') return nativeFetch(targetUrl, init);

    const rawBody = await bodyText(input, init);
    let payload;
    try {
      payload = JSON.parse(rawBody || '{}');
    } catch {
      return nativeFetch(targetUrl, init);
    }

    const keyHash = await fingerprint(`${targetUrl}\n${rawBody}`);
    const storageKey = `smirel-studio-pending:${keyHash}`;
    let requestId = sessionStorage.getItem(storageKey);
    if (!requestId) {
      requestId = newRequestId();
      sessionStorage.setItem(storageKey, requestId);
    }

    const requestInit = {
      ...init,
      method: 'POST',
      body: JSON.stringify({ ...payload, request_id: requestId }),
    };

    let lastNetworkError = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await nativeFetch(targetUrl, requestInit);
        if (response.status === 202) {
          const data = await response.clone().json().catch(() => ({}));
          const waitMs = Math.max(1200, Math.min(5000, Number(data?.retryAfterMs || 2500)));
          if (attempt < MAX_ATTEMPTS - 1) {
            await sleep(waitMs);
            continue;
          }
        }
        if (response.ok && response.status !== 202) sessionStorage.removeItem(storageKey);
        if (response.status >= 400 && response.status < 500 && response.status !== 409 && response.status !== 429) {
          sessionStorage.removeItem(storageKey);
        }
        return response;
      } catch (error) {
        lastNetworkError = error;
        if (attempt < MAX_ATTEMPTS - 1) {
          await sleep(1800 + attempt * 900);
          continue;
        }
      }
    }

    console.warn('[AI Ecommerce Studio] generation connection interrupted; request remains recoverable', { requestId, lastNetworkError });
    throw new Error('生成连接中断，但后台任务可能仍在完成。请稍后再点一次“重做这一张”，系统会优先恢复同一次生成结果，不会重复生成。');
  };
})();
