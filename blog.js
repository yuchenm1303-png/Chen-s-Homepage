(() => {
  const articles = {
    zh: [
      {
        id: 'building-homepage',
        title: '从零搭建个人主页：复古窗口、星空与长期数字空间',
        shortTitle: '从零搭建个人主页',
        date: '2026-08-01',
        size: '18 KB',
        category: '网站开发',
        readTime: '9 分钟阅读',
        words: '约 3600 字',
        summary: '这不是一份放在网页里的简历，而是一个能持续容纳项目、文章和个人审美的数字房间。',
        body: `
          <p class="article-lead">我最初想做的并不是一张常见的开发者名片，而是一个打开后就能看出“这是我的空间”的个人主页。最终的结构由三种视觉语言组成：Windows 98 风格的主窗口、粉蓝星空桌面，以及用于长文阅读的 OpenGL 液态玻璃界面。</p>

          <h2>为什么不使用常见的现代卡片布局</h2>
          <p>现代个人主页通常会使用大标题、渐变背景、圆角卡片和项目网格。这类设计清晰可靠，但也很容易变得相似。我的主页更希望保留早期个人网站的私人感：它不是公司官网，也不是招聘模板，而像一台只属于自己的旧电脑。</p>
          <blockquote>个人主页真正有价值的地方，不是把经历压缩成几行，而是让项目、文章和审美逐步沉淀在同一个空间里。</blockquote>
          <p>因此首页继续使用复古窗口。按钮、标题栏、状态栏和像素字体都遵循旧式桌面软件的视觉规则；背景则不照搬传统 Windows 壁纸，而使用更梦幻的粉、紫、蓝星空，让页面同时具有怀旧感和个人气质。</p>

          <h2>第一阶段：搭建可持续扩展的页面骨架</h2>
          <p>主页没有使用复杂框架，而是先用 HTML、CSS 和原生 JavaScript 建立稳定结构。首页窗口负责导航和基础内容，项目页由独立脚本接管，博客文章阅读器也作为独立模块加载。这种拆分让每个界面可以继续深化，而不会把全部逻辑堆进一个文件。</p>
          <div class="article-code"><div class="code-title">PAGE MODULES</div><pre><code>index.html
├─ script.js              // 基础窗口与语言切换
├─ projects.js            // 项目管理器
├─ blog.js                // 文章、目录与阅读状态
├─ blog-glass.js          // WebGL 液态玻璃渲染
└─ starfield.js           // 桌面星空</code></pre></div>
          <p>页面依然部署在 GitHub Pages。每次提交后由 GitHub Actions 自动发布，避免把展示站点和本地开发环境绑定在一起。</p>

          <h2>第二阶段：让背景服务于主体</h2>
          <p>星空背景经历了多次调整。最初版本过于接近参考图的黑青色，和粉色窗口并不协调；后来又出现紫色高光落在窗口下方、颜色过于单一、星星过大等问题。最终的原则很简单：</p>
          <ul>
            <li>最亮的粉紫雾光位于窗口上方，而不是压在页面底部；</li>
            <li>左侧偏玫红，右侧偏青蓝，中间用淡紫自然过渡；</li>
            <li>星星使用多色光，但数量、尺寸和光刺保持克制；</li>
            <li>背景有意境，但主窗口始终是第一视觉中心。</li>
          </ul>

          <h2>第三阶段：项目页从列表变成项目管理器</h2>
          <p>项目页最初只是四行文本，无法表达真实工作量。现在它被改造成一个复古项目管理器：左侧选择项目，右侧查看概览、系统架构、关键工作、技术难点、阶段成果、技术栈和下一步计划。</p>
          <p>这种结构比单纯的卡片更适合长期维护。项目发生变化时，只需要更新项目数据，不必重新设计页面；访客也可以快速浏览，再深入查看感兴趣的内容。</p>

          <h2>为什么博客详情页切换为液态玻璃</h2>
          <p>博客列表仍属于 Windows 98 文件目录，但长文章需要更舒适的排版和更大的阅读空间。因此文章打开后会进入单独的液态玻璃阅读场景。这里不是普通的 CSS 毛玻璃，而是根据 AI 应用项目中两套 OpenGL 玻璃重新设计的 WebGL 版本。</p>
          <div class="article-callout">
            <strong>新版主体折射</strong>
            <span>负责大面积文章面板：主体透镜、连续圆肩、分级模糊和轻微色散。</span>
          </div>
          <div class="article-callout">
            <strong>旧版边缘折射</strong>
            <span>负责返回、目录、字号和上下篇按钮：中心平静，边缘具有更明确的内向拉扯与厚环感。</span>
          </div>

          <h2>当前结果与下一步</h2>
          <p>现在的主页已经不再只是静态简介。它拥有可切换的项目管理器、文章目录、阅读进度、响应式布局和两种 WebGL 玻璃语言。下一步会继续补充真实文章、项目截图和可公开仓库链接，同时逐步统一中英文内容。</p>
          <p>这个网站不会一次“做完”。它更像一个持续生长的数字空间：每完成一个项目、解决一个问题、形成一段值得保存的思考，就在这里增加一个新的文件。</p>
        `
      },
      {
        id: 'opengl-liquid-glass',
        title: '两套 OpenGL 液态玻璃：边缘折射与主体折射为什么不能混为一谈',
        shortTitle: '两套 OpenGL 液态玻璃',
        date: '2026-07-28',
        size: '26 KB',
        category: '图形渲染',
        readTime: '11 分钟阅读',
        words: '约 4300 字',
        summary: '旧版强调厚环、圆肩和边缘拉扯；新版把主体透镜、圆肩过渡和色散统一到完整光学场中。',
        body: `
          <p class="article-lead">“液态玻璃”并不等于模糊背景加一圈白边。在 AI 应用项目中，旧版和新版都由 OpenGL 渲染，但两者解决的是不同问题，也形成了完全不同的光学语言。</p>
          <h2>旧版：边缘是主角</h2>
          <p>旧版 <code>OpenGLGlassCardLayer</code> 的视觉重点集中在边缘。它通过厚环宽度、边缘拉距、压缩、角部放大和暗边共同塑造气泡感。中心区域可以相对平静，而背景在接近圆角和边缘时发生明显的内向折射。</p>
          <ul>
            <li><code>edgePullDp</code> 控制边缘采样向内或向外拉动的距离；</li>
            <li><code>ringWidthDp</code> 决定厚环的视觉宽度；</li>
            <li><code>openGlCornerScale</code> 与 <code>openGlSampleRadiusScale</code> 共同影响圆角区域；</li>
            <li><code>openGlDarkScale</code> 用于塑造玻璃边缘的深度，而不是简单加阴影。</li>
          </ul>
          <h2>新版：整个主体成为透镜</h2>
          <p>新版 <code>NewOpenGLGlassCardLayer</code> 不再只围绕边缘工作。它同时接收清晰、低模糊、中模糊和高模糊四级背景纹理，根据主体位置、圆肩距离和折射强度组合采样。</p>
          <p>它把效果拆成主体透镜、液态圆肩和色散三部分。主体透镜决定背景在玻璃中心如何被拉动和压缩；圆肩负责从中心到边缘的连续过渡；色散只在边缘或强折射位置分离红、绿、蓝采样。</p>
          <h2>为什么大面板和小按钮要使用不同语言</h2>
          <p>大面积文章面板如果使用旧版强厚环，边缘会过重，正文区域也容易像被框住。新版主体折射更适合让整块玻璃拥有统一体积，同时保持中心稳定。</p>
          <p>相反，小按钮没有足够面积表现复杂主体透镜。旧版边缘折射能在很小的尺寸里迅速建立“这是玻璃”的识别度，因此适合返回、目录、字号和导航胶囊。</p>
          <h2>迁移到网页时的限制</h2>
          <p>Android Renderer 可以直接使用由 Compose 场景生成的背景纹理，但网页中的 WebGL 无法任意读取后方 DOM 像素。为避免伪造折射，本阅读器让星空和玻璃由同一个 WebGL 场景绘制，正文 DOM 再覆盖在透明玻璃区域之上。</p>
          <blockquote>真正的折射必须知道自己在采样什么。无法采样背景时，仅使用透明度和 blur 只能得到材质近似，而不是完整光学效果。</blockquote>
          <h2>控制效果的原则</h2>
          <ul>
            <li>主体折射比边缘折射弱，保证长时间阅读；</li>
            <li>色散只作为边缘提示，不能形成大面积彩边；</li>
            <li>文字不参与 WebGL 扭曲，始终位于光学层之上；</li>
            <li>移动端降低像素比和采样次数，优先保证滚动稳定；</li>
            <li>系统开启“减少动态效果”后停止星云漂移。</li>
          </ul>
          <h2>最终组合</h2>
          <p>文章主体使用新版光学场，控制组件使用旧版圆肩厚环。两者不是简单叠加，而是根据组件尺寸和信息层级分工。这种组合既保留了原项目的技术特征，也让博客界面具备清晰的阅读秩序。</p>
        `
      },
      {
        id: 'computer-use-design',
        title: 'Computer Use 界面自动化：从截图到可验证操作闭环',
        shortTitle: 'Computer Use 界面自动化设计',
        date: '2026-07-20',
        size: '23 KB',
        category: 'AI 应用',
        readTime: '10 分钟阅读',
        words: '约 3900 字',
        summary: '界面自动化不是把点击坐标交给模型，而是持续完成观察、规划、执行和验证。',
        body: `
          <p class="article-lead">Computer Use 项目的目标，是让模型在真实手机界面中完成连续任务。系统不能依赖固定控件 ID，也不能把一次截图理解成完整环境，而需要建立能够自我校验的执行循环。</p>
          <h2>基本闭环</h2>
          <p>每一轮执行都包含四个阶段：截取当前屏幕、生成结构化动作、调用无障碍或设备命令执行、再次截图验证结果。任何一步失败都不能直接假设任务已经完成。</p>
          <div class="article-code"><div class="code-title">VISUAL LOOP</div><pre><code>OBSERVE  → screenshot + current state
PLAN     → strict JSON action
EXECUTE  → accessibility / device shell
VERIFY   → next screenshot + evidence</code></pre></div>
          <h2>为什么需要严格动作协议</h2>
          <p>自然语言适合表达意图，但不适合直接驱动设备。点击、滑动、输入、返回和应用切换必须转换为字段明确的 JSON 动作，并对坐标、包名、超时、会话状态和高风险操作进行校验。</p>
          <h2>短暂界面不是失败</h2>
          <p>弹窗、键盘、加载层、页面动画和权限提示都可能只存在几百毫秒。系统需要结合前后帧和任务历史判断它们属于正常过渡、可恢复遮挡，还是任务已经偏离。</p>
          <h2>自动化的安全边界</h2>
          <p>能够执行不等于应该自动提交。证券交易、付款、删除和授权等不可逆操作必须保留用户确认。系统可以导航到目标页面、填写候选信息，但关键字段和最终提交需要明确许可。</p>
          <h2>当前重点</h2>
          <p>现阶段主要工作是压测多应用、长任务和异常恢复，减少模型协议漂移，并把失败分类整理成可复现测试。稳定性比单次演示中的“看起来聪明”更重要。</p>
        `
      },
      {
        id: 'gan-hemt-stability',
        title: 'GaN HEMT 仿真中的数值稳定性：为什么曲线会失真或不收敛',
        shortTitle: 'GaN HEMT 数值稳定性',
        date: '2026-07-10',
        size: '31 KB',
        category: '工程仿真',
        readTime: '12 分钟阅读',
        words: '约 4700 字',
        summary: '高漏压、重离子和温度耦合会显著增强方程刚性，收敛本身并不代表结果正确。',
        body: `
          <p class="article-lead">在增强型 GaN HEMT 的 Sentaurus 仿真中，最常见的问题并不是“没有结果”，而是得到一条看似完整、实际上由步长、网格或物理模型冲突造成的伪曲线。</p>
          <h2>先判断问题出在哪里</h2>
          <p>竖线、突然跳变、漏极电流异常增大和 Newton 迭代失败可能来自不同原因。排查时应分开检查器件结构、网格、边界条件、物理模型和扫描路径，而不是只提高最大迭代次数。</p>
          <h2>分段准静态扫描</h2>
          <p>高漏压范围不适合使用单一大步长直接扫到终点。将 QuasiStationary 分成多个区间，在高场区主动减小步长，通常比统一缩小全部步长更有效，也能降低计算成本。</p>
          <h2>网格和物理模型</h2>
          <p>2DEG、栅边缘和栅漏区域需要重点加密。迁移率、复合、雪崩和压电模型应逐步开启，通过控制变量判断是哪一组耦合导致刚性突然增强。</p>
          <h2>重离子与温度扫描</h2>
          <p>LET、结温、栅压和漏压共同改变载流子产生、迁移和高场行为。参数扫描不能只追求覆盖范围，还要在高风险区域重复计算，并检查相邻参数点是否满足连续趋势。</p>
          <h2>结果判据</h2>
          <p>最终工程图需要明确区分瞬态峰值、稳态终点电流和应用层限值。Tj–Vg 合格域必须说明使用的 LET、环境温度、导通电阻、热阻和电流阈值，不能只展示一条没有定义的边界线。</p>
          <h2>收敛不等于可信</h2>
          <blockquote>数值求解器给出一个答案，只能证明它找到了某个离散方程解；是否对应合理器件行为，还需要趋势、量级和文献或实验共同校核。</blockquote>
          <p>因此正式输出前，还需要检查参数连续性、网格敏感性、模型敏感性以及高温高 LET 区域的重复计算结果。</p>
        `
      }
    ]
  };

  articles.en = articles.zh.map((article) => ({ ...article }));

  const uiText = {
    zh: {
      indexTitle: 'Index of /blog',
      name: 'Name', date: 'Date', size: 'Size', count: '4 个文件 · 0 个目录',
      back: '← 返回博客', toc: '目录', smaller: 'A−', larger: 'A+', previous: '上一篇', next: '下一篇', close: '×',
      author: '邹羽宸', reading: '阅读进度', tocTitle: 'CONTENTS / 目录'
    },
    en: {
      indexTitle: 'Index of /blog',
      name: 'Name', date: 'Date', size: 'Size', count: '4 files · 0 directories',
      back: '← BACK', toc: 'CONTENTS', smaller: 'A−', larger: 'A+', previous: 'PREV', next: 'NEXT', close: '×',
      author: 'Yuchen Zou', reading: 'READING', tocTitle: 'CONTENTS'
    }
  };

  function blogIndexTemplate(lang) {
    const text = uiText[lang];
    return `
      <section class="blog-index-app">
        <h2 class="section-title">${text.indexTitle}</h2>
        <div class="blog-index-path">C:\\YUCHEN\\BLOG\\ <span class="cursor-block"></span></div>
        <table class="file-table blog-file-table">
          <thead><tr><th>${text.name}</th><th>${text.date}</th><th>${text.size}</th></tr></thead>
          <tbody>
            ${articles[lang].map((article) => `
              <tr>
                <td><span class="file-icon">▤</span><a class="pixel-link blog-file-link" href="#/blog/${article.id}" data-blog-id="${article.id}">${article.shortTitle}</a></td>
                <td>${article.date}</td><td>${article.size}</td>
              </tr>`).join('')}
          </tbody>
        </table>
        <p class="note">${text.count}</p>
        <p class="blog-index-hint">双击文件的感觉，打开的是一块独立的 OpenGL 液态玻璃阅读空间。</p>
      </section>`;
  }

  content.zh.sections.blog = blogIndexTemplate('zh');
  content.en.sections.blog = blogIndexTemplate('en');

  const baseRender = render;
  render = function renderWithBlog() {
    baseRender();
    if (state.section === 'blog') initialiseBlogIndex();
  };

  let readerRoot = null;
  let renderer = null;
  let currentArticleId = null;
  let currentFontScale = 1;
  let previousBodyOverflow = '';

  function initialiseBlogIndex() {
    contentElement.querySelectorAll('[data-blog-id]').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        openArticle(link.dataset.blogId, true);
      });
    });
  }

  function ensureReader() {
    if (readerRoot) return readerRoot;
    readerRoot = document.createElement('div');
    readerRoot.id = 'articleReader';
    readerRoot.className = 'article-reader';
    readerRoot.hidden = true;
    readerRoot.setAttribute('aria-hidden', 'true');
    readerRoot.innerHTML = `
      <canvas class="article-glass-canvas" id="articleGlassCanvas" aria-hidden="true"></canvas>
      <div class="article-reader-stage">
        <div class="article-control-bar" role="toolbar" aria-label="Article controls">
          <button class="legacy-glass-control control-back" type="button" data-reader-action="back"></button>
          <button class="legacy-glass-control" type="button" data-reader-action="toc"></button>
          <button class="legacy-glass-control control-font" type="button" data-reader-action="smaller"></button>
          <button class="legacy-glass-control control-font" type="button" data-reader-action="larger"></button>
          <span class="control-spacer"></span>
          <button class="legacy-glass-control" type="button" data-reader-action="previous"></button>
          <button class="legacy-glass-control" type="button" data-reader-action="next"></button>
          <button class="legacy-glass-control control-close" type="button" data-reader-action="close"></button>
        </div>

        <main class="article-glass-shell" id="articleGlassShell">
          <div class="article-progress-track"><span id="articleProgressBar"></span></div>
          <div class="article-scroll" id="articleScroll" tabindex="0">
            <article class="article-document" id="articleDocument"></article>
          </div>
        </main>

        <aside class="article-toc" id="articleToc" aria-label="Article table of contents">
          <div class="toc-title"></div>
          <nav class="toc-links"></nav>
          <div class="toc-reading"><span></span><strong id="articleProgressText">0%</strong></div>
        </aside>
      </div>`;
    document.body.appendChild(readerRoot);

    readerRoot.querySelectorAll('[data-reader-action]').forEach((button) => {
      button.addEventListener('click', () => handleAction(button.dataset.readerAction));
    });
    readerRoot.querySelector('#articleScroll').addEventListener('scroll', updateReadingState, { passive: true });
    readerRoot.addEventListener('click', (event) => {
      const anchor = event.target.closest('a[href^="#section-"]');
      if (!anchor) return;
      event.preventDefault();
      const target = readerRoot.querySelector(anchor.getAttribute('href'));
      target?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      if (innerWidth <= 760) readerRoot.classList.remove('toc-open');
    });
    addEventListener('resize', refreshGlassGeometry, { passive: true });
    document.addEventListener('keydown', (event) => {
      if (readerRoot.hidden) return;
      if (event.key === 'Escape') closeArticle(true);
    });
    return readerRoot;
  }

  function openArticle(id, pushHash = false) {
    const lang = state.lang;
    const article = articles[lang].find((item) => item.id === id) || articles[lang][0];
    const root = ensureReader();
    currentArticleId = article.id;
    populateArticle(article, lang);
    if (root.hidden) previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('article-reader-open');
    root.hidden = false;
    root.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => {
      root.classList.add('is-open');
      initialiseGlassRenderer();
      root.querySelector('#articleScroll').focus({ preventScroll: true });
    });
    if (pushHash && location.hash !== `#/blog/${article.id}`) history.pushState({ article: article.id }, '', `#/blog/${article.id}`);
  }

  function populateArticle(article, lang) {
    const text = uiText[lang];
    const documentElement = readerRoot.querySelector('#articleDocument');
    documentElement.innerHTML = `
      <header class="article-header">
        <div class="article-kicker"><span>${article.category}</span><i></i><span>${article.date}</span></div>
        <h1>${article.title}</h1>
        <p class="article-summary">${article.summary}</p>
        <div class="article-meta">
          <div class="article-author"><img src="assets/avatar.svg" alt=""><span><b>${text.author}</b><small>${article.readTime} · ${article.words}</small></span></div>
          <div class="article-meta-code">ARTICLE://${article.id.toUpperCase()}</div>
        </div>
      </header>
      <div class="article-body">${article.body}</div>
      <footer class="article-ending"><span>EOF</span><p>这篇文章仍会随着项目进展继续修订。</p></footer>`;

    documentElement.querySelectorAll('h2, h3').forEach((heading, index) => {
      heading.id = `section-${index + 1}`;
    });
    buildToc(documentElement, text);
    setControlLabels(text);
    readerRoot.querySelector('#articleScroll').scrollTop = 0;
    currentFontScale = 1;
    readerRoot.style.setProperty('--article-font-scale', currentFontScale);
    updateReadingState();
  }

  function buildToc(documentElement, text) {
    const headings = [...documentElement.querySelectorAll('h2, h3')];
    const links = readerRoot.querySelector('.toc-links');
    readerRoot.querySelector('.toc-title').textContent = text.tocTitle;
    readerRoot.querySelector('.toc-reading span').textContent = text.reading;
    links.innerHTML = headings.map((heading) => `<a class="toc-level-${heading.tagName.toLowerCase()}" href="#${heading.id}" data-target="${heading.id}">${heading.textContent}</a>`).join('');
  }

  function setControlLabels(text) {
    const labels = {
      back: text.back, toc: text.toc, smaller: text.smaller, larger: text.larger,
      previous: text.previous, next: text.next, close: text.close
    };
    Object.entries(labels).forEach(([action, label]) => {
      const button = readerRoot.querySelector(`[data-reader-action="${action}"]`);
      button.textContent = label;
      button.setAttribute('aria-label', label);
    });
  }

  function initialiseGlassRenderer() {
    const canvas = readerRoot.querySelector('#articleGlassCanvas');
    if (!renderer) {
      renderer = new BlogGlassRenderer(canvas);
      const ok = renderer.initialise();
      if (!ok) readerRoot.classList.add('glass-fallback');
    }
    const controls = readerRoot.querySelectorAll('.legacy-glass-control');
    renderer?.bind(readerRoot.querySelector('#articleGlassShell'), controls);
    renderer?.start();
  }

  function refreshGlassGeometry() {
    if (!readerRoot || readerRoot.hidden) return;
    renderer?.bind(readerRoot.querySelector('#articleGlassShell'), readerRoot.querySelectorAll('.legacy-glass-control'));
  }

  function closeArticle(updateHash = false) {
    if (!readerRoot || readerRoot.hidden) return;
    readerRoot.classList.remove('is-open', 'toc-open');
    renderer?.stop();
    setTimeout(() => {
      readerRoot.hidden = true;
      readerRoot.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = previousBodyOverflow;
      document.body.classList.remove('article-reader-open');
    }, 260);
    if (updateHash) history.pushState({}, '', '#/blog');
  }

  function handleAction(action) {
    if (action === 'back' || action === 'close') return closeArticle(true);
    if (action === 'toc') return readerRoot.classList.toggle('toc-open');
    if (action === 'smaller' || action === 'larger') {
      currentFontScale = Math.min(1.20, Math.max(0.88, currentFontScale + (action === 'larger' ? 0.06 : -0.06)));
      readerRoot.style.setProperty('--article-font-scale', currentFontScale.toFixed(2));
      return;
    }
    const langArticles = articles[state.lang];
    const index = langArticles.findIndex((item) => item.id === currentArticleId);
    const step = action === 'next' ? 1 : -1;
    const next = langArticles[(index + step + langArticles.length) % langArticles.length];
    openArticle(next.id, true);
  }

  function updateReadingState() {
    if (!readerRoot || readerRoot.hidden) return;
    const scroller = readerRoot.querySelector('#articleScroll');
    const max = Math.max(1, scroller.scrollHeight - scroller.clientHeight);
    const progress = Math.min(1, Math.max(0, scroller.scrollTop / max));
    readerRoot.querySelector('#articleProgressBar').style.transform = `scaleX(${progress})`;
    readerRoot.querySelector('#articleProgressText').textContent = `${Math.round(progress * 100)}%`;

    const headings = [...readerRoot.querySelectorAll('.article-document h2, .article-document h3')];
    let activeId = headings[0]?.id;
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top <= 150) activeId = heading.id;
      else break;
    }
    readerRoot.querySelectorAll('.toc-links a').forEach((link) => link.classList.toggle('is-active', link.dataset.target === activeId));
  }

  function syncHashRoute() {
    const match = location.hash.match(/^#\/blog\/([a-z0-9-]+)$/i);
    if (match) {
      if (state.section !== 'blog') {
        state.section = 'blog';
        render();
      }
      openArticle(match[1], false);
    } else if (location.hash === '#/blog') {
      if (state.section !== 'blog') {
        state.section = 'blog';
        render();
      }
      if (readerRoot && !readerRoot.hidden) closeArticle(false);
    }
  }

  addEventListener('hashchange', syncHashRoute);
  addEventListener('popstate', syncHashRoute);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncHashRoute, { once: true });
  else syncHashRoute();
})();
