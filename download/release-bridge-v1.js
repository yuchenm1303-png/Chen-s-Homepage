(() => {
  const config = window.DOWNLOAD_PORTAL_CONFIG ?? {};
  const release = config.release ?? {};
  const source = config.releaseSource ?? {};
  const versionRe = /^v\d+\.\d+\.\d+(?:[.-][0-9A-Za-z.-]+)?$/;
  let sourceReady = false;

  const $ = (id) => document.getElementById(id);
  const downloadButton = $("downloadButton");
  const toast = $("toast");

  function showBridgeToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    window.setTimeout(() => toast.classList.remove("show"), 1800);
  }

  if (downloadButton) {
    downloadButton.addEventListener("click", (event) => {
      if (sourceReady) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      showBridgeToast("正在确认最新正式版本…");
    }, true);
  }

  function formatDate(value) {
    const date = new Date(value || "");
    if (Number.isNaN(date.getTime())) return release.publishedAt || "待发布";
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    return `${yyyy}.${mm}.${dd}`;
  }

  function formatBytes(value) {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes <= 0) return release.fileSize || "—";
    const mib = bytes / 1024 / 1024;
    return `${mib >= 100 ? mib.toFixed(0) : mib.toFixed(1)} MB`;
  }

  function releaseNotesFromBody(body) {
    const lines = String(body || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith("#"))
      .filter((line) => !/^Update policy:/i.test(line))
      .filter((line) => !/^Minimum supported version:/i.test(line));
    return lines.length ? lines : release.notes || [];
  }

  function renderRelease() {
    const versionNumber = $("versionNumber");
    const publishedAt = $("publishedAt");
    const fileSizeText = $("fileSizeText");
    const accountStateText = $("accountStateText");
    const downloadButtonHint = $("downloadButtonHint");

    if (versionNumber) versionNumber.textContent = release.version || "—";
    if (publishedAt) publishedAt.textContent = `${release.publishedAt || "待发布"} 发布`;
    if (fileSizeText) fileSizeText.textContent = release.fileSize || "—";

    if (
      downloadButton &&
      !downloadButton.disabled &&
      accountStateText?.textContent === "已授权" &&
      downloadButtonHint
    ) {
      downloadButtonHint.textContent = release.version || "最新版";
    }
  }

  async function refreshFromManualStableRelease() {
    const apiUrl = String(source.latestApiUrl || "").trim();
    const manifestName = String(source.manifestAsset || "update.json");
    const installerPrefix = String(source.installerPrefix || "EcommerceAgent-Setup-");

    if (!apiUrl) return;

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`release_api_${response.status}`);

    const payload = await response.json();
    if (!payload || payload.draft || payload.prerelease || !Array.isArray(payload.assets)) {
      throw new Error("invalid_latest_release");
    }

    const tag = String(payload.tag_name || "").trim();
    if (!versionRe.test(tag)) throw new Error("invalid_release_tag");

    const version = tag.slice(1);
    const expectedInstaller = `${installerPrefix}${version}.exe`;
    const manifestAsset = payload.assets.find((asset) => asset?.name === manifestName);
    const installerAsset = payload.assets.find((asset) => asset?.name === expectedInstaller);

    // Only the manual Publish Update workflow emits both of these stable-release assets.
    // Ordinary CI/Windows Package artifacts never satisfy this contract.
    if (!manifestAsset?.browser_download_url || !installerAsset?.browser_download_url) {
      throw new Error("manual_stable_assets_missing");
    }

    release.version = tag;
    release.publishedAt = formatDate(payload.published_at);
    release.fileSize = formatBytes(installerAsset.size);
    release.downloadUrl = "";
    release.notes = releaseNotesFromBody(payload.body);

    document.documentElement.dataset.releaseSource = "manual-stable";
    renderRelease();
  }

  Promise.resolve()
    .then(refreshFromManualStableRelease)
    .catch((error) => {
      console.warn("manual stable release lookup failed; using packaged fallback metadata", error);
      renderRelease();
    })
    .finally(() => {
      sourceReady = true;
      window.PORTAL_RELEASE_SOURCE_READY = true;
      window.dispatchEvent(new CustomEvent("portal-release-ready", { detail: { ...release } }));
    });
})();
