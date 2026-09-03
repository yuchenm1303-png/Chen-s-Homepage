const root = document.documentElement;
const endpoint = (root.dataset.backgroundApiEndpoint || '').trim();
const anonKey = (root.dataset.supabaseAnonKey || '').trim();

const STORAGE_KEY = 'smirel-ai-ecommerce-studio-v1';
const DB_NAME = 'smirel-ai-image-studio';
const DB_STORE = 'blobs';
const DB_VERSION = 1;

const WORKFLOWS = {
  hero5: {
    title: '商品主图套装',
    description: '5 张可直接筛选的主图 / 场景候选',
    tasks: [
      {
        title: '纯净首图',
        objective: '干净、聚焦，适合作为商品首图候选',
        scene: 'Pure #FFFFFF seamless commercial studio background with an almost invisible clean horizontal sweep, soft neutral studio illumination, no props, no decorative objects, generous negative space.',
        placement: { x: 0.50, groundY: 0.86, height: 0.62, maxWidth: 0.64 },
      },
      {
        title: '高级棚拍',
        objective: '提升材质与品牌质感',
        scene: 'Premium light stone studio set with a restrained warm-gray palette, soft directional window-like light from upper left, subtle realistic surface texture, elegant catalog photography, uncluttered composition.',
        placement: { x: 0.50, groundY: 0.86, height: 0.60, maxWidth: 0.60 },
      },
      {
        title: '卖点留白',
        objective: '为后续标题或卖点文案预留空间',
        scene: 'Minimal premium advertising background with a believable tabletop, quiet neutral palette, product placement area on the left third and at least 45 percent clean negative space on the right for future copy, coherent soft light.',
        placement: { x: 0.34, groundY: 0.86, height: 0.56, maxWidth: 0.48 },
      },
      {
        title: '生活场景',
        objective: '展示真实使用语境，但不抢商品主体',
        scene: 'Believable premium lifestyle environment with soft natural daylight, refined but realistic materials, a clean support surface, only a few distant contextual props, commercially usable photography, central area kept clear.',
        placement: { x: 0.53, groundY: 0.86, height: 0.57, maxWidth: 0.58 },
      },
      {
        title: '品牌氛围',
        objective: '形成更强品牌感的广告候选',
        scene: 'High-end campaign set with a restrained dark-to-mid neutral palette, elegant directional rim and key lighting, premium stone or matte surface, subtle depth, dramatic but believable commercial photography, no visible product-shaped props.',
        placement: { x: 0.50, groundY: 0.86, height: 0.58, maxWidth: 0.58 },
      },
    ],
  },
  lifestyle4: {
    title: '生活场景套装',
    description: '4 张不同语境的真实商业场景',
    tasks: [
      {
        title: '自然窗光',
        objective: '柔和日常感',
        scene: 'Bright believable interior near a large window, soft morning daylight, clean textured tabletop, restrained neutral decor, natural photographic depth, no product-shaped objects in the scene.',
        placement: { x: 0.50, groundY: 0.86, height: 0.58, maxWidth: 0.60 },
      },
      {
        title: '现代家居',
        objective: '现代独立站氛围',
        scene: 'Modern premium home environment with soft neutral architecture, subtle warm accents, realistic natural light, clean support surface, uncluttered ecommerce lifestyle photography.',
        placement: { x: 0.54, groundY: 0.86, height: 0.56, maxWidth: 0.58 },
      },
      {
        title: '户外晨光',
        objective: '清新户外场景',
        scene: 'Natural outdoor commercial scene at soft early-morning light, believable stone or wood support surface, tasteful greenery kept away from center, realistic atmospheric depth, calm premium photography.',
        placement: { x: 0.48, groundY: 0.87, height: 0.56, maxWidth: 0.58 },
      },
      {
        title: '轻奢空间',
        objective: '更高级的生活方式广告图',
        scene: 'Quiet luxury lifestyle set with refined stone, glass and soft fabric accents in the distance, sophisticated directional light, realistic premium interior, generous clean product placement area.',
        placement: { x: 0.50, groundY: 0.86, height: 0.57, maxWidth: 0.58 },
      },
    ],
  },
  social3: {
    title: '社媒广告套装',
    description: '3 张构图差异明显、方便做信息流测试',
    tasks: [
      {
        title: '强主体构图',
        objective: '缩略图中快速抓住主体',
        scene: 'Clean social advertising background with strong but restrained tonal contrast, simple believable surface, clear center placement area, modern commercial photography, no text and no extra hero objects.',
        placement: { x: 0.50, groundY: 0.86, height: 0.66, maxWidth: 0.68 },
      },
      {
        title: '左图右文',
        objective: '右侧保留广告文案空间',
        scene: 'Premium social media ad background composed for product on the left and large clean copy space on the right, subtle environmental depth, soft coherent light, minimal props kept far from subject area.',
        placement: { x: 0.33, groundY: 0.86, height: 0.57, maxWidth: 0.48 },
      },
      {
        title: '编辑部氛围',
        objective: '更有品牌记忆点的内容图',
        scene: 'Editorial ecommerce campaign background with a tasteful material palette, controlled side light, slightly bolder composition, realistic photographic texture, generous negative space and no readable text.',
        placement: { x: 0.56, groundY: 0.86, height: 0.57, maxWidth: 0.56 },
      },
    ],
  },
  quick1: {
    title: '自定义单图',
    description: '按你的补充要求生成一张',
    tasks: [
      {
        title: '自定义任务',
        objective: '按当前全局要求生成',
        scene: 'Clean commercially usable background with a believable support surface, coherent professional light, generous product placement area and restrained visual clutter.',
        placement: { x: 0.50, groundY: 0.86, height: 0.60, maxWidth: 0.62 },
      },
    ],
  },
};

