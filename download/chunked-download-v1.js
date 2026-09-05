(() => {
  const MAX_ATTEMPTS = 3;
  const RETRY_DELAYS_MS = [800, 2200];

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

  async function downloadPayload(payload, options = {}) {
    const normalized = validatePayload(payload);
    const parts = [];
    let downloaded = 0;

    for (const chunk of normalized.chunks) {
      options.onProgress?.({
        completedChunks: chunk.index,
        totalChunks: normalized.chunks.length,
        downloadedBytes: downloaded,
        totalBytes: normalized.size
      });
      const blob = await fetchChunk(chunk);
      parts.push(blob);
      downloaded += blob.size;
      options.onProgress?.({
        completedChunks: chunk.index + 1,
        totalChunks: normalized.chunks.length,
        downloadedBytes: downloaded,
        totalBytes: normalized.size
      });
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

    return {
      fileName: normalized.fileName,
      size: normalized.size,
      sha256: normalized.sha256
    };
  }

  window.ListingStudioChunkDownload = Object.freeze({ downloadPayload });
})();
