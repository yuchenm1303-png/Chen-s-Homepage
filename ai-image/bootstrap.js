(() => {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode') === 'legacy' ? 'legacy' : 'lock';
  document.documentElement.dataset.imageMode = mode;

  document.querySelectorAll('[data-mode-link]').forEach((link) => {
    link.classList.toggle('active', link.dataset.modeLink === mode);
  });

  const noteTitle = document.querySelector('.engine-note strong');
  const heroCopy = document.querySelector('.hero-copy');
  const imageFieldTitle = document.querySelector('#imageFieldTitle');
  const imageFieldHint = document.querySelector('#imageFieldHint');
  const promptFieldTitle = document.querySelector('#promptFieldTitle');
  const promptInput = document.querySelector('#promptInput');

  if (mode === 'legacy') {
    if (noteTitle) noteTitle.textContent = 'MiniMax Image-01 · 旧版参考图';
    if (heroCopy) heroCopy.textContent = '旧版参考图模式：把商品图交给 MiniMax 重新生成，方便与商品锁定模式随时对比。';
    if (imageFieldTitle) imageFieldTitle.textContent = '商品参考图';
    if (imageFieldHint) imageFieldHint.textContent = '可选';
    if (promptFieldTitle) promptFieldTitle.textContent = '商品与场景描述';
    if (promptInput) promptInput.placeholder = '例如：白色香水瓶，放在浅灰色石材台面上，柔和侧光，高级商业摄影，干净背景';
  } else {
    if (noteTitle) noteTitle.textContent = '商品锁定 · MiniMax Background';
    if (heroCopy) heroCopy.textContent = '上传真实商品图，本地自动抠出并锁定商品像素；AI 只生成背景，再自动合成商业场景图。';
    if (imageFieldTitle) imageFieldTitle.textContent = '商品原图';
    if (imageFieldHint) imageFieldHint.textContent = '商品锁定模式必选';
    if (promptFieldTitle) promptFieldTitle.textContent = '场景描述';
  }

  const script = document.createElement('script');
  if (mode === 'legacy') {
    script.src = './app.js?v=20260903-legacy-1';
  } else {
    script.type = 'module';
    script.src = './product-lock.js?v=20260903-lock-1';
  }
  document.body.appendChild(script);
})();
