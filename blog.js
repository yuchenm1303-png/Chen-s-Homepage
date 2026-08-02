(() => {
  const articles = window.BlogArticles;
  if (!articles?.zh?.length) {
    console.error('[Blog] article data is unavailable');
    return;
  }

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