const CAMPAIGNS = {
  clean: 'Campaign Style Lock: clean premium ecommerce system; off-white and soft neutral palette; neutral-cool color temperature; soft key light from upper left; restrained realistic materials; generous whitespace; consistent commercial photography; no random decorative clutter.',
  studio: 'Campaign Style Lock: professional studio ecommerce system; neutral background family; controlled softbox key from upper left with gentle fill; realistic tabletop or seamless sweep; consistent shadow softness and catalog-grade finish.',
  luxury: 'Campaign Style Lock: quiet luxury ecommerce system; deep neutral and refined stone palette; sophisticated directional key light with subtle rim; premium matte and stone materials; restrained editorial mood; consistent high-end advertising language.',
  lifestyle: 'Campaign Style Lock: believable premium lifestyle system; natural daylight direction kept consistent; warm-neutral environment; tasteful real-world materials; sparse contextual props; photographic realism and calm commercial mood.',
};

const state = {
  projectId: '',
  workflow: 'hero5',
  campaign: 'clean',
  ratio: '1:1',
  product: {
    name: '',
    brand: '',
    category: '',
    facts: '',
    sourceName: '',
  },
  extra: '',
  imageFile: null,
  cutoutCanvas: null,
  plan: [],
  serviceReady: false,
  running: false,
  resultBlobs: new Map(),
  resultUrls: new Map(),
};

const $ = (selector) => document.querySelector(selector);
const studioImageInput = $('#studioImageInput');
const studioUpload = $('#studioUpload');
const studioUploadEmpty = $('#studioUploadEmpty');
const studioPreview = $('#studioPreview');
const studioRemoveImage = $('#studioRemoveImage');
const studioCutoutState = $('#studioCutoutState');
const studioProductName = $('#studioProductName');
const studioBrand = $('#studioBrand');
const studioCategory = $('#studioCategory');
const studioFacts = $('#studioFacts');
const studioExtra = $('#studioExtra');
const studioPlanButton = $('#studioPlanButton');
const studioRunAll = $('#studioRunAll');
const studioReset = $('#studioReset');
const studioTaskList = $('#studioTaskList');
const studioEmptyPlan = $('#studioEmptyPlan');
const studioProgressText = $('#studioProgressText');
const studioProgressBar = $('#studioProgressBar');
const studioPlanLabel = $('#studioPlanLabel');
const engineState = $('#engineState');
const engineNoteText = $('#engineNoteText');
const toast = $('#toast');

let toastTimer = null;
let segmenterPromise = null;
let transformersModulePromise = null;
let dbPromise = null;

