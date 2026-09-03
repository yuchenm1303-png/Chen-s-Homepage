const root = document.documentElement;
const smartEndpoint = (root.dataset.apiEndpoint || '').trim();
const backgroundEndpoint = (root.dataset.backgroundApiEndpoint || '').trim();
const anonKey = (root.dataset.supabaseAnonKey || '').trim();

const STORAGE_KEY = 'smirel-ai-ecommerce-studio-v2';
const LEGACY_STORAGE_KEY = 'smirel-ai-ecommerce-studio-v1';
const DB_NAME = 'smirel-ai-image-studio';
const DB_STORE = 'blobs';
const DB_VERSION = 1;

const WORKFLOWS = {
  hero5: {
    title: '商品主图套装',
    tasks: [
      { title: '纯净首图', objective: '干净聚焦的商品首图候选', scene: 'Pure #FFFFFF seamless commercial studio background, soft neutral studio illumination, extremely restrained scene, no distracting props, generous clean negative space.', placement: { x: .50, groundY: .86, height: .62, maxWidth: .64 } },
      { title: '高级棚拍', objective: '提升材质与品牌质感', scene: 'Premium light stone studio set, restrained warm-gray palette, soft directional window-like light from upper left, elegant catalog photography, uncluttered composition.', placement: { x: .50, groundY: .86, height: .60, maxWidth: .60 } },
      { title: '卖点留白', objective: '为标题或卖点文案预留空间', scene: 'Minimal premium advertising composition, believable tabletop, product emphasis on the left third, at least 45 percent clean negative space on the right for future copy, coherent soft light.', placement: { x: .34, groundY: .86, height: .56, maxWidth: .48 } },
      { title: '生活场景', objective: '展示真实使用语境', scene: 'Believable premium lifestyle environment with soft natural daylight, refined realistic materials, only a few contextual props, commercially usable photography, product remains the visual focus.', placement: { x: .53, groundY: .86, height: .57, maxWidth: .58 } },
      { title: '品牌氛围', objective: '形成更强品牌感的广告候选', scene: 'High-end campaign set with restrained neutral palette, elegant directional rim and key lighting, premium matte or stone surfaces, subtle depth, dramatic but believable commercial photography.', placement: { x: .50, groundY: .86, height: .58, maxWidth: .58 } },
    ],
  },
  lifestyle4: {
    title: '生活场景套装',
    tasks: [
      { title: '自然窗光', objective: '柔和日常感', scene: 'Bright believable interior near a large window, soft morning daylight, clean textured tabletop, restrained neutral decor, natural photographic depth.', placement: { x: .50, groundY: .86, height: .58, maxWidth: .60 } },
      { title: '现代家居', objective: '现代独立站氛围', scene: 'Modern premium home environment with soft neutral architecture, subtle warm accents, realistic natural light, clean support surface, uncluttered ecommerce lifestyle photography.', placement: { x: .54, groundY: .86, height: .56, maxWidth: .58 } },
      { title: '户外晨光', objective: '清新户外场景', scene: 'Natural outdoor commercial scene at soft early-morning light, believable stone or wood support surface, tasteful greenery, realistic atmospheric depth, calm premium photography.', placement: { x: .48, groundY: .87, height: .56, maxWidth: .58 } },
      { title: '轻奢空间', objective: '高级生活方式广告图', scene: 'Quiet luxury lifestyle set with refined stone, glass and soft fabric accents, sophisticated directional light, realistic premium interior, generous visual breathing room.', placement: { x: .50, groundY: .86, height: .57, maxWidth: .58 } },
    ],
  },
  social3: {
    title: '社媒广告套装',
    tasks: [
      { title: '信息流英雄图', objective: '快速抓住注意力', scene: 'Premium social advertising composition with strong but tasteful subject separation, clean modern environment, high visual clarity, generous safe space for optional copy.', placement: { x: .50, groundY: .87, height: .62, maxWidth: .66 } },
      { title: '偏置构图', objective: '提供明显不同的 A/B 构图', scene: 'Editorial ecommerce scene with the product emphasis on the right third, clean negative space on the left, realistic soft directional lighting, subtle premium props kept secondary.', placement: { x: .67, groundY: .86, height: .56, maxWidth: .48 } },
      { title: '近景质感', objective: '强化材质和高级感', scene: 'Tighter premium commercial composition, tactile realistic surface, soft controlled highlights and natural shadow falloff, modern advertising photography, uncluttered background.', placement: { x: .50, groundY: .90, height: .70, maxWidth: .72 } },
    ],
  },
  quick1: {
    title: '自定义单图',
    tasks: [
      { title: '自定义任务', objective: '按照全局补充要求完成一张电商图', scene: 'Create a polished, believable, commercially usable ecommerce product photograph following the approved additional direction, with coherent lighting and restrained composition.', placement: { x: .50, groundY: .86, height: .60, maxWidth: .62 } },
    ],
  },
};

