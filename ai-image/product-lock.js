const root = document.documentElement;
const endpoint = (root.dataset.backgroundApiEndpoint || '').trim();
const anonKey = (root.dataset.supabaseAnonKey || '').trim();

const state = {
  style: 'clean',
  ratio: '1:1',
  count: 1,
  imageFile: null,
  cutoutCanvas: null,
  serviceReady: false,
  modelReady: false,
  resultUrls: [],
};

const $ = (selector) => document.querySelector(selector);
const promptInput = $('#promptInput');
const imageInput = $('#imageInput');
const uploadZone = $('#uploadZone');
const uploadEmpty = $('#uploadEmpty');
const uploadPreview = $('#uploadPreview');
const removeImage = $('#removeImage');
const generateButton = $('#generateButton');
const generateHint = $('#generateHint');
const resultGrid = $('#resultGrid');
const clearResults = $('#clearResults');
const toast = $('#toast');
const engineState = $('#engineState');
const engineNoteText = $('#engineNoteText');

let toastTimer = null;
let segmenterPromise = null;
let transformersModulePromise = null;
let cutoutStatus = null;

function authHeaders(includeJson = false) {
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  };
  if (includeJson) headers['Content-Type'] = 'application/json';
  return headers;
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add('show'));
  toastTimer = window.setTimeout(() => {
    toast.classList.remove('show');
    window.setTimeout(() => { toast.hidden = true; }, 220);
  }, 3200);
}

function setServiceStatus(ready, label, note) {
  state.serviceReady = ready;
  engineState.classList.toggle('is-offline', !ready);
  engineState.querySelector('span').textContent = label;
  engineNoteText.textContent = note;
}

function regionLabel(region) {
  if (region === 'cn') return '中国站';
  if (region === 'global') return '国际站';
  return '';
}

async function checkHealth() {
  if (!endpoint || !anonKey) {
    setServiceStatus(false, '生成服务配置缺失', '商品锁定模式尚未配置背景生成接口。');
    return false;
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: authHeaders(false),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.ready) {
        const region = regionLabel(data?.region);
        setServiceStatus(
          true,
          region ? `商品锁定已连接 · ${region}` : '商品锁定已连接',
          `MiniMax 仅负责背景生成；真实商品像素在浏览器本地抠图并合成${region ? `，当前使用${region}` : ''}。`,
        );
        return true;
      }
      if (data?.error === 'minimax_api_key_missing') {
        setServiceStatus(false, 'MiniMax Key 待配置', '背景生成后端已部署，但 MiniMax API Key 尚未配置。');
        return false;
      }
      if (data?.error === 'minimax_api_key_invalid') {
        setServiceStatus(false, 'MiniMax Key 无效', '背景生成后端未能通过 MiniMax 鉴权。');
        return false;
      }
    } catch (error) {
      console.warn('[AI Image Studio] background health check failed', error);
    }
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 650));
  }

  setServiceStatus(false, '生成服务暂不可用', '背景生成服务暂时没有响应；商品本地抠图仍可使用。');
  return false;
}

function ensureCutoutStatus() {
  if (cutoutStatus) return cutoutStatus;
  cutoutStatus = document.createElement('div');
  cutoutStatus.className = 'cutout-status';
  cutoutStatus.hidden = true;
  uploadZone.appendChild(cutoutStatus);
  return cutoutStatus;
}

function setCutoutStatus(text, kind = '') {
  const el = ensureCutoutStatus();
  el.hidden = !text;
  el.textContent = text;
  el.className = `cutout-status${kind ? ` ${kind}` : ''}`;
}

function updateHint() {
  const lockState = state.cutoutCanvas ? '商品已锁定' : '请先上传商品';
  generateHint.textContent = `${lockState} · ${state.count} 张 · ${state.ratio}`;
}

function setupChoiceGroup(selector, key, parser = (value) => value) {
  const host = $(selector);
  host.addEventListener('click', (event) => {
    const button = event.target.closest('.choice');
    if (!button) return;
    host.querySelectorAll('.choice').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    state[key] = parser(button.dataset.value);
    if (key === 'count') renderEmptySlots();
    updateHint();
  });
}

function renderEmptySlots(message = '生成结果会显示在这里') {
  revokeResultUrls();
  resultGrid.dataset.count = String(state.count);
  resultGrid.innerHTML = '';
  for (let index = 0; index < state.count; index += 1) {
    const slot = document.createElement('div');
    slot.className = 'result-slot empty';
    slot.innerHTML = `<span>${String(index + 1).padStart(2, '0')}</span><p>${message}</p>`;
    resultGrid.appendChild(slot);
  }
}