function uuid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `studio-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function authHeaders(includeJson = false) {
  const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };
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
    setServiceStatus(false, '生成服务配置缺失', 'AI 电商工作台尚未配置背景生成接口。');
    return false;
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(endpoint, { method: 'GET', headers: authHeaders(false), cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.ready) {
        const region = regionLabel(data.region);
        setServiceStatus(true, region ? `电商工作台已连接 · ${region}` : '电商工作台已连接', `当前 Provider：MiniMax Background${region ? ` · ${region}` : ''}。商品主体由 Product Pixel Lock 保持真实像素。`);
        return true;
      }
      if (data?.error === 'minimax_api_key_missing') {
        setServiceStatus(false, 'MiniMax Key 待配置', '工作台已就绪，但背景 Provider 尚未配置 Key。');
        return false;
      }
      if (data?.error === 'minimax_api_key_invalid') {
        setServiceStatus(false, 'MiniMax Key 无效', '背景 Provider 未通过鉴权。');
        return false;
      }
    } catch (error) {
      console.warn('[AI Ecommerce Studio] health check failed', error);
    }
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 650));
  }
  setServiceStatus(false, '生成服务暂不可用', '任务计划和商品档案仍可编辑，在线生成暂时不可用。');
  return false;
}

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

async function idbPut(name, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(value, `${state.projectId}:${name}`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(name) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const request = tx.objectStore(DB_STORE).get(`${state.projectId}:${name}`);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function idbDeleteProject(projectId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    const store = tx.objectStore(DB_STORE);
    const request = store.getAllKeys();
    request.onsuccess = () => {
      const prefix = `${projectId}:`;
      request.result.filter((key) => String(key).startsWith(prefix)).forEach((key) => store.delete(key));
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function serializableState() {
  return {
    version: 1,
    projectId: state.projectId,
    workflow: state.workflow,
    campaign: state.campaign,
    ratio: state.ratio,
    product: state.product,
    extra: state.extra,
    plan: state.plan.map((task) => ({ ...task, error: task.error || '' })),
  };
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializableState()));
}

function restoreMetadata() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { saved = null; }
  state.projectId = String(saved?.projectId || uuid());
  state.workflow = WORKFLOWS[saved?.workflow] ? saved.workflow : 'hero5';
  state.campaign = CAMPAIGNS[saved?.campaign] ? saved.campaign : 'clean';
  state.ratio = ['1:1', '4:3', '16:9', '9:16'].includes(saved?.ratio) ? saved.ratio : '1:1';
  state.product = {
    name: String(saved?.product?.name || ''),
    brand: String(saved?.product?.brand || ''),
    category: String(saved?.product?.category || ''),
    facts: String(saved?.product?.facts || ''),
    sourceName: String(saved?.product?.sourceName || ''),
  };
  state.extra = String(saved?.extra || '');
  state.plan = Array.isArray(saved?.plan) ? saved.plan : [];
}

async function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('canvas_export_failed')), 'image/png', 0.96);
  });
}

async function blobToImage(blob) {
  if ('createImageBitmap' in window) return createImageBitmap(blob);
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image_decode_failed')); };
    image.src = url;
  });
}

function imageSize(image) {
  return { width: image.width || image.naturalWidth, height: image.height || image.naturalHeight };
}

async function canvasFromBlob(blob) {
  const image = await blobToImage(blob);
  try {
    const size = imageSize(image);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.getContext('2d').drawImage(image, 0, 0);
    return canvas;
  } finally {
    if (typeof image.close === 'function') image.close();
  }
}

async function loadTransformers() {
  if (!transformersModulePromise) transformersModulePromise = import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm');
  return transformersModulePromise;
}

async function loadSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      setCutoutState('首次加载本地抠图模型…', '');
      const { AutoModel, AutoProcessor, env } = await loadTransformers();
      env.allowLocalModels = false;
      const [processor, model] = await Promise.all([
        AutoProcessor.from_pretrained('BritishWerewolf/U-2-Netp'),
        AutoModel.from_pretrained('BritishWerewolf/U-2-Netp', { dtype: 'fp32' }),
      ]);
      return { processor, model };
    })().catch((error) => { segmenterPromise = null; throw error; });
  }
  return segmenterPromise;
}

function canvasFromRgba(rawImage) {
  const canvas = document.createElement('canvas');
  canvas.width = rawImage.width;
  canvas.height = rawImage.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const bytes = rawImage.data instanceof Uint8ClampedArray ? rawImage.data : new Uint8ClampedArray(rawImage.data);
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
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
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
      if (source.data[i] < 245) { hasTransparency = true; break; }
    }
    if (hasTransparency) return trimTransparentCanvas(canvasFromRgba(source.clone().rgba()));
  }
  const { processor, model } = await loadSegmenter();
  setCutoutState('正在识别并锁定商品主体…', '');
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

function setCutoutState(text, kind = '') {
  studioCutoutState.textContent = text;
  studioCutoutState.className = `studio-cutout-state${kind ? ` ${kind}` : ''}`;
  studioCutoutState.hidden = !text;
}

function autoNameFromFile(fileName) {
  return String(fileName || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
}

async function applyImageFile(file) {
  if (!file) return;
  const allowed = new Set(['image/png', 'image/jpeg', 'image/webp']);
  if (!allowed.has(file.type)) return showToast('请选择 PNG、JPG 或 WEBP 商品图。');
  if (file.size > 8 * 1024 * 1024) return showToast('商品图请控制在 8 MB 以内。');

  state.imageFile = file;
  state.cutoutCanvas = null;
  state.product.sourceName = file.name;
  if (!state.product.name) state.product.name = autoNameFromFile(file.name);
  syncFormFromState();
  studioUploadEmpty.hidden = true;
  studioPreview.hidden = false;
  studioRemoveImage.hidden = false;
  studioUpload.classList.remove('has-cutout');
  setCutoutState('正在准备商品…');

  const previewUrl = URL.createObjectURL(file);
  studioPreview.src = previewUrl;
  studioPreview.onload = () => URL.revokeObjectURL(previewUrl);

  try {
    const cutout = await createLockedProduct(file);
    if (state.imageFile !== file) return;
    state.cutoutCanvas = cutout;
    const cutoutBlob = await canvasToBlob(cutout);
    await Promise.all([idbPut('source', file), idbPut('cutout', cutoutBlob)]);
    studioPreview.src = URL.createObjectURL(cutoutBlob);
    studioPreview.onload = () => URL.revokeObjectURL(studioPreview.src);
    studioUpload.classList.add('has-cutout');
    setCutoutState('商品像素已锁定', 'ready');
    persist();
    updateButtons();
    showToast('商品主体已锁定。下一步确认商品事实并生成任务计划。');
  } catch (error) {
    console.error('[AI Ecommerce Studio] cutout failed', error);
    state.cutoutCanvas = null;
    studioUpload.classList.remove('has-cutout');
    setCutoutState('自动抠图失败', 'error');
    updateButtons();
    showToast('自动抠图失败。可以换一张背景更干净的商品图，或切换商品锁定 / 旧版模式。');
  }
}

async function restoreImageState() {
  try {
    const cutoutBlob = await idbGet('cutout');
    if (!cutoutBlob) return;
    state.cutoutCanvas = await canvasFromBlob(cutoutBlob);
    studioUploadEmpty.hidden = true;
    studioPreview.hidden = false;
    studioRemoveImage.hidden = false;
    studioUpload.classList.add('has-cutout');
    const url = URL.createObjectURL(cutoutBlob);
    studioPreview.src = url;
    studioPreview.onload = () => URL.revokeObjectURL(url);
    setCutoutState('商品像素已锁定 · 已恢复', 'ready');
  } catch (error) {
    console.warn('[AI Ecommerce Studio] failed to restore cutout', error);
  }
}

async function clearImage() {
  state.imageFile = null;
  state.cutoutCanvas = null;
  state.product.sourceName = '';
  studioImageInput.value = '';
  studioPreview.src = '';
  studioPreview.hidden = true;
  studioRemoveImage.hidden = true;
  studioUploadEmpty.hidden = false;
  studioUpload.classList.remove('has-cutout');
  setCutoutState('');
  try { await idbPut('source', null); await idbPut('cutout', null); } catch { /* noop */ }
  persist();
  updateButtons();
}

function syncStateFromForm() {
  state.product.name = studioProductName.value.trim();
  state.product.brand = studioBrand.value.trim();
  state.product.category = studioCategory.value.trim();
  state.product.facts = studioFacts.value.trim();
  state.extra = studioExtra.value.trim();
  persist();
}

function syncFormFromState() {
  studioProductName.value = state.product.name;
  studioBrand.value = state.product.brand;
  studioCategory.value = state.product.category;
  studioFacts.value = state.product.facts;
  studioExtra.value = state.extra;
  document.querySelectorAll('[data-studio-workflow]').forEach((button) => button.classList.toggle('active', button.dataset.studioWorkflow === state.workflow));
  document.querySelectorAll('[data-studio-campaign]').forEach((button) => button.classList.toggle('active', button.dataset.studioCampaign === state.campaign));
  document.querySelectorAll('[data-studio-ratio]').forEach((button) => button.classList.toggle('active', button.dataset.studioRatio === state.ratio));
}

function buildTaskPrompt(template) {
  const campaignLock = CAMPAIGNS[state.campaign];
  const extra = state.extra ? `Additional approved direction: ${state.extra}.` : '';
  return `${campaignLock} Frame objective: ${template.objective}. Scene: ${template.scene} ${extra}`.trim().slice(0, 1050);
}

function buildPlan() {
  syncStateFromForm();
  if (!state.cutoutCanvas) return showToast('请先上传商品并等待商品像素锁定完成。');
  const workflow = WORKFLOWS[state.workflow];
  if (!workflow) return;
  state.plan = workflow.tasks.map((template, index) => ({
    id: `${Date.now()}-${index + 1}`,
    index: index + 1,
    title: template.title,
    objective: template.objective,
    prompt: buildTaskPrompt(template),
    placement: template.placement,
    aspectRatio: state.ratio,
    provider: 'minimax-background',
    status: 'planned',
    attempts: 0,
    qa: null,
    error: '',
  }));
  state.resultBlobs.clear();
  revokeResultUrls();
  persist();
  renderPlan();
  showToast(`已创建 ${state.plan.length} 个独立任务。可以先逐张检查 Prompt，再开始生成。`);
}

function normalizeImages(payload) {
  const raw = Array.isArray(payload) ? payload : Array.isArray(payload?.images) ? payload.images : Array.isArray(payload?.data?.image_urls) ? payload.data.image_urls : [];
  return raw.map((item) => typeof item === 'string' ? item : item?.url || '').filter(Boolean);
}

function errorFromResponse(response, data) {
  let message = '生成失败，请稍后重试。';
  let code = String(data?.error || 'generation_failed');
  if (response.status === 429 || code === 'rate_limited') message = '当前生成额度触发限流，请稍后再继续；已成功的任务不会丢失。';
  else if (code === 'minimax_api_key_missing') message = 'MiniMax API Key 尚未配置。';
  else if (code === 'minimax_api_key_invalid') message = 'MiniMax API Key 未通过鉴权。';
  else if (code === 'generation_timeout') message = '背景生成超时，请稍后重做这一张。';
  else if (code === 'generation_failed' && data?.providerMessage) message = `背景生成失败：${String(data.providerMessage).slice(0, 180)}`;
  const error = new Error(message);
  error.code = code;
  return error;
}

async function callBackgroundProvider(task) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ prompt: task.prompt, style: state.campaign, aspect_ratio: task.aspectRatio, count: 1 }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw errorFromResponse(response, data);
  const images = normalizeImages(data);
  if (!images.length) throw new Error('背景生成完成，但接口没有返回图片。');
  return { url: images[0], region: data?.region || '' };
}

async function loadBackground(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`背景加载失败（HTTP ${response.status}）。`);
  return blobToImage(await response.blob());
}

function drawCover(ctx, image, width, height) {
  const size = imageSize(image);
  const scale = Math.max(width / size.width, height / size.height);
  const drawWidth = size.width * scale;
  const drawHeight = size.height * scale;
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function composeProduct(background, productCanvas, task) {
  const size = imageSize(background);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  drawCover(ctx, background, canvas.width, canvas.height);

  const placement = task.placement || { x: .5, groundY: .86, height: .60, maxWidth: .62 };
  const productAspect = productCanvas.width / productCanvas.height;
  let drawHeight = canvas.height * placement.height;
  let drawWidth = drawHeight * productAspect;
  const maxWidth = canvas.width * placement.maxWidth;
  if (drawWidth > maxWidth) { drawWidth = maxWidth; drawHeight = drawWidth / productAspect; }
  const centerX = canvas.width * placement.x;
  const groundY = canvas.height * placement.groundY;
  const x = centerX - drawWidth / 2;
  const y = groundY - drawHeight;

  ctx.save();
  ctx.filter = `blur(${Math.max(7, Math.round(canvas.width * 0.013))}px)`;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(centerX, groundY + drawHeight * 0.012, drawWidth * 0.36, Math.max(6, drawHeight * 0.034), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.drawImage(productCanvas, x, y, drawWidth, drawHeight);

  const expectedRatio = ({ '1:1': 1, '4:3': 4 / 3, '16:9': 16 / 9, '9:16': 9 / 16 })[task.aspectRatio] || 1;
  const actualRatio = canvas.width / canvas.height;
  return {
    canvas,
    qa: {
      identityLocked: true,
      notClipped: x >= 0 && y >= 0 && x + drawWidth <= canvas.width && y + drawHeight <= canvas.height,
      ratioOk: Math.abs(actualRatio - expectedRatio) / expectedRatio < 0.08,
      hasProduct: drawWidth > 40 && drawHeight > 40,
    },
  };
}

function autoQaText(qa) {
  if (!qa) return '等待生成';
  const passed = qa.identityLocked && qa.notClipped && qa.ratioOk && qa.hasProduct;
  return passed
    ? '结构校验通过：原商品像素已锁定、主体未裁断、画幅正确。请人工确认光影和场景是否自然。'
    : '结构校验发现问题，建议重做这一张。';
}

function revokeResultUrls() {
  state.resultUrls.forEach((url) => URL.revokeObjectURL(url));
  state.resultUrls.clear();
}

async function restoreTaskBlobs() {
  state.resultBlobs.clear();
  for (const task of state.plan) {
    try {
      const blob = await idbGet(`task:${task.id}`);
      if (blob) state.resultBlobs.set(task.id, blob);
      else if (['review', 'approved'].includes(task.status)) task.status = 'planned';
    } catch { /* noop */ }
  }
  persist();
}

function statusLabel(status) {
  return ({ planned: '待生成', generating: '生成中', review: '待质检', approved: '已通过', failed: '失败' })[status] || '待生成';
}

function updateProgress() {
  const total = state.plan.length;
  const approved = state.plan.filter((task) => task.status === 'approved').length;
  const review = state.plan.filter((task) => task.status === 'review').length;
  const failed = state.plan.filter((task) => task.status === 'failed').length;
  studioProgressText.textContent = total ? `${approved}/${total} 已通过 · ${review} 待质检${failed ? ` · ${failed} 失败` : ''}` : '尚未创建任务';
  studioProgressBar.style.width = total ? `${Math.round((approved / total) * 100)}%` : '0%';
  studioPlanLabel.textContent = total ? `${WORKFLOWS[state.workflow].title} · ${total} 个任务` : '未创建计划';
}

function renderPlan() {
  revokeResultUrls();
  updateProgress();
  studioTaskList.innerHTML = '';
  studioEmptyPlan.hidden = state.plan.length > 0;
  studioTaskList.hidden = state.plan.length === 0;

  state.plan.forEach((task) => {
    const card = document.createElement('article');
    card.className = 'studio-task';
    card.dataset.status = task.status;

    const head = document.createElement('div');
    head.className = 'studio-task-head';
    head.innerHTML = `
      <span class="studio-task-index">${String(task.index).padStart(2, '0')}</span>
      <div class="studio-task-copy"><strong>${task.title}</strong><p>${task.objective}</p></div>
      <span class="studio-status ${task.status}">${statusLabel(task.status)}</span>`;

    const prompt = document.createElement('textarea');
    prompt.className = 'studio-task-prompt';
    prompt.value = task.prompt;
    prompt.maxLength = 1100;
    prompt.disabled = task.status === 'generating';
    prompt.addEventListener('change', () => { task.prompt = prompt.value.trim(); persist(); });

    const preview = document.createElement('div');
    preview.className = `studio-task-preview${task.status === 'generating' ? ' is-loading' : ''}`;
    const blob = state.resultBlobs.get(task.id);
    if (blob) {
      const url = URL.createObjectURL(blob);
      state.resultUrls.set(task.id, url);
      const image = document.createElement('img');
      image.src = url;
      image.alt = `${task.title} 结果`;
      preview.appendChild(image);
    } else {
      preview.innerHTML = `<span class="studio-preview-copy">${task.status === 'failed' ? task.error || '生成失败' : '生成后会在这里显示结果'}</span>`;
    }

    const actions = document.createElement('div');
    actions.className = 'studio-task-actions';
    const generate = document.createElement('button');
    generate.className = 'studio-task-button primary';
    generate.type = 'button';
    generate.textContent = task.status === 'failed' ? '重做这一张' : blob ? '重新生成' : '生成这一张';
    generate.disabled = state.running || task.status === 'generating';
    generate.addEventListener('click', () => void generateTask(task.id));
    actions.appendChild(generate);
    if (blob) {
      const download = document.createElement('button');
      download.className = 'studio-task-button';
      download.type = 'button';
      download.textContent = '下载';
      download.addEventListener('click', () => {
        const anchor = document.createElement('a');
        anchor.href = state.resultUrls.get(task.id);
        anchor.download = `smirel-${task.index}-${task.title}.png`;
        document.body.appendChild(anchor); anchor.click(); anchor.remove();
      });
      actions.appendChild(download);
    }

    const qa = document.createElement('div');
    qa.className = 'studio-qa-row';
    qa.innerHTML = `<div class="studio-qa-copy"><strong>QA</strong><p>${autoQaText(task.qa)}${task.attempts ? ` · 已生成 ${task.attempts} 次` : ''}</p></div>`;
    const qaActions = document.createElement('div');
    qaActions.className = 'studio-qa-actions';
    if (blob) {
      const pass = document.createElement('button');
      pass.className = 'studio-qa-button pass';
      pass.type = 'button';
      pass.textContent = task.status === 'approved' ? '已通过' : '通过';
      pass.disabled = state.running || task.status === 'approved';
      pass.addEventListener('click', () => { task.status = 'approved'; task.error = ''; persist(); renderPlan(); });
      const retry = document.createElement('button');
      retry.className = 'studio-qa-button retry';
      retry.type = 'button';
      retry.textContent = '不合格，重做';
      retry.disabled = state.running;
      retry.addEventListener('click', () => void generateTask(task.id));
      qaActions.append(pass, retry);
    }
    qa.appendChild(qaActions);

    card.append(head, prompt, preview, actions, qa);
    studioTaskList.appendChild(card);
  });
  updateButtons();
}

async function generateTask(taskId) {
  const task = state.plan.find((item) => item.id === taskId);
  if (!task || state.running) return { ok: false };
  if (!state.cutoutCanvas) { showToast('商品像素锁定数据不存在，请重新上传商品图。'); return { ok: false }; }
  if (!endpoint || !anonKey) { showToast('背景生成接口尚未配置。'); return { ok: false }; }
  task.prompt = String(task.prompt || '').trim();
  if (!task.prompt) { showToast('这张任务的 Prompt 不能为空。'); return { ok: false }; }

  state.running = true;
  task.status = 'generating';
  task.error = '';
  task.attempts = Number(task.attempts || 0) + 1;
  persist();
  renderPlan();

  try {
    const generated = await callBackgroundProvider(task);
    const background = await loadBackground(generated.url);
    let composed;
    try { composed = composeProduct(background, state.cutoutCanvas, task); }
    finally { if (typeof background.close === 'function') background.close(); }
    const blob = await canvasToBlob(composed.canvas);
    state.resultBlobs.set(task.id, blob);
    await idbPut(`task:${task.id}`, blob);
    task.qa = composed.qa;
    task.status = composed.qa.identityLocked && composed.qa.notClipped && composed.qa.ratioOk && composed.qa.hasProduct ? 'review' : 'failed';
    task.error = task.status === 'failed' ? '自动结构校验未通过' : '';
    persist();
    const region = regionLabel(generated.region);
    if (region) setServiceStatus(true, `电商工作台已连接 · ${region}`, `当前 Provider：MiniMax Background · ${region}。任务按独立 Task 执行，失败项可单独重做。`);
    showToast(task.status === 'review' ? `${task.title} 已完成，等待你做最终视觉质检。` : `${task.title} 完成，但结构校验未通过。`);
    return { ok: task.status === 'review' };
  } catch (error) {
    console.error('[AI Ecommerce Studio] task generation failed', error);
    task.status = 'failed';
    task.error = error instanceof Error ? error.message : '生成失败';
    persist();
    showToast(task.error);
    return { ok: false, stop: error?.code === 'rate_limited' };
  } finally {
    state.running = false;
    renderPlan();
  }
}

async function runAll() {
  if (state.running || !state.plan.length) return;
  syncStateFromForm();
  const pending = state.plan.filter((task) => ['planned', 'failed'].includes(task.status));
  if (!pending.length) return showToast('当前没有待生成任务。待质检图片请先选择“通过”或“重做”。');
  for (const task of pending) {
    const result = await generateTask(task.id);
    if (result?.stop) break;
  }
}

function updateButtons() {
  studioPlanButton.disabled = !state.cutoutCanvas || state.running;
  studioRunAll.disabled = !state.plan.length || state.running || !state.cutoutCanvas;
  studioRunAll.textContent = state.running ? '正在执行任务…' : '确认计划并生成待处理任务';
}

async function resetProject() {
  if (!window.confirm('清空当前商品档案、任务计划和本机保存的生成结果？')) return;
  const oldProject = state.projectId;
  revokeResultUrls();
  state.resultBlobs.clear();
  await idbDeleteProject(oldProject).catch(() => {});
  localStorage.removeItem(STORAGE_KEY);
  state.projectId = uuid();
  state.workflow = 'hero5';
  state.campaign = 'clean';
  state.ratio = '1:1';
  state.product = { name: '', brand: '', category: '', facts: '', sourceName: '' };
  state.extra = '';
  state.imageFile = null;
  state.cutoutCanvas = null;
  state.plan = [];
  studioImageInput.value = '';
  studioPreview.src = '';
  studioPreview.hidden = true;
  studioRemoveImage.hidden = true;
  studioUploadEmpty.hidden = false;
  studioUpload.classList.remove('has-cutout');
  setCutoutState('');
  syncFormFromState();
  persist();
  renderPlan();
  showToast('已创建新的电商图片项目。');
}

function bindOptions() {
  document.querySelectorAll('[data-studio-workflow]').forEach((button) => button.addEventListener('click', () => {
    state.workflow = button.dataset.studioWorkflow;
    syncFormFromState(); persist();
  }));
  document.querySelectorAll('[data-studio-campaign]').forEach((button) => button.addEventListener('click', () => {
    state.campaign = button.dataset.studioCampaign;
    syncFormFromState(); persist();
  }));
  document.querySelectorAll('[data-studio-ratio]').forEach((button) => button.addEventListener('click', () => {
    state.ratio = button.dataset.studioRatio;
    syncFormFromState(); persist();
  }));
  [studioProductName, studioBrand, studioCategory, studioFacts, studioExtra].forEach((input) => input.addEventListener('change', syncStateFromForm));
}

studioImageInput.addEventListener('change', () => void applyImageFile(studioImageInput.files?.[0]));
studioRemoveImage.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); void clearImage(); });
['dragenter', 'dragover'].forEach((type) => studioUpload.addEventListener(type, (event) => { event.preventDefault(); studioUpload.classList.add('is-dragover'); }));
['dragleave', 'drop'].forEach((type) => studioUpload.addEventListener(type, (event) => { event.preventDefault(); studioUpload.classList.remove('is-dragover'); }));
studioUpload.addEventListener('drop', (event) => void applyImageFile(event.dataTransfer?.files?.[0]));
studioPlanButton.addEventListener('click', buildPlan);
studioRunAll.addEventListener('click', () => void runAll());
studioReset.addEventListener('click', () => void resetProject());
window.addEventListener('beforeunload', revokeResultUrls);

async function init() {
  restoreMetadata();
  syncFormFromState();
  bindOptions();
  await restoreImageState();
  await restoreTaskBlobs();
  renderPlan();
  updateButtons();
  persist();
  void checkHealth();
}

void init();
