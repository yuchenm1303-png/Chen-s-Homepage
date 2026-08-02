(() => {
  'use strict';

  const MAX_SECTION_NODES = 7;
  let transforming = false;

  function createCard(kind, label) {
    const card = document.createElement('section');
    card.className = `article-glass-card ${kind}`;
    card.dataset.blogGlassHost = '';
    if (label) card.setAttribute('aria-label', label);
    return card;
  }

  function createBody(nodes) {
    const body = document.createElement('div');
    body.className = 'article-body';
    nodes.forEach((node) => body.appendChild(node));
    return body;
  }

  function splitSection(nodes) {
    if (nodes.length <= MAX_SECTION_NODES) return [nodes];

    const chunks = [];
    const heading = nodes[0];
    const remainder = nodes.slice(1);
    chunks.push([heading, ...remainder.splice(0, MAX_SECTION_NODES - 1)]);

    while (remainder.length) {
      chunks.push(remainder.splice(0, MAX_SECTION_NODES));
    }
    return chunks;
  }

  function segmentArticle(reader, documentElement) {
    if (transforming || !documentElement) return;

    const directChildren = [...documentElement.children];
    if (!directChildren.length) return;
    if (directChildren.every((child) => child.classList.contains('article-glass-card'))) return;

    const header = directChildren.find((child) => child.classList.contains('article-header'));
    const sourceBody = directChildren.find((child) => child.classList.contains('article-body'));
    const ending = directChildren.find((child) => child.classList.contains('article-ending'));
    if (!header || !sourceBody) return;

    transforming = true;
    try {
      const bodyChildren = [...sourceBody.children];
      const introNodes = [];
      const sections = [];
      let currentSection = null;

      for (const node of bodyChildren) {
        if (node.matches('h2')) {
          currentSection = [node];
          sections.push(currentSection);
        } else if (currentSection) {
          currentSection.push(node);
        } else {
          introNodes.push(node);
        }
      }

      const fragment = document.createDocumentFragment();
      const heroCard = createCard('article-hero-card', 'Article introduction');
      heroCard.appendChild(header);
      if (introNodes.length) heroCard.appendChild(createBody(introNodes));
      fragment.appendChild(heroCard);

      const chapterCards = [];
      for (const sectionNodes of sections) {
        const sectionHeading = sectionNodes[0]?.textContent?.trim() || 'Article section';
        const chunks = splitSection(sectionNodes);

        chunks.forEach((chunk, chunkIndex) => {
          const card = createCard('article-chapter-card', sectionHeading);
          if (chunkIndex > 0) {
            const continuation = document.createElement('div');
            continuation.className = 'article-card-continuation';
            continuation.textContent = `CONTINUED · ${sectionHeading}`;
            card.appendChild(continuation);
          }
          card.appendChild(createBody(chunk));
          chapterCards.push(card);
          fragment.appendChild(card);
        });
      }

      if (ending) {
        if (chapterCards.length) {
          chapterCards[chapterCards.length - 1].appendChild(ending);
        } else {
          heroCard.appendChild(ending);
        }
      }

      documentElement.replaceChildren(fragment);
      documentElement.classList.add('article-document-scroll-scene');
    } finally {
      transforming = false;
    }

    requestAnimationFrame(() => {
      reader.dispatchEvent(new CustomEvent('blog:glass-hosts-changed'));
      dispatchEvent(new Event('resize'));
    });
  }

  function prepareReader(reader) {
    if (!reader || reader.dataset.scrollSceneReady === 'true') return;

    const stage = reader.querySelector('.article-reader-stage');
    const toolbar = reader.querySelector('.article-control-bar');
    const shell = reader.querySelector('#articleGlassShell');
    const scroller = reader.querySelector('#articleScroll');
    const documentElement = reader.querySelector('#articleDocument');
    const toc = reader.querySelector('#articleToc');
    const progress = reader.querySelector('.article-progress-track');

    if (!stage || !toolbar || !shell || !scroller || !documentElement || !toc || !progress) return;

    toolbar.dataset.blogGlassHost = '';

    const world = document.createElement('div');
    world.className = 'article-scroll-world';

    documentElement.remove();
    scroller.remove();
    progress.remove();

    shell.appendChild(documentElement);
    world.append(shell, toc);
    scroller.appendChild(world);
    stage.append(progress, scroller);

    reader.dataset.scrollSceneReady = 'true';

    const observer = new MutationObserver(() => {
      queueMicrotask(() => segmentArticle(reader, documentElement));
    });
    observer.observe(documentElement, { childList: true });

    segmentArticle(reader, documentElement);
  }

  function initialise() {
    const reader = document.querySelector('.article-reader');
    if (reader) {
      prepareReader(reader);
      return;
    }

    const observer = new MutationObserver(() => {
      const nextReader = document.querySelector('.article-reader');
      if (!nextReader) return;
      observer.disconnect();
      prepareReader(nextReader);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  initialise();
})();