function renderLoadingSlots(message = 'AI 正在生成背景…') {
  revokeResultUrls();
  resultGrid.dataset.count = String(state.count);
  resultGrid.innerHTML = '';
  for (let index = 0; index < state.count; index += 1) {
    const slot = document.createElement('div');
    slot.className = 'result-slot empty loading';
    slot.innerHTML = `<span>${String(index + 1).padStart(2, '0')}</span><p>${message}</p>`;
    resultGrid.appendChild(slot);
  }
}

function normalizeImages(payload) {
  const raw = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.images)
      ? payload.images
      : Array.isArray(payload?.data?.image_urls)
        ? payload.data.image_urls
        : [];
  return raw.map((item) => typeof item === 'string' ? item : item?.url || '').filter(Boolean);
}

function revokeResultUrls() {
  state.resultUrls.forEach((url) => URL.revokeObjectURL(url));
  state.resultUrls = [];
}

async function loadTransformers() {
  if (!transformersModulePromise) {
    transformersModulePromise = import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm');
  }
  return transformersModulePromise;
}

async function loadSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      setCutoutStatus('首次加载本地抠图模型…', 'processing');
      const { AutoModel, AutoProcessor, env } = await loadTransformers();
      env.allowLocalModels = false;
      const [processor, model] = await Promise.all([
        AutoProcessor.from_pretrained('BritishWerewolf/U-2-Netp'),
        AutoModel.from_pretrained('BritishWerewolf/U-2-Netp', { dtype: 'fp32' }),
      ]);
      state.modelReady = true;
      return { processor, model };
    })().catch((error) => {
      segmenterPromise = null;
      state.modelReady = false;
      throw error;
    });
  }
  return segmenterPromise;
}

function canvasFromRgba(rawImage) {
  const canvas = document.createElement('canvas');
  canvas.width = rawImage.width;
  canvas.height = rawImage.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const bytes = rawImage.data instanceof Uint8ClampedArray
    ? rawImage.data
    : new Uint8ClampedArray(rawImage.data);
  ctx.putImageData(new ImageData(bytes, rawImage.width, rawImage.height), 0, 0);
  return canvas;
}

function trimTransparentCanvas(source) {
  const ctx = source.getContext('2d', { willReadFrequently: true });
  const { data } = ctx.getImageData(0, 0, source.width, source.height);
  let minX = source.width;
  let minY = source.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const alpha = data[(y * source.width + x) * 4 + 3];
      if (alpha > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) throw new Error('empty_product_mask');
  const boxWidth = maxX - minX + 1;
  const boxHeight = maxY - minY + 1;
  const margin = Math.max(4, Math.round(Math.max(boxWidth, boxHeight) * 0.012));
  const sx = Math.max(0, minX - margin);
  const sy = Math.max(0, minY - margin);
  const sw = Math.min(source.width - sx, boxWidth + margin * 2);
  const sh = Math.min(source.height - sy, boxHeight + margin * 2);

  const trimmed = document.createElement('canvas');
  trimmed.width = sw;
  trimmed.height = sh;
  trimmed.getContext('2d').drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  return trimmed;
}

async function createLockedProduct(file) {
  const { RawImage } = await loadTransformers();
  const source = await RawImage.fromBlob(file);

  if (source.channels === 4) {
    let hasTransparency = false;
    for (let i = 3; i < source.data.length; i += 4) {
      if (source.data[i] < 245) {
        hasTransparency = true;
        break;
      }
    }
    if (hasTransparency) {
      return trimTransparentCanvas(canvasFromRgba(source.clone().rgba()));
    }
  }

  const { processor, model } = await loadSegmenter();
  setCutoutStatus('正在识别并锁定商品主体…', 'processing');
  const processed = await processor(source);
  const output = await model({ input: processed.pixel_values });
  const maskTensor = output.mask;
  if (!maskTensor?.data?.length) throw new Error('mask_generation_failed');

  const maskWidth = Number(maskTensor.dims?.[maskTensor.dims.length - 1] || 320);
  const maskHeight = Number(maskTensor.dims?.[maskTensor.dims.length - 2] || 320);
  const maskBytes = maskTensor.data instanceof Uint8Array
    ? maskTensor.data
    : Uint8Array.from(maskTensor.data, (value) => Math.max(0, Math.min(255, Math.round(Number(value) * 255))));
  let mask = new RawImage(maskBytes, maskWidth, maskHeight, 1);
  mask = await mask.resize(source.width, source.height, { resample: 2 });

  const rgba = source.clone().rgba();
  rgba.putAlpha(mask);
  return trimTransparentCanvas(canvasFromRgba(rgba));
}

