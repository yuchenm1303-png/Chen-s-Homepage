(() => {
  const articles = window.BlogArticles;
  if (!articles?.zh?.length) {
    console.error('[Blog] article data is unavailable');
    return;
  }

  articles.en = articles.zh.map((article) => ({ ...article }));

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const uiText = {
    zh: {
      indexTitle: 'Index of /blog',
      name: 'Name', date: 'Date', size: 'Size',
      back: '← 返回博客', toc: '目录', smaller: 'A−', larger: 'A+', previous: '上一篇', next: '下一篇', close: '×',
      author: '邹羽宸', reading: '阅读进度', tocTitle: 'CONTENTS / 目录'
    },
    en: {
      indexTitle: 'Index of /blog',
      name: 'Name', date: 'Date', size: 'Size',
      back: '← BACK', toc: 'CONTENTS', smaller: 'A−', larger: 'A+', previous: 'PREV', next: 'NEXT', close: '×',
      author: 'Yuchen Zou', reading: 'READING', tocTitle: 'CONTENTS'
    }
  };

  function blogIndexTemplate(lang) {
    const text = uiText[lang];
    const articleCount = articles[lang].length;
    const countText = lang === 'zh'
      ? `${articleCount} 个文件 · 0 个目录`
      : `${articleCount} files · 0 directories`;
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
        <p class="note">${countText}</p>
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
  let currentArticleLang = null;
  let currentFontScale = 1;
  let previousBodyOverflow = '';
  let blogIndexDelegated = false;
  let articleScroll = null;
  let articleDocument = null;
  let progressBar = null;
  let progressText = null;
  let readerControls = [];
  let headingNodes = [];
  let tocLinkById = new Map();
  let activeHeadingIndex = 0;
  let activeTocLink = null;
  let lastProgressPercent = -1;
  let readingFrame = 0;
  let resizeFrame = 0;
  let glassStartFrame = 0;
  let closeTimer = 0;

  function initialiseBlogIndex() {
    if (blogIndexDelegated) return;
    blogIndexDelegated = true;
    contentElement.addEventListener('click', (event) => {
      const link = event.target.closest('[data-blog-id]');
      if (!link || !contentElement.contains(link)) return;
      event.preventDefault();
      openArticle(link.dataset.blogId, true);
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

    articleScroll = readerRoot.querySelector('#articleScroll');
    articleDocument = readerRoot.querySelector('#articleDocument');
    progressBar = readerRoot.querySelector('#articleProgressBar');
    progressText = readerRoot.querySelector('#articleProgressText');
    readerControls = [...readerRoot.querySelectorAll('.legacy-glass-control')];

    readerControls.forEach((button) => {
      button.addEventListener('click', () => handleAction(button.dataset.readerAction));
    });
    articleScroll.addEventListener('scroll', scheduleReadingState, { passive: true });
    readerRoot.addEventListener('click', (event) => {
      const anchor = event.target.closest('a[href^="#section-"]');
      if (!anchor) return;
      event.preventDefault();
      const target = readerRoot.querySelector(anchor.getAttribute('href'));
      target?.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
      if (innerWidth <= 760) readerRoot.classList.remove('toc-open');
    });
    addEventListener('resize', scheduleGlassGeometry, { passive: true });
    document.addEventListener('keydown', (event) => {
      if (readerRoot.hidden) return;
      if (event.key === 'Escape') closeArticle(true);
    });
    return readerRoot;
  }

  function cancelPendingClose() {
    if (!closeTimer) return;
    clearTimeout(closeTimer);
    closeTimer = 0;
  }

  function openArticle(id, pushHash = false) {
    const lang = state.lang;
    const article = articles[lang].find((item) => item.id === id) || articles[lang][0];
    const root = ensureReader();
    cancelPendingClose();

    if (!root.hidden && currentArticleId === article.id && currentArticleLang === lang) {
      root.classList.add('is-open');
      articleScroll?.focus({ preventScroll: true });
      if (pushHash && location.hash !== `#/blog/${article.id}`) {
        history.pushState({ article: article.id }, '', `#/blog/${article.id}`);
      }
      return;
    }

    if (!root.hidden) renderer?.stop();
    currentArticleId = article.id;
    currentArticleLang = lang;
    populateArticle(article, lang);

    if (root.hidden) previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('article-reader-open');
    root.hidden = false;
    root.setAttribute('aria-hidden', 'false');
    root.dispatchEvent(new CustomEvent('blog:reader-opened'));

    cancelAnimationFrame(glassStartFrame);
    glassStartFrame = requestAnimationFrame(() => {
      root.classList.add('is-open');
      articleScroll?.focus({ preventScroll: true });
      glassStartFrame = requestAnimationFrame(() => {
        glassStartFrame = 0;
        initialiseGlassRenderer();
        scheduleReadingState();
      });
    });

    if (pushHash && location.hash !== `#/blog/${article.id}`) {
      history.pushState({ article: article.id }, '', `#/blog/${article.id}`);
    }
  }

  function populateArticle(article, lang) {
    const text = uiText[lang];
    articleDocument.innerHTML = `
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

    headingNodes = [...articleDocument.querySelectorAll('h2, h3')];
    headingNodes.forEach((heading, index) => {
      heading.id = `section-${index + 1}`;
    });
    buildToc(text);
    setControlLabels(text);
    articleScroll.scrollTop = 0;
    currentFontScale = 1;
    readerRoot.style.setProperty('--article-font-scale', currentFontScale);
    activeHeadingIndex = 0;
    activeTocLink = null;
    lastProgressPercent = -1;
    updateReadingStateNow();
    readerRoot.dispatchEvent(new CustomEvent('blog:article-populated'));
  }

  function buildToc(text) {
    const links = readerRoot.querySelector('.toc-links');
    readerRoot.querySelector('.toc-title').textContent = text.tocTitle;
    readerRoot.querySelector('.toc-reading span').textContent = text.reading;
    links.innerHTML = headingNodes.map((heading) => `<a class="toc-level-${heading.tagName.toLowerCase()}" href="#${heading.id}" data-target="${heading.id}">${heading.textContent}</a>`).join('');
    tocLinkById = new Map(
      [...links.querySelectorAll('a[data-target]')].map((link) => [link.dataset.target, link])
    );
  }

  function setControlLabels(text) {
    const labels = {
      back: text.back, toc: text.toc, smaller: text.smaller, larger: text.larger,
      previous: text.previous, next: text.next, close: text.close
    };
    readerControls.forEach((button) => {
      const label = labels[button.dataset.readerAction];
      if (!label) return;
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
    renderer?.bind(readerRoot.querySelector('#articleGlassShell'), readerControls);
    renderer?.start();
  }

  function scheduleGlassGeometry() {
    if (!readerRoot || readerRoot.hidden || resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      renderer?.bind(readerRoot.querySelector('#articleGlassShell'), readerControls);
      scheduleReadingState();
    });
  }

  function closeArticle(updateHash = false) {
    if (!readerRoot || readerRoot.hidden) return;
    cancelAnimationFrame(glassStartFrame);
    glassStartFrame = 0;
    cancelAnimationFrame(readingFrame);
    readingFrame = 0;
    cancelAnimationFrame(resizeFrame);
    resizeFrame = 0;
    readerRoot.classList.remove('is-open', 'toc-open');
    renderer?.stop();

    cancelPendingClose();
    closeTimer = setTimeout(() => {
      closeTimer = 0;
      readerRoot.hidden = true;
      readerRoot.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = previousBodyOverflow;
      document.body.classList.remove('article-reader-open');
      readerRoot.dispatchEvent(new CustomEvent('blog:reader-closed'));
    }, reducedMotion.matches ? 0 : 190);

    if (updateHash) history.pushState({}, '', '#/blog');
  }

  function handleAction(action) {
    if (action === 'back' || action === 'close') return closeArticle(true);
    if (action === 'toc') return readerRoot.classList.toggle('toc-open');
    if (action === 'smaller' || action === 'larger') {
      currentFontScale = Math.min(1.20, Math.max(0.88, currentFontScale + (action === 'larger' ? 0.06 : -0.06)));
      readerRoot.style.setProperty('--article-font-scale', currentFontScale.toFixed(2));
      scheduleGlassGeometry();
      return;
    }
    const langArticles = articles[state.lang];
    const index = langArticles.findIndex((item) => item.id === currentArticleId);
    const step = action === 'next' ? 1 : -1;
    const next = langArticles[(index + step + langArticles.length) % langArticles.length];
    openArticle(next.id, true);
  }

  function scheduleReadingState() {
    if (!readerRoot || readerRoot.hidden || readingFrame) return;
    readingFrame = requestAnimationFrame(() => {
      readingFrame = 0;
      updateReadingStateNow();
    });
  }

  function updateReadingStateNow() {
    if (!readerRoot || readerRoot.hidden || !articleScroll) return;
    const max = Math.max(1, articleScroll.scrollHeight - articleScroll.clientHeight);
    const progress = Math.min(1, Math.max(0, articleScroll.scrollTop / max));
    progressBar.style.transform = `scaleX(${progress})`;

    const percent = Math.round(progress * 100);
    if (percent !== lastProgressPercent) {
      progressText.textContent = `${percent}%`;
      lastProgressPercent = percent;
    }

    if (!headingNodes.length) return;
    let nextIndex = Math.min(activeHeadingIndex, headingNodes.length - 1);

    while (
      nextIndex + 1 < headingNodes.length
      && headingNodes[nextIndex + 1].getBoundingClientRect().top <= 150
    ) {
      nextIndex += 1;
    }

    while (
      nextIndex > 0
      && headingNodes[nextIndex].getBoundingClientRect().top > 150
    ) {
      nextIndex -= 1;
    }

    activeHeadingIndex = nextIndex;
    const nextLink = tocLinkById.get(headingNodes[nextIndex]?.id) || null;
    if (nextLink !== activeTocLink) {
      activeTocLink?.classList.remove('is-active');
      nextLink?.classList.add('is-active');
      activeTocLink = nextLink;
    }
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
