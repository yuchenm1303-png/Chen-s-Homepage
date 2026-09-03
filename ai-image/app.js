(() => {
  const root = document.documentElement;
  const endpoint = (root.dataset.apiEndpoint || '').trim();
  const anonKey = (root.dataset.supabaseAnonKey || '').trim();

  const state = {
    style: 'clean',
    ratio: '1:1',
    count: 1,
    imageFile: null,
    imageDataUrl: '',
    serviceReady: false,
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
      setServiceStatus(false, '生成服务配置缺失', '网页尚未配置生成接口。');
      return false;
    }

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
          region ? `MiniMax 已连接 · ${region}` : 'MiniMax 已连接',
          region
            ? `MiniMax Image-01 已通过${region}鉴权，可直接提交商品图生成任务。`
            : 'MiniMax Image-01 在线，可直接提交商品图生成任务。',
        );
        return true;
      }

      if (data?.error === 'minimax_api_key_missing') {
        setServiceStatus(false, 'MiniMax Key 待配置', '生成后端已经部署，MiniMax API Key 尚未写入服务端。');
        return false;
      }

      if (data?.error === 'minimax_api_key_invalid') {
        setServiceStatus(false, 'MiniMax Key 无效', '后端已同时检查 MiniMax 国际站与中国站，这枚 Key 当前未通过鉴权。');
        return false;
      }

      setServiceStatus(false, '生成服务异常', '生成服务已部署，但当前健康检查未通过。');
      return false;
    } catch (error) {
      console.error('[AI Image Studio] health check failed', error);
      setServiceStatus(false, '生成服务不可用', '暂时无法连接生成服务，请稍后刷新页面。');
      return false;
    }
  }

  function updateHint() {
    generateHint.textContent = `准备生成 ${state.count} 张 · ${state.ratio}`;
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
      slot.innerHTML = `<span>${String(index + 1).padStart(2, '0')}</span><p>MiniMax 正在生成…</p>`;
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
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.results)
              ? payload.results
              : [];

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
    const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
    if (!allowedTypes.has(file.type)) {
      showToast('请选择 PNG、JPG 或 WEBP 图片。');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast('参考图请控制在 8 MB 以内。');
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

  function errorMessage(response, data) {
    if (response.status === 429 || data?.error === 'rate_limited') {
      return '生成太频繁了，请稍后再试。';
    }
    if (data?.error === 'minimax_api_key_missing') {
      return 'MiniMax API Key 尚未配置到生成后端。';
    }
    if (data?.error === 'minimax_api_key_invalid') {
      return 'MiniMax API Key 未通过鉴权；后端已同时检查国际站和中国站。';
    }
    if (data?.error === 'generation_timeout') {
      return '本次生成超时，请稍后重试。';
    }
    if (data?.error === 'reference_image_too_large') {
      return '参考图超过 8 MB，请换一张较小的图片。';
    }
    if (data?.error === 'generation_failed') {
      const detail = String(data?.providerMessage || '').trim();
      return detail ? `MiniMax 生成失败：${detail}` : 'MiniMax 生成失败，请稍后重试。';
    }
    if (response.status === 401) return '生成接口认证失败，请刷新页面后重试。';
    if (response.status === 503) return '生成服务暂不可用，请稍后重试。';
    return '生成失败，请稍后重试。';
  }

  async function generate() {
    const prompt = promptInput.value.trim();
    if (!prompt) {
      promptInput.focus();
      showToast('先写一下商品或场景描述。');
      return;
    }

    if (!endpoint || !anonKey) {
      renderEmptySlots('生成服务配置缺失');
      showToast('生成接口尚未配置。');
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
        headers: authHeaders(true),
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(errorMessage(response, data));
      }

      const images = normalizeImages(data);
      renderResults(images);
      if (!images.length) throw new Error('生成完成，但接口没有返回图片。');
      const region = regionLabel(data?.region);
      setServiceStatus(
        true,
        region ? `MiniMax 已连接 · ${region}` : 'MiniMax 已连接',
        region ? `MiniMax Image-01 已通过${region}鉴权。` : 'MiniMax Image-01 在线，可直接提交商品图生成任务。',
      );
      showToast(`已生成 ${images.length} 张图片。`);
    } catch (error) {
      console.error('[AI Image Studio] generation failed', error);
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

  renderEmptySlots();
  updateHint();
  void checkHealth();
})();
