(() => {
  'use strict';

  if (typeof render !== 'function' || typeof state === 'undefined' || !contentElement) return;

  let bypassLegacyProjectClick = false;

  function enhanceProjectView() {
    document.body.dataset.section = state.section;
    if (state.section !== 'projects') return;

    const root = contentElement.querySelector('.projects-app');
    if (!root || root.dataset.compactReady === '1') return;

    root.dataset.compactReady = '1';

    const lang = root.dataset.projectLang === 'en' ? 'en' : 'zh';
    const copy = lang === 'zh'
      ? {
          hint: '单击选择 · 双击或 Enter 打开详情',
          back: '← 返回项目列表',
          listLabel: '项目列表'
        }
      : {
          hint: 'Single-click to select · Double-click or press Enter for details',
          back: '← Back to project list',
          listLabel: 'Project list'
        };

    const rows = [...root.querySelectorAll('.project-row')];
    const filters = [...root.querySelectorAll('.project-filter')];
    const toolbar = root.querySelector('.project-toolbar');
    const inspector = root.querySelector('#projectInspector');
    const browser = root.querySelector('.project-browser');
    const emptyState = root.querySelector('.project-empty');
    const selectedLabel = root.querySelector('[data-selected-project]');

    if (!rows.length || !inspector || !browser) return;

    const hint = document.createElement('div');
    hint.className = 'project-usage-hint';
    hint.textContent = copy.hint;
    toolbar?.insertAdjacentElement('afterend', hint);

    browser.setAttribute('aria-label', copy.listLabel);

    let selectedId = rows.find((row) => row.classList.contains('is-selected'))?.dataset.projectId || rows[0].dataset.projectId;

    function setSelected(row, focus = false) {
      if (!row || row.hidden) return;
      selectedId = row.dataset.projectId;
      rows.forEach((item) => {
        const selected = item === row;
        item.classList.toggle('is-selected', selected);
        item.setAttribute('aria-pressed', String(selected));
      });
      if (selectedLabel) {
        const title = row.querySelector('.project-row-copy strong')?.textContent?.trim();
        if (title) selectedLabel.textContent = title;
      }
      if (focus) row.focus({ preventScroll: true });
    }

    function getVisibleRows() {
      return rows.filter((row) => !row.hidden);
    }

    function applyFilter(filter) {
      filters.forEach((button) => {
        button.classList.toggle('is-active', button.dataset.projectFilter === filter);
      });

      rows.forEach((row) => {
        row.hidden = filter !== 'all' && row.dataset.projectCategory !== filter;
      });

      const visibleRows = getVisibleRows();
      if (emptyState) emptyState.hidden = visibleRows.length !== 0;

      const selectedRow = visibleRows.find((row) => row.dataset.projectId === selectedId);
      if (selectedRow) {
        setSelected(selectedRow);
      } else if (visibleRows[0]) {
        setSelected(visibleRows[0]);
      }
    }

    function injectBackButton() {
      const nav = document.createElement('div');
      nav.className = 'project-detail-nav';
      nav.innerHTML = `<button class="project-detail-back" type="button" data-project-back>${copy.back}</button>`;
      inspector.prepend(nav);
    }

    function openDetails(row) {
      if (!row) return;
      setSelected(row);

      // Reuse the existing rich detail renderer only when the user explicitly
      // opens a project. Normal selection no longer rebuilds the large inspector.
      bypassLegacyProjectClick = true;
      try {
        row.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        }));
      } finally {
        bypassLegacyProjectClick = false;
      }

      injectBackButton();
      root.classList.add('is-detail-open');
      inspector.classList.add('is-open');
      browser.setAttribute('aria-hidden', 'true');
      contentElement.scrollTop = 0;
      inspector.querySelector('[data-project-back]')?.focus({ preventScroll: true });
    }

    function closeDetails() {
      root.classList.remove('is-detail-open');
      inspector.classList.remove('is-open');
      browser.removeAttribute('aria-hidden');
      contentElement.scrollTop = 0;
      const selectedRow = rows.find((row) => row.dataset.projectId === selectedId);
      selectedRow?.focus({ preventScroll: true });
    }

    root.addEventListener('click', (event) => {
      if (bypassLegacyProjectClick) return;

      const backButton = event.target.closest('[data-project-back]');
      if (backButton) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeDetails();
        return;
      }

      const filterButton = event.target.closest('.project-filter[data-project-filter]');
      if (filterButton) {
        event.preventDefault();
        event.stopImmediatePropagation();
        applyFilter(filterButton.dataset.projectFilter || 'all');
        return;
      }

      const row = event.target.closest('.project-row[data-project-id]');
      if (row) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setSelected(row);
      }
    }, true);

    root.addEventListener('dblclick', (event) => {
      const row = event.target.closest('.project-row[data-project-id]');
      if (!row) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openDetails(row);
    }, true);

    root.addEventListener('keydown', (event) => {
      if (root.classList.contains('is-detail-open')) {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopImmediatePropagation();
          closeDetails();
        }
        return;
      }

      const row = event.target.closest('.project-row[data-project-id]');
      if (row && event.key === 'Enter') {
        event.preventDefault();
        event.stopImmediatePropagation();
        openDetails(row);
        return;
      }

      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const visibleRows = getVisibleRows();
      if (!visibleRows.length) return;

      const currentIndex = Math.max(0, visibleRows.findIndex((item) => item.dataset.projectId === selectedId));
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = (currentIndex + step + visibleRows.length) % visibleRows.length;
      event.preventDefault();
      event.stopImmediatePropagation();
      setSelected(visibleRows[nextIndex], true);
    }, true);

    applyFilter('all');
    setSelected(rows.find((row) => row.dataset.projectId === selectedId) || rows[0]);
  }

  const baseRender = render;
  render = function renderWithCompactProjects() {
    baseRender();
    enhanceProjectView();
  };

  enhanceProjectView();
})();