function resetUpload() {
  state.imageFile = null;
  state.cutoutCanvas = null;
  imageInput.value = '';
  uploadPreview.src = '';
  uploadPreview.hidden = true;
  removeImage.hidden = true;
  uploadEmpty.hidden = false;
  uploadZone.classList.remove('has-cutout', 'is-processing');
  setCutoutStatus('');
  updateHint();
}

async function applyImageFile(file) {
  if (!file) return;
  const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
  if (!allowedTypes.has(file.type)) {
    showToast('请选择 PNG、JPG 或 WEBP 图片。');
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    showToast('商品图请控制在 8 MB 以内。');
    return;
  }

  state.imageFile = file;
  state.cutoutCanvas = null;
  uploadEmpty.hidden = true;
  removeImage.hidden = false;
  uploadZone.classList.add('is-processing');
  uploadZone.classList.remove('has-cutout');
  updateHint();

  const originalUrl = URL.createObjectURL(file);
  uploadPreview.src = originalUrl;
  uploadPreview.hidden = false;
  uploadPreview.onload = () => URL.revokeObjectURL(originalUrl);

  try {
    const cutout = await createLockedProduct(file);
    if (state.imageFile !== file) return;
    state.cutoutCanvas = cutout;
    uploadPreview.src = cutout.toDataURL('image/png');
    uploadZone.classList.remove('is-processing');
    uploadZone.classList.add('has-cutout');
    setCutoutStatus('商品主体已锁定', 'ready');
    updateHint();
    showToast('商品已自动抠出；生成时 AI 不会重新绘制商品本体。');
  } catch (error) {
    console.error('[AI Image Studio] local background removal failed', error);
    if (state.imageFile !== file) return;
    state.cutoutCanvas = null;
    uploadZone.classList.remove('is-processing', 'has-cutout');
    setCutoutStatus('自动抠图失败，可切换旧版模式', 'error');
    updateHint();
    showToast('这张图自动抠图失败；可以换一张背景更干净的商品图，或切到旧版图生图。');
  }
}

function errorMessage(response, data) {
  if (response.status === 429 || data?.error === 'rate_limited') return '生成太频繁了，请稍后再试。';
  if (data?.error === 'minimax_api_key_missing') return 'MiniMax API Key 尚未配置。';
  if (data?.error === 'minimax_api_key_invalid') return 'MiniMax API Key 未通过鉴权。';
  if (data?.error === 'generation_timeout') return '背景生成超时，请稍后重试。';
  if (data?.error === 'generation_failed') {
    const detail = String(data?.providerMessage || '').trim();
    return detail ? `背景生成失败：${detail}` : '背景生成失败，请稍后重试。';
  }
  return response.status === 503 ? '生成服务暂不可用，请稍后重试。' : '生成失败，请稍后重试。';
}

async function blobToImage(blob) {
  if ('createImageBitmap' in window) return createImageBitmap(blob);
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('background_image_decode_failed'));
    };
    image.src = url;
  });
}

function imageSize(image) {
  return {
    width: image.width || image.naturalWidth,
    height: image.height || image.naturalHeight,
  };
}

function drawCover(ctx, image, width, height) {
  const size = imageSize(image);
  const scale = Math.max(width / size.width, height / size.height);
  const drawWidth = size.width * scale;
  const drawHeight = size.height * scale;
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function composeProduct(background, productCanvas) {
  const size = imageSize(background);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  drawCover(ctx, background, canvas.width, canvas.height);

  const productAspect = productCanvas.width / productCanvas.height;
  let maxHeight = canvas.height * 0.60;
  let maxWidth = canvas.width * 0.58;
  if (canvas.height > canvas.width * 1.25) {
    maxHeight = canvas.height * 0.48;
    maxWidth = canvas.width * 0.68;
  } else if (canvas.width > canvas.height * 1.35) {
    maxHeight = canvas.height * 0.68;
    maxWidth = canvas.width * 0.40;
  }

  let drawWidth = maxWidth;
  let drawHeight = drawWidth / productAspect;
  if (drawHeight > maxHeight) {
    drawHeight = maxHeight;
    drawWidth = drawHeight * productAspect;
  }

  const centerX = canvas.width * 0.5;
  const groundY = canvas.height * 0.855;
  const x = centerX - drawWidth / 2;
  const y = groundY - drawHeight;

  ctx.save();
  ctx.filter = `blur(${Math.max(7, Math.round(canvas.width * 0.014))}px)`;
  ctx.fillStyle = 'rgba(0,0,0,0.27)';
  ctx.beginPath();
  ctx.ellipse(centerX, groundY + drawHeight * 0.012, drawWidth * 0.37, Math.max(6, drawHeight * 0.035), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.drawImage(productCanvas, x, y, drawWidth, drawHeight);
  return canvas;
}

async function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('composite_export_failed')), 'image/png', 0.96);
  });
}

