(() => {
  const mount = () => {
    if (document.querySelector('.product-story')) return;

    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = './portal-content-v1.css?v=20260813-1';
    document.head.appendChild(css);

    const hero = document.querySelector('.portal-title-copy > p:last-child');
    if (hero) {
      hero.textContent = 'Listing Studio 是面向 Makro Seller Center 的商品采集、字段规划与浏览器上架工作区。登录授权账户后获取最新 Windows 安装包。';
    }

    const details = document.querySelector('.utility-grid');
    if (!details) return;

    const fragment = document.createElement('div');
    fragment.innerHTML = `
      <section class="product-story fade" aria-labelledby="productOverviewTitle">
        <div class="story-heading">
          <div>
            <span class="story-overline">PRODUCT OVERVIEW</span>
            <h2 id="productOverviewTitle">从商品链接，到可执行的 Makro Listing</h2>
          </div>
          <p>Listing Studio 把供应商页面采集、AI 字段理解、类目与品牌识别、草稿填写和结果复核集中到一个 Windows 工作区。单品和批量任务共享同一套受控浏览器会话。</p>
        </div>
        <div class="product-feature-grid">
          <article class="product-feature cards"><span class="feature-index">01</span><h3>单链接工作流</h3><p>输入 1688 或供应商商品链接，程序采集页面文本、结构化参数、截图与商品图片，生成后续上架所需的原始证据。</p></article>
          <article class="product-feature cards"><span class="feature-index">02</span><h3>单品与批量任务</h3><p>Single 用于逐条准备与确认；Batch 让多个商品共享同一 Makro 登录会话，并在各自受控标签页中独立推进。</p></article>
          <article class="product-feature cards"><span class="feature-index">03</span><h3>证据驱动的 AI</h3><p>Local AI 先将字段标记为 READY / CONFLICT / MISSING；只有无法确认的 MISSING 字段才进入补充检索，避免无依据猜测。</p></article>
          <article class="product-feature cards"><span class="feature-index">04</span><h3>浏览器持久化验收</h3><p>正式执行写入草稿、上传 Product Photos，并通过 Save / reopen 验证持久化结果；Send to QC 始终保留给人工操作。</p></article>
        </div>
      </section>

      <section class="workflow-story fade" aria-labelledby="workflowTitle">
        <div class="story-heading">
          <div>
            <span class="story-overline">LISTING WORKFLOW</span>
            <h2 id="workflowTitle">四个阶段，把准备和真实写入分开</h2>
          </div>
          <p>准备阶段保持零写入；只有 Fill Plan 完成后，才解锁真实浏览器执行。字段来源、阻塞原因和执行结果都保留在同一条任务链中。</p>
        </div>
        <div class="workflow-track">
          <article class="workflow-step-card cards"><span class="workflow-number">01</span><strong>采集供应商证据</strong><small>SOURCE CAPTURE</small><p>读取标题、参数、可见文本、结构化数据、整页截图与可用商品图片，不替商品事实做主观解释。</p></article>
          <article class="workflow-step-card cards"><span class="workflow-number">02</span><strong>确认类目与品牌</strong><small>CATEGORY / BRAND</small><p>连接 Makro Seller Center，完成 Vertical 与 Brand 阶段，并保持任务对应的浏览器页面所有权。</p></article>
          <article class="workflow-step-card cards"><span class="workflow-number">03</span><strong>生成字段计划</strong><small>LISTING PLAN</small><p>结合 Makro live schema 输出 READY、MISSING、CONFLICT 与 BLOCKED，准备阶段不写 Step 3 字段。</p></article>
          <article class="workflow-step-card cards"><span class="workflow-number">04</span><strong>填写、保存与复核</strong><small>FILL / VERIFY</small><p>经显式授权后执行字段填写和图片上传，Save 后重新打开验证持久化结果。</p></article>
        </div>
      </section>

      <section class="distribution-story fade" aria-labelledby="distributionTitle">
        <article class="distribution-panel cards">
          <div class="distribution-copy">
            <span class="story-overline">SECURE DISTRIBUTION</span>
            <h2 id="distributionTitle">下载入口和应用授权使用同一条安全边界</h2>
            <p>这里不只是安装包下载页。网页账户权限会继续用于正式安装版的启动授权、Windows 设备验证和 Stable 更新下载，让版本分发和应用访问保持一致。</p>
          </div>
          <div class="distribution-points">
            <div class="distribution-point"><span>01</span><div><strong>账户与设备双重验证</strong><p>正式安装版启动时验证 Supabase 登录、账号授权和当前 Windows 设备；设备数量受账户授权限制。</p></div></div>
            <div class="distribution-point"><span>02</span><div><strong>Stable 更新只认正式发布</strong><p>应用只读取 stable update manifest。可选更新可以稍后安装；关键更新可要求升级后继续使用。</p></div></div>
            <div class="distribution-point"><span>03</span><div><strong>私有安装包 + 完整性校验</strong><p>网页和应用更新都可通过 portal-download 获取短时 signed URL，并校验目标版本与 SHA256 后再安装。</p></div></div>
          </div>
        </article>
      </section>`;

    const nodes = Array.from(fragment.children);
    for (const node of nodes) details.before(node);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