const CAMPAIGNS = {
  clean: 'Campaign Style Lock: clean premium ecommerce visual system; neutral-cool commercial lighting; restrained off-white and soft gray environment; realistic materials; modern minimal composition; generous whitespace; no random decorative clutter; consistent photographic finish.',
  studio: 'Campaign Style Lock: professional catalog studio photography; controlled softbox lighting; neutral seamless or subtle gradient backgrounds; crisp material rendering; coherent natural contact shadows; consistent product scale and premium catalog finish.',
  luxury: 'Campaign Style Lock: quiet luxury ecommerce campaign; restrained premium materials; sophisticated directional light; elegant neutral-to-dark palette; subtle depth and highlights; no gaudy decoration; consistent high-end editorial finish.',
  lifestyle: 'Campaign Style Lock: believable premium lifestyle photography; natural soft daylight; realistic environments and restrained contextual props; calm neutral palette; consistent commercial realism; product remains the clear visual focus.',
};

const state = {
  projectId: '', workflow: 'hero5', campaign: 'clean', ratio: '1:1', protection: 'smart',
  product: { name: '', brand: '', category: '', facts: '', sourceName: '' },
  extra: '', sourceBlob: null, cutoutCanvas: null, strictPreparing: false, plan: [], serviceReady: false, running: false,
  resultBlobs: new Map(), resultUrls: new Map(), referenceDataUrl: '',
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
const studioProviderNote = $('#studioProviderNote');
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

function injectSmartUi() {
  const firstSection = studioUpload?.closest('.studio-section');
  if (!firstSection || $('#studioProtectionSection')) return;
  const note = firstSection.querySelector('.studio-section-head span');
  if (note) note.textContent = '直接上传即可，无需先抠图';
  const title = firstSection.querySelector('.studio-section-head strong');
  if (title) title.textContent = '商品参考图';
  if (studioPreview) studioPreview.alt = '商品参考图预览';
  const section = document.createElement('section');
  section.className = 'studio-section smart-protection-section';
  section.id = 'studioProtectionSection';
  section.innerHTML = `
    <div class="studio-section-head"><strong>商品一致性</strong><span id="studioProtectionHint">默认无需抠图</span></div>
    <div class="studio-option-grid smart-protection-grid">
      <button class="studio-option active" type="button" data-studio-protection="smart"><strong>智能一致性</strong><small>直接参考原图 · 推荐</small></button>
      <button class="studio-option" type="button" data-studio-protection="strict"><strong>严格一致性</strong><small>后台像素锁定 · 按需</small></button>
    </div>
    <p class="smart-protection-copy" id="studioProtectionCopy">普通商品默认直接智能编辑，不加载抠图模型；生成后通过逐图 QA 检查商品一致性。</p>`;
  firstSection.insertAdjacentElement('afterend', section);
}

function authHeaders(includeJson = false) {
  const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };
  if (includeJson) headers['Content-Type'] = 'application/json';
  return headers;
}

function showToast(message) {
  window.clearTimeout(toastTimer); toast.textContent = message; toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add('show'));
  toastTimer = window.setTimeout(() => { toast.classList.remove('show'); window.setTimeout(() => { toast.hidden = true; }, 220); }, 3400);
}

function setServiceStatus(ready, label, note) {
  state.serviceReady = ready; engineState.classList.toggle('is-offline', !ready); engineState.querySelector('span').textContent = label; engineNoteText.textContent = note;
}

function regionLabel(region) { if (region === 'cn') return '中国站'; if (region === 'global') return '国际站'; return ''; }

async function checkHealth() {
  if (!smartEndpoint || !anonKey) { setServiceStatus(false, '生成服务配置缺失', '智能编辑接口尚未配置。'); return false; }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(smartEndpoint, { method: 'GET', headers: authHeaders(false), cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.ready) {
        const region = regionLabel(data.region);
        setServiceStatus(true, region ? `电商工作台已连接 · ${region}` : '电商工作台已连接', `默认使用完整商品参考图智能生成；需要时可切换严格像素锁定${region ? ` · ${region}` : ''}。`);
        return true;
      }
      if (data?.error === 'minimax_api_key_missing') { setServiceStatus(false, 'MiniMax Key 待配置', '工作台已就绪，但生成 Provider 尚未配置 Key。'); return false; }
      if (data?.error === 'minimax_api_key_invalid') { setServiceStatus(false, 'MiniMax Key 无效', '生成 Provider 未通过鉴权。'); return false; }
    } catch (error) { console.warn('[AI Ecommerce Studio] health check failed', error); }
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 650));
  }
  setServiceStatus(false, '生成服务暂不可用', '商品档案和任务计划仍可编辑，在线生成暂时不可用。'); return false;
}

function openDb() {
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE); };
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function idbPut(name, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => { const tx = db.transaction(DB_STORE, 'readwrite'); tx.objectStore(DB_STORE).put(value, `${state.projectId}:${name}`); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
}

async function idbGet(name) {
  const db = await openDb();
  return new Promise((resolve, reject) => { const tx = db.transaction(DB_STORE, 'readonly'); const request = tx.objectStore(DB_STORE).get(`${state.projectId}:${name}`); request.onsuccess = () => resolve(request.result || null); request.onerror = () => reject(request.error); });
}

async function idbDeleteProject(projectId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite'); const store = tx.objectStore(DB_STORE); const request = store.getAllKeys();
    request.onsuccess = () => { const prefix = `${projectId}:`; request.result.filter((key) => String(key).startsWith(prefix)).forEach((key) => store.delete(key)); };
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
}

function serializableState() {
  return { version: 2, projectId: state.projectId, workflow: state.workflow, campaign: state.campaign, ratio: state.ratio, protection: state.protection, product: state.product, extra: state.extra, plan: state.plan.map((task) => ({ ...task, error: task.error || '' })) };
}
function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(serializableState())); }

