(() => {
  'use strict';

  if (window.SmirelLanguage?.current !== 'en') return;

  function setText(node, value) {
    if (node && typeof value === 'string' && node.textContent !== value) node.textContent = value;
  }

  function replaceList(list, items) {
    if (!list || !Array.isArray(items)) return;
    const nodes = [...list.querySelectorAll(':scope > li')];
    nodes.forEach((node, index) => {
      if (items[index] != null) setText(node, items[index]);
    });
  }

  function translateProject(root = document) {
    const shell = document.querySelector('.star-detail-shell[data-star-kind="project"]');
    const view = shell?.querySelector('.project-view');
    if (!shell || !view) return;

    const id = shell.dataset.starId || '';
    const object = (window.__SMIREL_STELLAR_CATALOG__ || []).find((item) => item.id === id);
    const detail = object?.projectDetail;
    if (!object || !detail) return;

    const overview = view.querySelector('.project-overview');
    if (overview) {
      overview.setAttribute('aria-label', 'Project overview');
      setText(overview.querySelector('.project-overview-kicker'), 'Project overview');
      setText(overview.querySelector('.project-overview-thesis'), object.lede || object.overview || object.title || 'Project');
      setText(overview.querySelector('.project-overview-summary'), object.overview || detail.summary || '');

      const facts = [...overview.querySelectorAll('.project-overview-fact')];
      const factCopy = [
        ['Type', detail.type],
        ['Period', detail.period],
        ['My role', detail.role],
        ['Status', detail.status],
      ];
      facts.forEach((row, index) => {
        const pair = factCopy[index];
        if (!pair) return;
        setText(row.querySelector('span'), pair[0]);
        setText(row.querySelector('strong'), pair[1] || '');
      });

      replaceList(overview.querySelector('.project-overview-points'), (object.systems || detail.highlights || []).slice(0, 4));
    }

    const more = view.querySelector('[data-project-detail-open] span');
    setText(more, 'View details');

    const documentNode = view.querySelector('.project-detail-document');
    if (!documentNode) return;

    setText(documentNode.querySelector('[data-project-detail-close]'), '← Back to overview');
    setText(documentNode.querySelector('.project-detail-kicker'), 'Project details');
    setText(documentNode.querySelector('.project-detail-intro h2'), object.lede || object.title || 'Project');
    const introBody = documentNode.querySelector('.project-detail-intro > p:last-of-type');
    setText(introBody, detail.summary || object.overview || '');

    const detailFacts = [...documentNode.querySelectorAll('.project-detail-fact')];
    const detailFactCopy = [
      ['Type', detail.type],
      ['Period', detail.period],
      ['Role', detail.role],
      ['Status', detail.status],
    ];
    detailFacts.forEach((row, index) => {
      const pair = detailFactCopy[index];
      if (!pair) return;
      setText(row.querySelector('span'), pair[0]);
      setText(row.querySelector('strong'), pair[1] || '');
    });

    const sections = [...documentNode.querySelectorAll('.project-detail-section')];
    const labels = ['What I built', 'How it works', 'System structure', 'Key work', 'Challenges', 'Outputs', 'Stack', 'Progress', 'Next'];
    sections.forEach((section, index) => setText(section.querySelector('.project-detail-section-label'), labels[index] || ''));

    if (sections[0]) replaceList(sections[0].querySelector('.project-detail-list'), detail.highlights || []);
    if (sections[1]) replaceList(sections[1].querySelector('.project-detail-list'), detail.architecture || []);

    documentNode.querySelectorAll('.project-detail-progress li').forEach((row) => {
      const state = row.classList.contains('is-done') ? 'Done' : row.classList.contains('is-active') ? 'Active' : 'Next';
      setText(row.querySelector('b'), state);
    });
  }

  const apply = () => translateProject(document);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
  else apply();

  const observer = new MutationObserver((records) => {
    if (!records.some((record) => record.addedNodes.length)) return;
    translateProject(document);
  });

  const start = () => observer.observe(document.body, { childList: true, subtree: true });
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
