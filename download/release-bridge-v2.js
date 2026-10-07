(() => {
  const config = window.DOWNLOAD_PORTAL_CONFIG ?? {};
  const release = config.release ?? {};
  const source = config.releaseSource ?? {};
  const versionRe = /^v\d+\.\d+\.\d+(?:[.-][0-9A-Za-z.-]+)?$/;
  let sourceReady = false;
  let metadataReady = false;

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
    if (Number.isNaN(date.getTime())) return "";
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    return `${yyyy}.${mm}.${dd}`;
  }

  function normalizeNoteList(value) {
    if (Array.isArray(value)) {
      return value.map(String).map((item) => item.trim()).filter(Boolean);
    }
    const text = String(value || "").trim();
    if (!text) return [];
    return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }

  const packagedNotes = normalizeNoteList(release.notes);
  const extraNotes = normalizeNoteList(release.notesExtra);
  release.notes = [...packagedNotes, ...extraNotes];
  release.metadataReady = false;

  function renderRelease() {
    const versionNumber = $("versionNumber");
    const publishedAt = $("publishedAt");
    const fileSizeText = $("fileSizeText");
    const accountStateText = $("accountStateText");
    const downloadButtonHint = $("downloadButtonHint");

    if (versionNumber) versionNumber.textContent = metadataReady ? release.version : "最新版";
    if (publishedAt) {
      publishedAt.textContent = metadataReady && release.publishedAt
        ? `${release.publishedAt} 发布`
        : "版本信息暂不可用";
    }
    if (fileSizeText) fileSizeText.textContent = metadataReady ? (release.fileSize || "—") : "—";

    if (
      downloadButton &&
      !downloadButton.disabled &&
      accountStateText?.textContent === "已授权" &&
      downloadButtonHint
    ) {
      downloadButtonHint.textContent = metadataReady ? release.version : "最新版";
    }
  }

  async function refreshFromStableMetadataBridge() {
    const metadataUrl = String(source.metadataUrl || "").trim();
    if (!metadataUrl) throw new Error("release_metadata_url_missing");

    const response = await fetch(metadataUrl, {
      method: "GET",
      headers: { "Accept": "application/json" },
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`release_metadata_${response.status}`);

    const payload = await response.json();
    if (!payload || payload.channel !== "stable" || !versionRe.test(String(payload.version || ""))) {
      throw new Error("invalid_release_metadata");
    }

    const remoteNotes = normalizeNoteList(payload.notes);
    release.version = String(payload.version);
    release.publishedAt = formatDate(payload.publishedAt);
    release.fileSize = String(payload.fileSize || "—");
    release.downloadUrl = "";
    release.notes = [...(remoteNotes.length ? remoteNotes : packagedNotes), ...extraNotes];
    release.metadataReady = true;
    metadataReady = true;

    document.documentElement.dataset.releaseSource = "stable-metadata-bridge";
    renderRelease();
  }

  Promise.resolve()
    .then(refreshFromStableMetadataBridge)
    .catch((error) => {
      console.warn("stable release metadata lookup failed; latest version display withheld", error);
      metadataReady = false;
      release.metadataReady = false;
      release.version = "";
      release.publishedAt = "";
      release.fileSize = "";
      release.downloadUrl = "";
      document.documentElement.dataset.releaseSource = "stable-metadata-unavailable";
      renderRelease();
    })
    .finally(() => {
      sourceReady = true;
      window.PORTAL_RELEASE_SOURCE_READY = true;
      window.PORTAL_RELEASE_METADATA_READY = metadataReady;
      window.dispatchEvent(new CustomEvent("portal-release-ready", {
        detail: { ...release, metadataReady }
      }));
    });
})();