function restoreMetadata() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || 'null'); } catch { saved = null; }
  state.projectId = String(saved?.projectId || uuid()); state.workflow = WORKFLOWS[saved?.workflow] ? saved.workflow : 'hero5'; state.campaign = CAMPAIGNS[saved?.campaign] ? saved.campaign : 'clean'; state.ratio = ['1:1', '4:3', '16:9', '9:16'].includes(saved?.ratio) ? saved.ratio : '1:1'; state.protection = saved?.protection === 'strict' ? 'strict' : 'smart';
  state.product = { name: String(saved?.product?.name || ''), brand: String(saved?.product?.brand || ''), category: String(saved?.product?.category || ''), facts: String(saved?.product?.facts || ''), sourceName: String(saved?.product?.sourceName || '') };
  state.extra = String(saved?.extra || ''); state.plan = Array.isArray(saved?.plan) ? saved.plan.map((task) => ({ ...task, protection: task.protection || state.protection })) : [];
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '')); reader.onerror = () => reject(reader.error || new Error('file_read_failed')); reader.readAsDataURL(blob); });
}
async function canvasToBlob(canvas) { return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('canvas_export_failed')), 'image/png', 0.96)); }
async function blobToImage(blob) {
  if ('createImageBitmap' in window) return createImageBitmap(blob);
  return new Promise((resolve, reject) => { const url = URL.createObjectURL(blob); const image = new Image(); image.onload = () => { URL.revokeObjectURL(url); resolve(image); }; image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image_decode_failed')); }; image.src = url; });
}
function imageSize(image) { return { width: image.width || image.naturalWidth, height: image.height || image.naturalHeight }; }
async function canvasFromBlob(blob) {
  const image = await blobToImage(blob);
  try { const size = imageSize(image); const canvas = document.createElement('canvas'); canvas.width = size.width; canvas.height = size.height; canvas.getContext('2d').drawImage(image, 0, 0); return canvas; }
  finally { if (typeof image.close === 'function') image.close(); }
}

async function loadTransformers() { if (!transformersModulePromise) transformersModulePromise = import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm'); return transformersModulePromise; }
async function loadSegmenter() {
  if (!segmenterPromise) segmenterPromise = (async () => {
    const { AutoModel, AutoProcessor, env } = await loadTransformers(); env.allowLocalModels = false;
    const [processor, model] = await Promise.all([AutoProcessor.from_pretrained('BritishWerewolf/U-2-Netp'), AutoModel.from_pretrained('BritishWerewolf/U-2-Netp', { dtype: 'fp32' })]); return { processor, model };
  })().catch((error) => { segmenterPromise = null; throw error; });
  return segmenterPromise;
}
function canvasFromRgba(rawImage) {
  const canvas = document.createElement('canvas'); canvas.width = rawImage.width; canvas.height = rawImage.height; const ctx = canvas.getContext('2d', { willReadFrequently: true }); const bytes = rawImage.data instanceof Uint8ClampedArray ? rawImage.data : new Uint8ClampedArray(rawImage.data); ctx.putImageData(new ImageData(bytes, rawImage.width, rawImage.height), 0, 0); return canvas;
}
function trimTransparentCanvas(source) {
  const ctx = source.getContext('2d', { willReadFrequently: true }); const { data } = ctx.getImageData(0, 0, source.width, source.height); let minX = source.width, minY = source.height, maxX = -1, maxY = -1;
  for (let y = 0; y < source.height; y += 1) for (let x = 0; x < source.width; x += 1) { const alpha = data[(y * source.width + x) * 4 + 3]; if (alpha > 12) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); } }
  if (maxX < minX || maxY < minY) throw new Error('empty_product_mask'); const boxWidth = maxX - minX + 1, boxHeight = maxY - minY + 1; const margin = Math.max(4, Math.round(Math.max(boxWidth, boxHeight) * .012)); const sx = Math.max(0, minX - margin), sy = Math.max(0, minY - margin); const sw = Math.min(source.width - sx, boxWidth + margin * 2), sh = Math.min(source.height - sy, boxHeight + margin * 2); const trimmed = document.createElement('canvas'); trimmed.width = sw; trimmed.height = sh; trimmed.getContext('2d').drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh); return trimmed;
}
async function createLockedProduct(blob) {
  const { RawImage } = await loadTransformers(); const source = await RawImage.fromBlob(blob);
  if (source.channels === 4) { let hasTransparency = false; for (let i = 3; i < source.data.length; i += 4) if (source.data[i] < 245) { hasTransparency = true; break; } if (hasTransparency) return trimTransparentCanvas(canvasFromRgba(source.clone().rgba())); }
  const { processor, model } = await loadSegmenter(); const processed = await processor(source); const output = await model({ input: processed.pixel_values }); const maskTensor = output.mask; if (!maskTensor?.data?.length) throw new Error('mask_generation_failed');
  const maskWidth = Number(maskTensor.dims?.[maskTensor.dims.length - 1] || 320), maskHeight = Number(maskTensor.dims?.[maskTensor.dims.length - 2] || 320); const maskBytes = maskTensor.data instanceof Uint8Array ? maskTensor.data : Uint8Array.from(maskTensor.data, (value) => Math.max(0, Math.min(255, Math.round(Number(value) * 255)))); let mask = new RawImage(maskBytes, maskWidth, maskHeight, 1); mask = await mask.resize(source.width, source.height, { resample: 2 }); const rgba = source.clone().rgba(); rgba.putAlpha(mask); return trimTransparentCanvas(canvasFromRgba(rgba));
}

