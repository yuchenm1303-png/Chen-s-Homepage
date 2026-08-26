(() => {
  // Performance guard for the scan-review polling loop.
  // post-preview.js still owns rendering; this layer only lets its 5s poll
  // re-render when the underlying scan request actually changes.
  const nativeSetInterval = window.setInterval.bind(window);
  const STATUS_URL = "https://nfzkphjbelyltrzgkdwt.supabase.co/functions/v1/lead-radar-scan/api/v1/status";
  let armed = true;

  function scanFingerprint(data) {
    const latest = data?.latest_request || data?.active_request || null;
    const result = latest?.result || data?.last_scan || {};
    const posts = Array.isArray(result?.posts) ? result.posts : [];
    return JSON.stringify({
      id: latest?.id || null,
      status: latest?.status || null,
      started_at: latest?.started_at || null,
      finished_at: latest?.finished_at || null,
      error: latest?.error || null,
      scanned: Number(result?.scanned || 0),
      fresh: Number(result?.fresh || 0),
      stored: Number(result?.stored || 0),
      filtered: Number(result?.filtered || 0),
      duplicates: Number(result?.duplicates || 0),
      posts: posts.map((post) => [post?.id || "", post?.decision || "", post?.published_at || ""]),
    });
  }

  window.setInterval = function stableInterval(callback, delay, ...args) {
    if (armed && delay === 5000 && typeof callback === "function" && callback.name === "load") {
      armed = false;
      window.setInterval = nativeSetInterval;
      let initialized = false;
      let lastFingerprint = "";
      let checking = false;

      const checkForChange = async () => {
        if (checking || document.visibilityState === "hidden") return;
        checking = true;
        try {
          const response = await fetch(STATUS_URL, { cache: "no-store" });
          if (!response.ok) return;
          const data = await response.json();
          const nextFingerprint = scanFingerprint(data);
          if (!initialized) {
            lastFingerprint = nextFingerprint;
            initialized = true;
            return;
          }
          if (nextFingerprint === lastFingerprint) return;
          lastFingerprint = nextFingerprint;
          await callback(...args);
        } catch {
          // The original visibilitychange/manual refresh paths remain available.
        } finally {
          checking = false;
        }
      };

      return nativeSetInterval(checkForChange, delay);
    }
    return nativeSetInterval(callback, delay, ...args);
  };
})();
