(() => {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('mode');
  const mode = ['studio', 'lock', 'legacy'].includes(requested) ? requested : 'studio';
  document.documentElement.dataset.imageMode = mode;

  document.querySelectorAll('[data-mode-link]').forEach((link) => {
    link.classList.toggle('active', link.dataset.modeLink === mode);
  });

  const noteTitle = document.querySelector('.engine-note strong');
  const eyebrow = document.querySelector('.eyebrow');
  const heroTitle = document.querySelector('.hero h1');
  const heroCopy = document.querySelector('.hero-copy');
  const heroChips = [...document.querySelectorAll('.hero-chips span')];
  const imageFieldTitle = document.querySelector('#imageFieldTitle');
  const imageFieldHint = document.querySelector('#imageFieldHint');
  const promptFieldTitle = document.querySelector('#promptFieldTitle');
  const promptInput = document.querySelector('#promptInput');
  const featureCards = [...document.querySelectorAll('.feature-card')];

  const setChip = (index, text) => { if (heroChips[index]) heroChips[index].textContent = text; };
  const setFeature = (index, title, copy) => {
    const card = featureCards[index];
    if (!card) return;
    const strong = card.querySelector('strong');
    const paragraph = card.querySelector('p');
    if (strong) strong.textContent = title;
    if (paragraph) paragraph.textContent = copy;
  };

  if (mode === 'legacy') {
    document.title = '旧版 AI 图生图 · Smirel';
    if (eyebrow) eyebrow.textContent = 'LEGACY IMAGE-TO-IMAGE';
    if (heroTitle) heroTitle.textContent = '旧版 AI 图生图';
    if (noteTitle) noteTitle.textContent = 'MiniMax Image-01 · 旧版参考图';
    if (heroCopy) heroCopy.textContent = '把商品参考图交给 MiniMax 重新生成，方便与商品锁定和电商工作台随时对比。';
    if (imageFieldTitle) imageFieldTitle.textContent = '商品参考图';
    if (imageFieldHint) imageFieldHint.textContent = '可选';
    if (promptFieldTitle) promptFieldTitle.textContent = '商品与场景描述';
    if (promptInput) promptInput.placeholder = '例如：白色香水瓶，放在浅灰色石材台面上，柔和侧光，高级商业摄影，干净背景';
    setChip(0, '参考图重绘'); setChip(1, 'MiniMax'); setChip(2, '旧版保留');
    setFeature(0, '参考图生成', '把图片作为 MiniMax 的视觉参考，适合需要 AI 重新设计或重绘主体的场景。');
    setFeature(1, '快速试风格', '直接输入商品与场景描述，快速比较不同风格和比例。');
    setFeature(2, '与新版并存', '旧链路没有删除，需要时可以随时切回进行效果对比。');
  } else if (mode === 'lock') {
    document.title = 'AI 商品锁定 · Smirel';
    if (eyebrow) eyebrow.textContent = 'PRODUCT PIXEL LOCK';
    if (heroTitle) heroTitle.textContent = 'AI 商品锁定';
    if (noteTitle) noteTitle.textContent = '商品锁定 · MiniMax Background';
    if (heroCopy) heroCopy.textContent = '上传真实商品图，本地自动抠出并锁定商品像素；AI 只生成背景，再自动合成商业场景图。';
    if (imageFieldTitle) imageFieldTitle.textContent = '商品原图';
    if (imageFieldHint) imageFieldHint.textContent = '商品锁定模式必选';
    if (promptFieldTitle) promptFieldTitle.textContent = '场景描述';
    setChip(0, '商品锁定'); setChip(1, 'AI 场景'); setChip(2, '多尺寸');
    setFeature(0, '锁定真实商品', '商品在浏览器本地抠图，生成时不交给 AI 重新绘制。');
    setFeature(1, 'AI 只做场景', 'MiniMax 生成留有商品摆放区域的背景，再与真实商品自动合成。');
    setFeature(2, '旧版随时保留', '需要对比时可一键切换回原来的 MiniMax 参考图重绘流程。');
  } else {
    document.title = 'AI 电商视觉工作台 · Smirel';
    if (eyebrow) eyebrow.textContent = 'AI ECOMMERCE VISUAL WORKSPACE';
    if (heroTitle) heroTitle.textContent = 'AI 电商视觉工作台';
    if (heroCopy) heroCopy.textContent = '上传商品图即可开始。默认直接用完整商品参考图生成，不要求抠图；只有需要更强商品保护时才启用严格像素锁定。';
    setChip(0, '无需抠图'); setChip(1, '任务计划'); setChip(2, '逐图 QA');
    setFeature(0, '智能一致性优先', '普通商品直接使用完整参考图生成；抠图与 Mask 只作为严格一致性的后台增强能力。');
    setFeature(1, 'Task / Plan 生产线', '套图拆成独立任务，每张图有自己的目标、Prompt、生成状态与结果。');
    setFeature(2, 'QA 与失败续跑', '生成后重点确认商品 Logo、颜色、结构与文字；不合格只重做这一张，成功结果保留。');
  }

  const script = document.createElement('script');
  if (mode === 'legacy') {
    script.src = './app.js?v=20260903-legacy-1';
  } else {
    script.type = 'module';
    script.src = mode === 'studio'
      ? './studio-smart.js?v=20260903-smart-1'
      : './product-lock.js?v=20260903-lock-1';
  }
  document.body.appendChild(script);
})();