async function buildComposite(backgroundUrl) {
  const response = await fetch(backgroundUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error(`background_load_http_${response.status}`);
  const blob = await response.blob();
  const background = await blobToImage(blob);
  try {
    const canvas = composeProduct(background, state.cutoutCanvas);
    return await canvasToBlob(canvas);
  } finally {
    if (typeof background.close === 'function') background.close();
  }
}

function renderResults(blobs) {
  revokeResultUrls();
  resultGrid.dataset.count = String(Math.min(blobs.length, 4));
  resultGrid.innerHTML = '';

  blobs.slice(0, 4).forEach((blob, index) => {
    const src = URL.createObjectURL(blob);
    state.resultUrls.push(src);
    const slot = document.createElement('div');
    slot.className = 'result-slot';

    const image = document.createElement('img');
    image.src = src;
    image.alt = `锁定商品生成图 ${index + 1}`;

    const badge = document.createElement('span');
    badge.className = 'locked-badge';
    badge.textContent = '原商品像素';

    const button = document.createElement('button');
    button.className = 'download-result';
    button.type = 'button';
    button.textContent = '下载';
    button.addEventListener('click', () => {
      const anchor = document.createElement('a');
      anchor.href = src;
      anchor.download = `smirel-product-locked-${Date.now()}-${index + 1}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    });

    slot.append(image, badge, button);
    resultGrid.appendChild(slot);
  });
}

async function generate() {
  const prompt = promptInput.value.trim();
  if (!state.imageFile) {
    showToast('商品锁定模式必须先上传商品原图。');
    return;
  }
  if (!state.cutoutCanvas) {
    showToast('商品主体还没有抠图完成，请稍等一下。');
    return;
  }
  if (!prompt) {
    promptInput.focus();
    showToast('请描述你想要的背景或场景。');
    return;
  }
  if (!endpoint || !anonKey) {
    showToast('背景生成接口尚未配置。');
    return;
  }

  generateButton.disabled = true;
  generateButton.querySelector('strong').textContent = '正在生成背景';
  generateButton.querySelector('.generate-arrow').textContent = '···';
  renderLoadingSlots('AI 正在生成空场景背景…');

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({
        prompt,
        style: state.style,
        aspect_ratio: state.ratio,
        count: state.count,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(errorMessage(response, data));

    const backgrounds = normalizeImages(data);
    if (!backgrounds.length) throw new Error('背景生成完成，但接口没有返回图片。');
    renderLoadingSlots('背景完成，正在合成真实商品…');
    const composites = await Promise.all(backgrounds.map((url) => buildComposite(url)));
    renderResults(composites);

    const region = regionLabel(data?.region);
    setServiceStatus(
      true,
      region ? `商品锁定已连接 · ${region}` : '商品锁定已连接',
      `背景由 MiniMax 生成；商品主体使用本地抠图后的真实像素进行合成${region ? `，当前使用${region}` : ''}。`,
    );
    showToast(`已生成 ${composites.length} 张商品锁定场景图。`);
  } catch (error) {
    console.error('[AI Image Studio] locked product generation failed', error);
    renderEmptySlots('生成失败，请稍后重试');
    showToast(error instanceof Error ? error.message : '生成失败，请稍后重试。');
    void checkHealth();
  } finally {
    generateButton.disabled = false;
    generateButton.querySelector('strong').textContent = '生成商品图';
    generateButton.querySelector('.generate-arrow').textContent = '→';
    updateHint();
  }
}

setupChoiceGroup('#styleChoices', 'style');
setupChoiceGroup('#ratioChoices', 'ratio');
setupChoiceGroup('#countChoices', 'count', (value) => Number(value));

document.querySelector('.prompt-examples').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-prompt]');
  if (!button) return;
  promptInput.value = button.dataset.prompt || '';
  promptInput.focus();
});

imageInput.addEventListener('change', () => void applyImageFile(imageInput.files?.[0]));
removeImage.addEventListener('click', (event) => {
  event.preventDefault();
  event.stopPropagation();
  resetUpload();
});

['dragenter', 'dragover'].forEach((type) => {
  uploadZone.addEventListener(type, (event) => {
    event.preventDefault();
    uploadZone.classList.add('is-dragover');
  });
});
['dragleave', 'drop'].forEach((type) => {
  uploadZone.addEventListener(type, (event) => {
    event.preventDefault();
    uploadZone.classList.remove('is-dragover');
  });
});
uploadZone.addEventListener('drop', (event) => void applyImageFile(event.dataTransfer?.files?.[0]));

generateButton.addEventListener('click', () => void generate());
clearResults.addEventListener('click', () => renderEmptySlots());
window.addEventListener('beforeunload', revokeResultUrls);

renderEmptySlots();
updateHint();
void checkHealth();
