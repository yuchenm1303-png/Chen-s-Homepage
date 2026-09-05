(() => {
  const config = window.DOWNLOAD_PORTAL_CONFIG ?? {};
  const authConfig = config.auth ?? {};
  let supabasePromise = null;
  let toastTimer = null;

  function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2600);
  }

  async function getSupabase() {
    if (!supabasePromise) {
      supabasePromise = import("https://esm.sh/@supabase/supabase-js@2").then(({ createClient }) => {
        if (!authConfig.supabaseUrl || !authConfig.supabaseAnonKey) throw new Error("auth_config_missing");
        return createClient(authConfig.supabaseUrl, authConfig.supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false
          }
        });
      });
    }
    return await supabasePromise;
  }

  async function requestDelivery(action, version = "") {
    if (!authConfig.downloadFunctionUrl) throw new Error("download_function_missing");
    const client = await getSupabase();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    const session = data?.session;
    if (!session?.access_token) throw new Error("not_signed_in");

    const response = await fetch(authConfig.downloadFunctionUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action,
        platform: "windows-x64",
        ...(version ? { version } : {})
      })
    });

    if (!response.ok) {
      const error = new Error(`download_function_${response.status}`);
      error.status = response.status;
      throw error;
    }
    return await response.json();
  }

  function prepareSaveTarget(versionHint) {
    const downloader = window.ListingStudioChunkDownload;
    if (!downloader?.pickSaveFile || !downloader.canUseNativeSavePicker?.()) return null;
    return downloader.pickSaveFile(versionHint);
  }

  function isUserCancelled(error) {
    return error?.name === "AbortError" || error?.message === "save_cancelled";
  }

  async function runChunkedDownload({ action, version = "", button, hintNode = null, saveTargetPromise = null }) {
    const originalHint = hintNode?.textContent ?? "";
    const originalText = button?.textContent ?? "";
    if (button) button.disabled = true;
    if (hintNode) hintNode.textContent = saveTargetPromise ? "选择保存位置…" : "正在准备安全下载…";
    else if (button) button.textContent = saveTargetPromise ? "选择保存位置…" : "准备中…";

    try {
      const fileHandle = saveTargetPromise ? await saveTargetPromise : null;
      if (hintNode) hintNode.textContent = "正在验证并下载…";
      else if (button) button.textContent = "正在下载…";

      const payload = await requestDelivery(action, version);
      const downloader = window.ListingStudioChunkDownload;
      if (!downloader?.downloadPayload) throw new Error("chunk_downloader_missing");

      await downloader.downloadPayload(payload, {
        fileHandle,
        onProgress(progress) {
          const percent = progress.totalBytes > 0
            ? Math.min(100, Math.floor((progress.downloadedBytes / progress.totalBytes) * 100))
            : 0;
          const text = `下载中 ${percent}%`;
          if (hintNode) hintNode.textContent = text;
          else if (button) button.textContent = text;
        }
      });
      showToast(fileHandle ? "安装包已保存" : "安装包下载已开始");
    } catch (error) {
      if (isUserCancelled(error)) return;
      console.error("authorized installer download failed", error);
      if (error?.status === 401 || error?.message === "not_signed_in") showToast("请重新登录后下载");
      else if (error?.status === 403) showToast("当前账户没有有效下载权限");
      else if (error?.status === 404) showToast("该版本的安全镜像尚未准备好");
      else showToast("下载服务暂不可用，请稍后重试");
    } finally {
      if (button) button.disabled = false;
      if (hintNode) hintNode.textContent = originalHint;
      else if (button) button.textContent = originalText;
    }
  }

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const mainButton = target.closest("#downloadButton");
    if (mainButton) {
      if (mainButton.disabled) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const versionHint = String(document.getElementById("versionNumber")?.textContent || "").trim();
      const saveTargetPromise = prepareSaveTarget(versionHint);
      void runChunkedDownload({
        action: "download_latest",
        button: mainButton,
        hintNode: document.getElementById("downloadButtonHint"),
        saveTargetPromise
      });
      return;
    }

    const historyButton = target.closest(".release-history-download");
    if (!historyButton || historyButton.disabled) return;
    const row = historyButton.closest(".release-history-row");
    const version = String(row?.querySelector(".release-history-copy strong")?.textContent || "").trim();
    if (!/^v\d+\.\d+\.\d+$/.test(version)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    const saveTargetPromise = prepareSaveTarget(version);
    void runChunkedDownload({
      action: "download_version",
      version,
      button: historyButton,
      saveTargetPromise
    });
  }, true);
})();
