(() => {
  const MAX_ATTEMPTS = 3;
  const RETRY_DELAYS_MS = [800, 2200];
  const NATIVE_PREFETCH_WINDOW = 2;

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function validatePayload(payload) {
    if (!payload || payload.delivery !== "chunked") throw new Error("unsupported_delivery");
    const fileName = String(payload.fileName || "").trim();
    const size = Number(payload.size || 0);
    const sha256 = String(payload.sha256 || "").trim().toLowerCase();
    const chunks = Array.isArray(payload.chunks) ? payload.chunks : [];
    if (!/^EcommerceAgent-Setup-\d+\.\d+\.\d+\.exe$/.test(fileName)) throw new Error("invalid_file_name");
    if (!Number.isSafeInteger(size) || size <= 0) throw new Error("invalid_file_size");
    if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error("invalid_file_sha256");
    if (!chunks.length || chunks.length > 64) throw new Error("invalid_chunk_count");

    let covered = 0;
    const normalized = chunks.map((chunk, index) => {
      const chunkIndex = Number(chunk?.index);
      const chunkSize = Number(chunk?.size);
      const url = String(chunk?.url || "").trim();
      if (chunkIndex !== index) throw new Error("invalid_chunk_index");
      if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0) throw new Error("invalid_chunk_size");
      if (!url.startsWith("https://")) throw new Error("invalid_chunk_url");
      covered += chunkSize;
      return { index, size: chunkSize, url };
    });
    if (covered !== size) throw new Error("chunk_coverage_mismatch");
    return { fileName, size, sha256, chunks: normalized };
  }

  function suggestedFileName(versionHint = "") {
    const version = String(versionHint || "").trim().replace(/^v/i, "");
    return /^\d+\.\d+\.\d+$/.test(version)
      ? `EcommerceAgent-Setup-${version}.exe`
      : "EcommerceAgent-Setup.exe";
  }

  function canUseNativeSavePicker() {
    return window.isSecureContext && typeof window.showSaveFilePicker === "function";
  }

  async function pickSaveFile(versionHint = "") {
    if (!canUseNativeSavePicker()) return null;
    return window.showSaveFilePicker({
      suggestedName: suggestedFileName(versionHint),
      types: [{
        description: "Listing Studio Windows installer",
        accept: { "application/octet-stream": [".exe"] }
      }]
    });
  }

  async function fetchChunk(chunk) {
    let lastError = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(chunk.url, { method: "GET", cache: "no-store" });
        if (!response.ok) throw new Error(`chunk_http_${response.status}`);
        const blob = await response.blob();
        if (blob.size !== chunk.size) throw new Error(`chunk_size_${blob.size}_${chunk.size}`);
        return blob;
      } catch (error) {
        lastError = error;
        if (attempt < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt]);
      }
    }
    throw lastError || new Error("chunk_download_failed");
  }

  function fetchChunkSettled(chunk) {
    return fetchChunk(chunk).then(
      (blob) => ({ blob, error: null }),
      (error) => ({ blob: null, error })
    );
  }

  async function consumeNativeChunks(chunks, consume) {
    const pending = new Map();
    const schedule = (index) => {
      if (index >= chunks.length || pending.has(index)) return;
      pending.set(index, fetchChunkSettled(chunks[index]));
    };

    for (let index = 0; index < Math.min(NATIVE_PREFETCH_WINDOW, chunks.length); index += 1) {
      schedule(index);
    }

    for (let index = 0; index < chunks.length; index += 1) {
      const outcome = await pending.get(index);
      pending.delete(index);
      if (!outcome || outcome.error || !outcome.blob) {
        throw outcome?.error || new Error("chunk_prefetch_failed");
      }

      await consume(chunks[index], outcome.blob);
      schedule(index + NATIVE_PREFETCH_WINDOW);
    }
  }

  function emitProgress(options, completedChunks, totalChunks, downloadedBytes, totalBytes) {
    options.onProgress?.({ completedChunks, totalChunks, downloadedBytes, totalBytes });
  }

  async function downloadToFileHandle(normalized, fileHandle, options) {
    const writable = await fileHandle.createWritable();
    let downloaded = 0;

    try {
      await consumeNativeChunks(normalized.chunks, async (chunk, blob) => {
        emitProgress(options, chunk.index, normalized.chunks.length, downloaded, normalized.size);
        await writable.write({ type: "write", position: downloaded, data: blob });
        downloaded += blob.size;
        emitProgress(options, chunk.index + 1, normalized.chunks.length, downloaded, normalized.size);
      });

      if (downloaded !== normalized.size) throw new Error("assembled_size_mismatch");
      await writable.truncate(normalized.size);
      await writable.close();

      const savedFile = await fileHandle.getFile();
      if (savedFile.size !== normalized.size) throw new Error("saved_file_size_mismatch");
    } catch (error) {
      try { await writable.abort(); } catch {}
      throw error;
    }
  }

  async function downloadToBrowser(normalized, options) {
    const parts = [];
    let downloaded = 0;

    for (const chunk of normalized.chunks) {
      emitProgress(options, chunk.index, normalized.chunks.length, downloaded, normalized.size);
      const blob = await fetchChunk(chunk);
      parts.push(blob);
      downloaded += blob.size;
      emitProgress(options, chunk.index + 1, normalized.chunks.length, downloaded, normalized.size);
    }

    if (downloaded !== normalized.size) throw new Error("assembled_size_mismatch");

    const fileBlob = new Blob(parts, { type: "application/octet-stream" });
    if (fileBlob.size !== normalized.size) throw new Error("assembled_blob_size_mismatch");

    const objectUrl = URL.createObjectURL(fileBlob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = normalized.fileName;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }

  async function downloadPayload(payload, options = {}) {
    const normalized = validatePayload(payload);
    if (options.fileHandle) {
      await downloadToFileHandle(normalized, options.fileHandle, options);
    } else {
      await downloadToBrowser(normalized, options);
    }

    return {
      fileName: normalized.fileName,
      size: normalized.size,
      sha256: normalized.sha256
    };
  }

  window.ListingStudioChunkDownload = Object.freeze({
    canUseNativeSavePicker,
    pickSaveFile,
    suggestedFileName,
    downloadPayload
  });
})();
