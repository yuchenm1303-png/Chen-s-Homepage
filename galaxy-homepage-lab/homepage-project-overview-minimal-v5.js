(() => {
  'use strict';

  const OVERVIEW_SELECTOR = '.star-detail-shell[data-star-kind="project"] .project-overview';

  function simplifyOverview(root = document) {
    root.querySelectorAll(OVERVIEW_SELECTOR).forEach((overview) => {
      overview.querySelector('.project-overview-facts')?.remove();
      overview.querySelector('.project-overview-points')?.remove();
      overview.classList.add('project-overview--text-only');
    });
  }

  const apply = () => simplifyOverview(document);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  } else {
    apply();
  }

  const observer = new MutationObserver((records) => {
    if (!records.some((record) => record.addedNodes.length)) return;
    simplifyOverview(document);
  });

  const start = () => observer.observe(document.body, { childList: true, subtree: true });
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