function setProductState(text, kind = '') { studioCutoutState.textContent = text; studioCutoutState.className = `studio-cutout-state${kind ? ` ${kind}` : ''}`; studioCutoutState.hidden = !text; }
function updateProtectionUi() {
  document.querySelectorAll('[data-studio-protection]').forEach((button) => button.classList.toggle('active', button.dataset.studioProtection === state.protection)); const hint = $('#studioProtectionHint'); const copy = $('#studioProtectionCopy');
  if (state.protection === 'strict') {
    if (hint) hint.textContent = state.cutoutCanvas ? '严格锁定已准备' : '需要后台准备 Mask';
    if (copy) copy.textContent = state.cutoutCanvas ? '严格模式已准备：AI 只生成背景，最终使用真实商品像素合成。' : '严格模式会按需加载本地分割模型；如果识别失败会自动回退智能一致性，不会阻断任务。';
    if (studioProviderNote) studioProviderNote.textContent = '严格一致性：MiniMax 只生成背景，真实商品像素在本地合成。';
  } else {
    if (hint) hint.textContent = '默认无需抠图'; if (copy) copy.textContent = '普通商品默认直接智能编辑，不加载抠图模型；生成后通过逐图 QA 检查商品一致性。'; if (studioProviderNote) studioProviderNote.textContent = '智能一致性：直接使用完整商品参考图，不要求抠图；逐张生成后进行 QA。';
  }
}
async function ensureStrictCutout({ quiet = false } = {}) {
  if (state.cutoutCanvas) return true; if (!state.sourceBlob || state.strictPreparing) return false; state.strictPreparing = true; updateButtons(); setProductState('正在后台准备严格一致性…');
  try {
    const cutout = await createLockedProduct(state.sourceBlob); state.cutoutCanvas = cutout; const blob = await canvasToBlob(cutout); await idbPut('cutout', blob); studioUpload.classList.add('has-cutout'); setProductState('严格一致性已准备', 'ready'); updateProtectionUi(); persist(); if (!quiet) showToast('严格一致性已准备。后续将锁定真实商品像素。'); return true;
  } catch (error) {
    console.warn('[AI Ecommerce Studio] strict product lock unavailable', error); state.cutoutCanvas = null; state.protection = 'smart'; studioUpload.classList.remove('has-cutout'); await idbPut('cutout', null).catch(() => {}); setProductState('商品已准备 · 智能一致性', 'ready'); updateProtectionUi(); persist(); showToast('严格锁定未能完成，已自动回退智能一致性；仍可正常创建计划和生成。'); return false;
  } finally { state.strictPreparing = false; updateButtons(); }
}
async function selectProtection(mode) {
  if (!['smart', 'strict'].includes(mode) || state.running) return;
  if (mode === 'smart') { state.protection = 'smart'; studioUpload.classList.remove('has-cutout'); setProductState(state.sourceBlob ? '商品已准备 · 无需抠图' : ''); updateProtectionUi(); persist(); updateButtons(); return; }
  if (!state.sourceBlob) return showToast('请先上传商品参考图。'); state.protection = 'strict'; updateProtectionUi(); persist(); await ensureStrictCutout();
}
function autoNameFromFile(fileName) { return String(fileName || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim(); }
async function applyImageFile(file) {
  if (!file) return; const allowed = new Set(['image/png', 'image/jpeg', 'image/webp']); if (!allowed.has(file.type)) return showToast('请选择 PNG、JPG 或 WEBP 商品图。'); if (file.size > 8 * 1024 * 1024) return showToast('商品图请控制在 8 MB 以内。');
  state.sourceBlob = file; state.referenceDataUrl = ''; state.cutoutCanvas = null; state.product.sourceName = file.name; if (!state.product.name) state.product.name = autoNameFromFile(file.name); await Promise.all([idbPut('source', file), idbPut('cutout', null)]).catch(() => {});
  studioUploadEmpty.hidden = true; studioPreview.hidden = false; studioRemoveImage.hidden = false; studioUpload.classList.remove('has-cutout'); const previewUrl = URL.createObjectURL(file); studioPreview.src = previewUrl; studioPreview.onload = () => URL.revokeObjectURL(previewUrl); setProductState('商品已准备 · 无需抠图', 'ready'); syncFormFromState(); persist(); updateButtons(); updateProtectionUi();
  if (state.protection === 'strict') await ensureStrictCutout({ quiet: true }); else showToast('商品已准备完成。默认智能一致性不需要抠图，可以直接创建生成计划。');
}
async function restoreImageState() {
  try {
    const source = await idbGet('source'); if (source) { state.sourceBlob = source; studioUploadEmpty.hidden = true; studioPreview.hidden = false; studioRemoveImage.hidden = false; const url = URL.createObjectURL(source); studioPreview.src = url; studioPreview.onload = () => URL.revokeObjectURL(url); setProductState('商品已准备 · 已恢复', 'ready'); }
    const cutoutBlob = await idbGet('cutout'); if (cutoutBlob) state.cutoutCanvas = await canvasFromBlob(cutoutBlob); if (state.protection === 'strict' && state.cutoutCanvas) studioUpload.classList.add('has-cutout');
  } catch (error) { console.warn('[AI Ecommerce Studio] failed to restore product', error); }
}
async function clearImage() {
  state.sourceBlob = null; state.referenceDataUrl = ''; state.cutoutCanvas = null; state.product.sourceName = ''; studioImageInput.value = ''; studioPreview.src = ''; studioPreview.hidden = true; studioRemoveImage.hidden = true; studioUploadEmpty.hidden = false; studioUpload.classList.remove('has-cutout'); setProductState(''); await Promise.all([idbPut('source', null), idbPut('cutout', null)]).catch(() => {}); persist(); updateButtons(); updateProtectionUi();
}

function syncStateFromForm() { state.product.name = studioProductName.value.trim(); state.product.brand = studioBrand.value.trim(); state.product.category = studioCategory.value.trim(); state.product.facts = studioFacts.value.trim(); state.extra = studioExtra.value.trim(); persist(); }
function syncFormFromState() {
  studioProductName.value = state.product.name; studioBrand.value = state.product.brand; studioCategory.value = state.product.category; studioFacts.value = state.product.facts; studioExtra.value = state.extra;
  document.querySelectorAll('[data-studio-workflow]').forEach((button) => button.classList.toggle('active', button.dataset.studioWorkflow === state.workflow)); document.querySelectorAll('[data-studio-campaign]').forEach((button) => button.classList.toggle('active', button.dataset.studioCampaign === state.campaign)); document.querySelectorAll('[data-studio-ratio]').forEach((button) => button.classList.toggle('active', button.dataset.studioRatio === state.ratio)); updateProtectionUi();
}
function productContract() {
  const facts = []; if (state.product.name) facts.push(`Product: ${state.product.name}.`); if (state.product.brand) facts.push(`Brand: ${state.product.brand}.`); if (state.product.category) facts.push(`Category: ${state.product.category}.`); if (state.product.facts) facts.push(`Confirmed immutable facts: ${state.product.facts}.`);
  const identity = state.protection === 'strict' ? 'The real product pixels will be composited later. Generate the environment only and keep the product placement region visually clean.' : 'The uploaded product image is the authoritative identity reference. Preserve the same recognizable product, visible geometry, proportions, base colors, material character, logo/label placement and visible components. Do not redesign the product or invent hidden details.';
  return `${facts.join(' ')} ${identity}`.trim();
}
function buildTaskPrompt(template) { const extra = state.extra ? `Additional approved direction: ${state.extra}.` : ''; return `${CAMPAIGNS[state.campaign]} ${productContract()} Frame objective: ${template.objective}. Scene: ${template.scene} ${extra}`.trim().slice(0, 1080); }
function buildPlan() {
  syncStateFromForm(); if (!state.sourceBlob) return showToast('请先上传商品参考图。'); const workflow = WORKFLOWS[state.workflow];
  state.plan = workflow.tasks.map((template, index) => ({ id: `${Date.now()}-${index + 1}`, index: index + 1, title: template.title, objective: template.objective, prompt: buildTaskPrompt(template), placement: template.placement, aspectRatio: state.ratio, provider: state.protection === 'strict' ? 'minimax-background' : 'minimax-reference', protection: state.protection, status: 'planned', attempts: 0, qa: null, error: '' }));
  state.resultBlobs.clear(); revokeResultUrls(); persist(); renderPlan(); showToast(`已创建 ${state.plan.length} 个独立任务。默认不要求抠图，生成后逐张确认商品一致性。`);
}
function normalizeImages(payload) { const raw = Array.isArray(payload) ? payload : Array.isArray(payload?.images) ? payload.images : Array.isArray(payload?.data?.image_urls) ? payload.data.image_urls : []; return raw.map((item) => typeof item === 'string' ? item : item?.url || '').filter(Boolean); }
function errorFromResponse(response, data) {
  let message = '生成失败，请稍后重试。'; const code = String(data?.error || 'generation_failed');
  if (response.status === 429 || code === 'rate_limited') message = '当前生成额度触发限流，请稍后再继续；已成功任务不会丢失。'; else if (code === 'minimax_api_key_missing') message = 'MiniMax API Key 尚未配置。'; else if (code === 'minimax_api_key_invalid') message = 'MiniMax API Key 未通过鉴权。'; else if (code === 'generation_timeout') message = '生成超时，请稍后只重做这一张。'; else if (code === 'result_storage_failed') message = '图片已生成，但结果保存失败，请重做这一张。'; else if (code === 'generation_failed' && data?.providerMessage) message = `生成失败：${String(data.providerMessage).slice(0, 180)}`;
  const error = new Error(message); error.code = code; return error;
}
async function referenceDataUrl() { if (!state.referenceDataUrl) state.referenceDataUrl = await blobToDataUrl(state.sourceBlob); return state.referenceDataUrl; }
async function callSmartProvider(task) {
  const response = await fetch(smartEndpoint, { method: 'POST', headers: authHeaders(true), body: JSON.stringify({ prompt: task.prompt, style: state.campaign, aspect_ratio: task.aspectRatio, count: 1, reference_image: await referenceDataUrl() }) }); const data = await response.json().catch(() => ({})); if (!response.ok) throw errorFromResponse(response, data); const images = normalizeImages(data); if (!images.length) throw new Error('生成完成，但接口没有返回图片。'); return { url: images[0], region: data?.region || '' };
}
async function callBackgroundProvider(task) {
  const response = await fetch(backgroundEndpoint, { method: 'POST', headers: authHeaders(true), body: JSON.stringify({ prompt: task.prompt, style: state.campaign, aspect_ratio: task.aspectRatio, count: 1 }) }); const data = await response.json().catch(() => ({})); if (!response.ok) throw errorFromResponse(response, data); const images = normalizeImages(data); if (!images.length) throw new Error('背景生成完成，但接口没有返回图片。'); return { url: images[0], region: data?.region || '' };
}
async function fetchImageBlob(url) { const response = await fetch(url, { cache: 'no-store' }); if (!response.ok) throw new Error(`图片加载失败（HTTP ${response.status}）。`); return response.blob(); }
function expectedRatio(ratio) { return ({ '1:1': 1, '4:3': 4 / 3, '16:9': 16 / 9, '9:16': 9 / 16 })[ratio] || 1; }
async function inspectGeneratedBlob(blob, task, protection) {
  const image = await blobToImage(blob); try { const size = imageSize(image); const ratioOk = Math.abs((size.width / size.height) - expectedRatio(task.aspectRatio)) / expectedRatio(task.aspectRatio) < .08; return { validImage: size.width > 200 && size.height > 200, ratioOk, identityLocked: protection === 'strict', referenceUsed: protection === 'smart' }; } finally { if (typeof image.close === 'function') image.close(); }
}
function drawCover(ctx, image, width, height) { const size = imageSize(image), scale = Math.max(width / size.width, height / size.height), drawWidth = size.width * scale, drawHeight = size.height * scale; ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight); }
function composeProduct(background, productCanvas, task) {
  const size = imageSize(background), canvas = document.createElement('canvas'); canvas.width = size.width; canvas.height = size.height; const ctx = canvas.getContext('2d'); drawCover(ctx, background, canvas.width, canvas.height);
  const placement = task.placement || { x: .5, groundY: .86, height: .60, maxWidth: .62 }, productAspect = productCanvas.width / productCanvas.height; let drawHeight = canvas.height * placement.height, drawWidth = drawHeight * productAspect; const maxWidth = canvas.width * placement.maxWidth; if (drawWidth > maxWidth) { drawWidth = maxWidth; drawHeight = drawWidth / productAspect; } const centerX = canvas.width * placement.x, groundY = canvas.height * placement.groundY, x = centerX - drawWidth / 2, y = groundY - drawHeight;
  ctx.save(); ctx.filter = `blur(${Math.max(7, Math.round(canvas.width * .013))}px)`; ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(centerX, groundY + drawHeight * .012, drawWidth * .36, Math.max(6, drawHeight * .034), 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); ctx.drawImage(productCanvas, x, y, drawWidth, drawHeight);
  return { canvas, qa: { validImage: true, ratioOk: Math.abs((canvas.width / canvas.height) - expectedRatio(task.aspectRatio)) / expectedRatio(task.aspectRatio) < .08, identityLocked: true, referenceUsed: true, notClipped: x >= 0 && y >= 0 && x + drawWidth <= canvas.width && y + drawHeight <= canvas.height } };
}
function autoQaText(task) {
  const qa = task.qa; if (!qa) return '等待生成';
  if (task.protection === 'strict') { const passed = qa.validImage && qa.ratioOk && qa.identityLocked && qa.notClipped !== false; return passed ? '基础校验通过：真实商品像素已锁定、图片可用、画幅正确。请人工确认抠图边缘、光影和场景是否自然。' : '基础校验发现问题，建议重做这一张。'; }
  const passed = qa.validImage && qa.ratioOk && qa.referenceUsed; return passed ? '基础校验通过：完整商品参考图已参与生成、图片可用、画幅正确。请人工重点确认 Logo、颜色、结构和文字是否保持一致。' : '基础校验发现问题，建议重做这一张。';
}
function revokeResultUrls() { state.resultUrls.forEach((url) => URL.revokeObjectURL(url)); state.resultUrls.clear(); }
async function restoreTaskBlobs() {
  state.resultBlobs.clear(); for (const task of state.plan) { try { const blob = await idbGet(`task:${task.id}`); if (blob) state.resultBlobs.set(task.id, blob); else if (['review', 'approved'].includes(task.status)) task.status = 'planned'; } catch { /* noop */ } } persist();
}
function statusLabel(status) { return ({ planned: '待生成', generating: '生成中', review: '待质检', approved: '已通过', failed: '失败' })[status] || '待生成'; }
function updateProgress() {
  const total = state.plan.length, approved = state.plan.filter((task) => task.status === 'approved').length, review = state.plan.filter((task) => task.status === 'review').length, failed = state.plan.filter((task) => task.status === 'failed').length; studioProgressText.textContent = total ? `${approved}/${total} 已通过 · ${review} 待质检${failed ? ` · ${failed} 失败` : ''}` : '尚未创建任务'; studioProgressBar.style.width = total ? `${Math.round((approved / total) * 100)}%` : '0%'; studioPlanLabel.textContent = total ? `${WORKFLOWS[state.workflow].title} · ${total} 个任务` : '未创建计划';
}
function renderPlan() {
  revokeResultUrls(); updateProgress(); studioTaskList.innerHTML = ''; studioEmptyPlan.hidden = state.plan.length > 0; studioTaskList.hidden = state.plan.length === 0;
  state.plan.forEach((task) => {
    const card = document.createElement('article'); card.className = 'studio-task'; card.dataset.status = task.status; const head = document.createElement('div'); head.className = 'studio-task-head'; const strategy = task.protection === 'strict' ? '严格像素锁定' : '智能参考图'; head.innerHTML = `<span class="studio-task-index">${String(task.index).padStart(2, '0')}</span><div class="studio-task-copy"><strong>${task.title}</strong><p>${task.objective} · ${strategy}</p></div><span class="studio-status ${task.status}">${statusLabel(task.status)}</span>`;
    const prompt = document.createElement('textarea'); prompt.className = 'studio-task-prompt'; prompt.value = task.prompt; prompt.maxLength = 1100; prompt.disabled = task.status === 'generating'; prompt.addEventListener('change', () => { task.prompt = prompt.value.trim(); persist(); });
    const preview = document.createElement('div'); preview.className = `studio-task-preview${task.status === 'generating' ? ' is-loading' : ''}`; const blob = state.resultBlobs.get(task.id);
    if (blob) { const url = URL.createObjectURL(blob); state.resultUrls.set(task.id, url); const image = document.createElement('img'); image.src = url; image.alt = `${task.title} 结果`; preview.appendChild(image); } else preview.innerHTML = `<span class="studio-preview-copy">${task.status === 'failed' ? task.error || '生成失败' : '生成后会在这里显示结果'}</span>`;
    const actions = document.createElement('div'); actions.className = 'studio-task-actions'; const generate = document.createElement('button'); generate.className = 'studio-task-button primary'; generate.type = 'button'; generate.textContent = task.status === 'failed' ? '重做这一张' : blob ? '重新生成' : '生成这一张'; generate.disabled = state.running || task.status === 'generating'; generate.addEventListener('click', () => void generateTask(task.id)); actions.appendChild(generate);
    if (blob) { const download = document.createElement('button'); download.className = 'studio-task-button'; download.type = 'button'; download.textContent = '下载'; download.addEventListener('click', () => { const anchor = document.createElement('a'); anchor.href = state.resultUrls.get(task.id); anchor.download = `smirel-${task.index}-${task.title}.png`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); }); actions.appendChild(download); }
    const qa = document.createElement('div'); qa.className = 'studio-qa-row'; qa.innerHTML = `<div class="studio-qa-copy"><strong>QA</strong><p>${autoQaText(task)}${task.attempts ? ` · 已生成 ${task.attempts} 次` : ''}</p></div>`; const qaActions = document.createElement('div'); qaActions.className = 'studio-qa-actions';
    if (blob) { const pass = document.createElement('button'); pass.className = 'studio-qa-button pass'; pass.type = 'button'; pass.textContent = task.status === 'approved' ? '已通过' : '通过'; pass.disabled = state.running || task.status === 'approved'; pass.addEventListener('click', () => { task.status = 'approved'; task.error = ''; persist(); renderPlan(); }); const retry = document.createElement('button'); retry.className = 'studio-qa-button retry'; retry.type = 'button'; retry.textContent = '不合格，重做'; retry.disabled = state.running; retry.addEventListener('click', () => void generateTask(task.id)); qaActions.append(pass, retry); }
    qa.appendChild(qaActions); card.append(head, prompt, preview, actions, qa); studioTaskList.appendChild(card);
  }); updateButtons();
}
async function generateTask(taskId) {
  const task = state.plan.find((item) => item.id === taskId); if (!task || state.running) return { ok: false }; if (!state.sourceBlob) { showToast('商品参考图不存在，请重新上传。'); return { ok: false }; } task.prompt = String(task.prompt || '').trim(); if (!task.prompt) { showToast('这张任务的 Prompt 不能为空。'); return { ok: false }; }
  const requestedProtection = task.protection || state.protection;
  if (requestedProtection === 'strict' && !state.cutoutCanvas) { state.protection = 'strict'; updateProtectionUi(); const prepared = await ensureStrictCutout(); if (!prepared) { task.protection = 'smart'; task.provider = 'minimax-reference'; task.prompt = `${CAMPAIGNS[state.campaign]} The uploaded product image is the authoritative identity reference. Preserve the same recognizable product, visible geometry, proportions, colors, material character, logo/label placement and visible components. Frame objective: ${task.objective}. ${task.prompt}`.slice(0, 1080); } }
  state.running = true; task.status = 'generating'; task.error = ''; task.attempts = Number(task.attempts || 0) + 1; persist(); renderPlan();
  try {
    let blob, qa, region = '';
    if (task.protection === 'strict' && state.cutoutCanvas) {
      if (!backgroundEndpoint) throw new Error('严格一致性背景接口尚未配置。'); const generated = await callBackgroundProvider(task); region = generated.region; const backgroundBlob = await fetchImageBlob(generated.url); const background = await blobToImage(backgroundBlob); try { const composed = composeProduct(background, state.cutoutCanvas, task); blob = await canvasToBlob(composed.canvas); qa = composed.qa; } finally { if (typeof background.close === 'function') background.close(); }
    } else {
      if (!smartEndpoint) throw new Error('智能编辑接口尚未配置。'); const generated = await callSmartProvider(task); region = generated.region; blob = await fetchImageBlob(generated.url); qa = await inspectGeneratedBlob(blob, task, 'smart');
    }
    state.resultBlobs.set(task.id, blob); await idbPut(`task:${task.id}`, blob); task.qa = qa; const passed = qa.validImage && qa.ratioOk && (task.protection === 'strict' ? qa.identityLocked && qa.notClipped !== false : qa.referenceUsed); task.status = passed ? 'review' : 'failed'; task.error = passed ? '' : '自动基础校验未通过'; persist(); const regionName = regionLabel(region); if (regionName) setServiceStatus(true, `电商工作台已连接 · ${regionName}`, task.protection === 'strict' ? `当前任务使用严格像素锁定 · ${regionName}。` : `当前任务使用完整商品参考图智能生成 · ${regionName}。`); showToast(task.status === 'review' ? `${task.title} 已完成，请确认商品一致性和最终视觉。` : `${task.title} 完成，但基础校验未通过。`); return { ok: task.status === 'review' };
  } catch (error) { console.error('[AI Ecommerce Studio] task generation failed', error); task.status = 'failed'; task.error = error instanceof Error ? error.message : '生成失败'; persist(); showToast(task.error); return { ok: false, stop: error?.code === 'rate_limited' }; }
  finally { state.running = false; renderPlan(); }
}
async function runAll() {
  if (state.running || !state.plan.length) return; syncStateFromForm(); const pending = state.plan.filter((task) => ['planned', 'failed'].includes(task.status)); if (!pending.length) return showToast('当前没有待生成任务。待质检图片请先选择“通过”或“重做”。'); for (const task of pending) { const result = await generateTask(task.id); if (result?.stop) break; }
}
function updateButtons() {
  studioPlanButton.disabled = !state.sourceBlob || state.running || state.strictPreparing; studioRunAll.disabled = !state.plan.length || state.running || !state.sourceBlob || state.strictPreparing; studioRunAll.textContent = state.running ? '正在执行任务…' : state.strictPreparing ? '正在准备严格一致性…' : '确认计划并生成待处理任务';
}
async function resetProject() {
  if (!window.confirm('清空当前商品档案、任务计划和本机保存的生成结果？')) return; const oldProject = state.projectId; revokeResultUrls(); state.resultBlobs.clear(); await idbDeleteProject(oldProject).catch(() => {}); localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(LEGACY_STORAGE_KEY); state.projectId = uuid(); state.workflow = 'hero5'; state.campaign = 'clean'; state.ratio = '1:1'; state.protection = 'smart'; state.product = { name: '', brand: '', category: '', facts: '', sourceName: '' }; state.extra = ''; state.sourceBlob = null; state.referenceDataUrl = ''; state.cutoutCanvas = null; state.plan = []; studioImageInput.value = ''; studioPreview.src = ''; studioPreview.hidden = true; studioRemoveImage.hidden = true; studioUploadEmpty.hidden = false; studioUpload.classList.remove('has-cutout'); setProductState(''); syncFormFromState(); persist(); renderPlan(); showToast('已创建新的电商图片项目。');
}
function bindOptions() {
  document.querySelectorAll('[data-studio-workflow]').forEach((button) => button.addEventListener('click', () => { state.workflow = button.dataset.studioWorkflow; syncFormFromState(); persist(); })); document.querySelectorAll('[data-studio-campaign]').forEach((button) => button.addEventListener('click', () => { state.campaign = button.dataset.studioCampaign; syncFormFromState(); persist(); })); document.querySelectorAll('[data-studio-ratio]').forEach((button) => button.addEventListener('click', () => { state.ratio = button.dataset.studioRatio; syncFormFromState(); persist(); })); document.querySelectorAll('[data-studio-protection]').forEach((button) => button.addEventListener('click', () => void selectProtection(button.dataset.studioProtection))); [studioProductName, studioBrand, studioCategory, studioFacts, studioExtra].forEach((input) => input.addEventListener('change', syncStateFromForm));
}
studioImageInput.addEventListener('change', () => void applyImageFile(studioImageInput.files?.[0])); studioRemoveImage.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); void clearImage(); }); ['dragenter', 'dragover'].forEach((type) => studioUpload.addEventListener(type, (event) => { event.preventDefault(); studioUpload.classList.add('is-dragover'); })); ['dragleave', 'drop'].forEach((type) => studioUpload.addEventListener(type, (event) => { event.preventDefault(); studioUpload.classList.remove('is-dragover'); })); studioUpload.addEventListener('drop', (event) => void applyImageFile(event.dataTransfer?.files?.[0])); studioPlanButton.addEventListener('click', buildPlan); studioRunAll.addEventListener('click', () => void runAll()); studioReset.addEventListener('click', () => void resetProject()); window.addEventListener('beforeunload', revokeResultUrls);
async function init() {
  injectSmartUi(); restoreMetadata(); syncFormFromState(); bindOptions(); await restoreImageState(); await restoreTaskBlobs(); if (state.protection === 'strict' && state.sourceBlob && !state.cutoutCanvas) { state.protection = 'smart'; setProductState('商品已准备 · 智能一致性', 'ready'); } updateProtectionUi(); renderPlan(); updateButtons(); persist(); void checkHealth();
}
void init();