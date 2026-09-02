(() => {
  const root = document.documentElement;
  const endpoint = (root.dataset.apiEndpoint || '').trim();

  const state = {
    style: 'clean',
    ratio: '1:1',
    count: 1,
    imageFile: null,
    imageDataUrl: '',
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

  function showToast(message) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add('show'));
    toastTimer = window.setTimeout(() => {
      toast.classList.remove('show');
      window.setTimeout(() => { toast.hidden = true; }, 220);
    }, 2800);
  }

  function setEngineState() {
    if (endpoint) {
      engineState.classList.remove('is-offline');
      engineState.querySelector('span').textContent = '生成服务已连接';
      engineNoteText.textContent = '已配置在线生成接口，可直接提交商品图生成任务。';
      return;
    }
    engineState.classList.add('is-offline');
    engineState.querySelector('span').textContent = '生成服务待接入';
    engineNoteText.textContent = '网站前端已部署；接入 GPU/Fooocus 后端后即可直接在线生成。';
  }

  function updateHint() {
    generateHint.textContent = `准备生成 ${state.count} 张 · ${state.ratio}`;
  }

  function setupChoiceGroup(selector, key, parser = (v) => v) {
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
    resultGrid.dataset.count = String(state.count);
    resultGrid.innerHTML = '';
    for (let index = 0; index < state.count; index += 1) {
      const slot = document.createElement('div');
      slot.className = 'result-slot empty';
      slot.innerHTML = `<span>${String(index + 1).padStart(2, '0')}</span><p>${message}</p>`;
      resultGrid.appendChild(slot);
    }
  }

  function renderLoadingSlots() {
    resultGrid.dataset.count = String(state.count);
    resultGrid.innerHTML = '';
    for (let index = 0; index < state.count; index += 1) {
      const slot = document.createElement('div');
      slot.className = 'result-slot empty loading';
      slot.innerHTML = `<span>${String(index + 1).padStart(2, '0')}</span><p>正在生成…</p>`;
      resultGrid.appendChild(slot);
    }
  }

  function normalizeImages(payload) {
    const raw = Array.isArray(payload) ? payload : (payload?.images || payload?.data || payload?.results || []);
    return raw.map((item) => {
      if (typeof item === 'string') return item;
      return item?.url || item?.image || item?.data_url || item?.dataUrl || '';
    }).filter(Boolean);
  }

  function renderResults(images) {
    if (!images.length) {
      renderEmptySlots('接口未返回图片');
      return;
    }
    resultGrid.dataset.count = String(Math.min(images.length, 4));
    resultGrid.innerHTML = '';
    images.slice(0, 4).forEach((src, index) => {
      const slot = document.createElement('div');
      slot.className = 'result-slot';

      const image = document.createElement('img');
      image.src = src;
      image.alt = `生成商品图 ${index + 1}`;
      image.loading = 'lazy';

      const button = document.createElement('button');
      button.className = 'download-result';
      button.type = 'button';
      button.textContent = '下载';
      button.addEventListener('click', () => {
        const anchor = document.createElement('a');
        anchor.href = src;
        anchor.download = `smirel-ai-product-${Date.now()}-${index + 1}.png`;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      });

      slot.append(image, button);
      resultGrid.appendChild(slot);
    });
  }

  function resetUpload() {
    state.imageFile = null;
    state.imageDataUrl = '';
    imageInput.value = '';
    uploadPreview.src = '';
    uploadPreview.hidden = true;
    removeImage.hidden = true;
    uploadEmpty.hidden = false;
  }

  function applyImageFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('请选择 PNG、JPG 或 WEBP 图片。');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('参考图请控制在 10 MB 以内。');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      state.imageFile = file;
      state.imageDataUrl = String(reader.result || '');
      uploadPreview.src = state.imageDataUrl;
      uploadPreview.hidden = false;
      removeImage.hidden = false;
      uploadEmpty.hidden = true;
    };
    reader.onerror = () => showToast('图片读取失败，请重新选择。');
    reader.readAsDataURL(file);
  }

  async function generate() {
    const prompt = promptInput.value.trim();
    if (!prompt) {
      promptInput.focus();
      showToast('先写一下商品或场景描述。');
      return;
    }

    if (!endpoint) {
      renderEmptySlots('等待接入生成后端');
      showToast('网站前端已经可用，下一步需要接入 Fooocus / GPU 生成后端。');
      return;
    }

    const payload = {
      prompt,
      style: state.style,
      aspect_ratio: state.ratio,
      count: state.count,
      reference_image: state.imageDataUrl || null,
    };

    generateButton.disabled = true;
    generateButton.querySelector('strong').textContent = '正在生成';
    generateButton.querySelector('.generate-arrow').textContent = '···';
    renderLoadingSlots();

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(detail || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const images = normalizeImages(data);
      renderResults(images);
      showToast(images.length ? `已生成 ${images.length} 张图片。` : '生成完成，但接口没有返回图片。');
    } catch (error) {
      console.error('[AI Image Studio] generation failed', error);
      renderEmptySlots('生成失败，请稍后重试');
      showToast('生成失败：请检查生成后端或网络状态。');
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

  imageInput.addEventListener('change', () => applyImageFile(imageInput.files?.[0]));
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
  uploadZone.addEventListener('drop', (event) => applyImageFile(event.dataTransfer?.files?.[0]));

  generateButton.addEventListener('click', generate);
  clearResults.addEventListener('click', () => renderEmptySlots());

  setEngineState();
  renderEmptySlots();
  updateHint();
})();
