(() => {
  'use strict';

  const STORAGE_KEY = 'smirel.language';
  const supported = new Set(['zh', 'en']);

  function safeStoredLanguage() {
    try {
      const value = window.localStorage.getItem(STORAGE_KEY);
      return supported.has(value) ? value : null;
    } catch (_) {
      return null;
    }
  }

  function requestedLanguage() {
    try {
      const value = new URLSearchParams(window.location.search).get('lang');
      return supported.has(value) ? value : null;
    } catch (_) {
      return null;
    }
  }

  const browserLanguage = String(
    navigator.languages?.[0] || navigator.language || ''
  ).toLowerCase();

  const current = requestedLanguage()
    || safeStoredLanguage()
    || (browserLanguage.startsWith('zh') ? 'zh' : 'en');

  const runtimeCopy = {
    zh: {
      switchTarget: 'EN',
      switchAria: '切换到英文',
      backGalaxy: 'Esc · 返回星空',
      backGalaxyShort: '← 星空',
      fieldSuffix: '星区',
      project: '项目',
      note: '文章',
      field: '栏目',
      profile: '关于',
      contact: '联系',
      detail: '详情',
      labels: {
        'In short': '简介',
        'Overview': '概览',
        'How it works': '实现',
        'What I built': '已完成',
        'Challenges': '难点',
        'Current result': '当前结果',
        'Stack': '技术栈',
        'Progress': '进度',
        'Next': '下一步',
        'Type': '类型',
        'Period': '时间',
        'Role': '负责',
        'Status': '状态',
        'DONE': '已完成',
        'ACTIVE': '进行中',
        'NEXT': '下一步',
      },
    },
    en: {
      switchTarget: '中文',
      switchAria: 'Switch to Chinese',
      backGalaxy: 'Esc · Back to galaxy',
      backGalaxyShort: '← Galaxy',
      fieldSuffix: 'Local field',
      project: 'Project',
      note: 'Note',
      field: 'Field',
      profile: 'Profile',
      contact: 'Contact',
      detail: 'detail',
      labels: {},
    },
  };

  const staticCopy = {
    en: {
      title: '邹羽宸 · Smirel',
      description: 'Smirel — personal homepage of 邹羽宸, covering electrical engineering, independent software projects, graphics, AI and simulation.',
      mainAria: 'Personal homepage of 邹羽宸',
      navAria: 'Site index',
      panelAria: 'Homepage section',
      profile: {
        kicker: 'Smirel / Home',
        role: 'Electrical Engineering & Automation',
        secondary: 'Independent developer · Chengdu',
        copy: 'I build software, interfaces and engineering tools.',
        meta: '22 · He/Him',
      },
      index: {
        heading: 'Explore',
        about: ['About', 'Who I am'],
        projects: ['Projects', 'Things I build'],
        notes: ['Blog', 'Notes & build logs'],
        contact: ['Contact', 'Ways to reach me'],
        hint: 'Pick a star to open a section. Hover to preview what’s inside.',
      },
      close: 'Close',
      about: {
        kicker: '01 / About',
        title: 'Engineering, code & side projects.',
        lede: 'I’m an Electrical Engineering & Automation student in Chengdu. I also build software and tools in my spare time.',
        body: 'This site keeps my projects, experiments and notes in one place: Android apps, AI tools, graphics work and engineering simulation.',
        facts: [
          ['Based in', 'Chengdu'],
          ['Study', 'Electrical Engineering & Automation'],
          ['Work', 'Independent projects'],
          ['Focus', 'Software · Engineering · Graphics'],
        ],
      },
      projects: {
        kicker: '02 / Projects',
        title: 'Selected work',
        lede: 'A few projects I’m actively building or still maintaining.',
        subtitles: [
          'Android assistant with tools & screen control',
          'Marketplace listing automation',
          'Mobile UI automation with vision',
          'Realtime glass rendering experiments',
          'Realtime A-share market data API',
          'TCAD · heavy ion · temperature',
        ],
      },
      notes: {
        kicker: '03 / Blog',
        title: 'Notes & build logs.',
        lede: 'Debugging notes, project write-ups and things I wanted to keep for later.',
        titles: [
          'Building My Homepage',
          'OpenGL Liquid Glass',
          'Computer Use: Screen Automation',
          'GaN HEMT Numerical Stability',
        ],
      },
      contact: {
        kicker: '04 / Contact',
        title: 'Find me online.',
        lede: 'GitHub and email are the easiest ways to reach me.',
      },
    },
    zh: {
      title: '邹羽宸 · Smirel',
      description: '邹羽宸的个人主页，记录电气工程、独立开发、图形界面、AI 应用和工程仿真。',
      mainAria: '邹羽宸的个人主页',
      navAria: '主页导航',
      panelAria: '主页栏目',
      profile: {
        kicker: 'Smirel / 主页',
        role: '电气工程及其自动化',
        secondary: '独立开发 · 成都',
        copy: '平时做软件、界面，也折腾一些工程工具。',
        meta: '22 · He/Him',
      },
      index: {
        heading: '浏览',
        about: ['关于', '我是谁'],
        projects: ['项目', '我在做什么'],
        notes: ['博客', '笔记与开发记录'],
        contact: ['联系', '找到我'],
        hint: '选一颗主星进入栏目，悬停可以先看它周围的内容。',
      },
      close: '关闭',
      about: {
        kicker: '01 / 关于',
        title: '工程、代码和一些自己的项目。',
        lede: '我在成都读电气工程及其自动化，课余会做软件、工具和一些自己感兴趣的东西。',
        body: '这里放着我做过和正在做的项目、实验和笔记，包括 Android、AI、图形界面和工程仿真。',
        facts: [
          ['所在地', '成都'],
          ['专业', '电气工程及其自动化'],
          ['平时在做', '独立项目'],
          ['方向', '软件 · 工程 · 图形'],
        ],
      },
      projects: {
        kicker: '02 / 项目',
        title: '一些项目',
        lede: '这里放我还在做、或者仍然维护的几个项目。',
        subtitles: [
          'Android 助手、工具调用与屏幕操作',
          '电商商品上架自动化',
          '基于视觉的手机界面自动化',
          '实时液态玻璃渲染实验',
          'A 股实时行情数据服务',
          'TCAD · 重离子 · 温度',
        ],
      },
      notes: {
        kicker: '03 / 博客',
        title: '笔记与开发记录',
        lede: '调试记录、项目复盘，还有一些我觉得以后会想再看的东西。',
        titles: [
          '从零搭建个人主页',
          'OpenGL 液态玻璃',
          'Computer Use 操作闭环',
          'GaN HEMT 数值稳定性',
        ],
      },
      contact: {
        kicker: '04 / 联系',
        title: '找到我',
        lede: 'GitHub 和邮箱是最方便的联系方式。',
      },
    },
  };

  document.documentElement.lang = current === 'zh' ? 'zh-CN' : 'en';
  document.documentElement.dataset.language = current;

  const api = Object.freeze({
    current,
    isChinese: current === 'zh',
    t(key) {
      return runtimeCopy[current]?.[key] ?? runtimeCopy.en[key] ?? key;
    },
    kind(kind) {
      return runtimeCopy[current]?.[kind] ?? kind;
    },
    label(label) {
      return runtimeCopy[current]?.labels?.[label] ?? label;
    },
    set(next) {
      if (!supported.has(next) || next === current) return;
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch (_) {}

      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has('lang')) {
          url.searchParams.set('lang', next);
          window.location.assign(url.toString());
          return;
        }
      } catch (_) {}

      window.location.reload();
    },
    toggle() {
      this.set(current === 'zh' ? 'en' : 'zh');
    },
  });

  window.SmirelLanguage = api;

  function setText(element, value) {
    if (element && typeof value === 'string' && element.textContent !== value) {
      element.textContent = value;
    }
  }

  function applyStaticCopy() {
    const copy = staticCopy[current] || staticCopy.en;
    document.title = copy.title;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute('content', copy.description);

    document.querySelector('.home-overlay')?.setAttribute('aria-label', copy.mainAria);
    document.querySelector('.home-index')?.setAttribute('aria-label', copy.navAria);
    document.querySelector('.home-panel')?.setAttribute('aria-label', copy.panelAria);

    setText(document.querySelector('.home-kicker'), copy.profile.kicker);
    setText(document.querySelector('.home-role'), copy.profile.role);
    setText(document.querySelector('.home-role-secondary'), copy.profile.secondary);
    setText(document.querySelector('.home-copy'), copy.profile.copy);
    setText(document.querySelector('.home-profile-meta > span'), copy.profile.meta);

    setText(document.querySelector('.home-index-heading > p'), copy.index.heading);
    for (const [key, pair] of Object.entries({
      about: copy.index.about,
      projects: copy.index.projects,
      notes: copy.index.notes,
      contact: copy.index.contact,
    })) {
      const trigger = document.querySelector(`[data-home-panel="${key}"]`);
      setText(trigger?.querySelector('strong'), pair[0]);
      setText(trigger?.querySelector('small'), pair[1]);
    }
    const hint = document.querySelector('.home-index-hint');
    if (hint) {
      const marker = hint.querySelector('span')?.outerHTML || '<span aria-hidden="true">◎</span>';
      const next = `${marker} ${copy.index.hint}`;
      if (hint.innerHTML !== next) hint.innerHTML = next;
    }

    const close = document.querySelector('.home-panel-close');
    if (close) {
      close.setAttribute('aria-label', current === 'zh' ? '关闭栏目' : 'Close section');
      const symbol = close.querySelector('span')?.outerHTML || '<span>×</span>';
      const next = `${copy.close} ${symbol}`;
      if (close.innerHTML !== next) close.innerHTML = next;
    }

    const about = document.querySelector('[data-home-panel-view="about"]');
    setText(about?.querySelector('.home-panel-kicker'), copy.about.kicker);
    setText(about?.querySelector('h2'), copy.about.title);
    setText(about?.querySelector('.home-panel-lede'), copy.about.lede);
    setText(about?.querySelector('.home-panel-body'), copy.about.body);
    const factRows = [...(about?.querySelectorAll('.home-facts > div') || [])];
    factRows.forEach((row, index) => {
      const pair = copy.about.facts[index];
      if (!pair) return;
      setText(row.querySelector('dt'), pair[0]);
      setText(row.querySelector('dd'), pair[1]);
    });

    const projects = document.querySelector('[data-home-panel-view="projects"]');
    setText(projects?.querySelector('.home-panel-kicker'), copy.projects.kicker);
    setText(projects?.querySelector('h2'), copy.projects.title);
    setText(projects?.querySelector('.home-panel-lede'), copy.projects.lede);
    [...(projects?.querySelectorAll('.home-project-index .home-object-link small') || [])]
      .forEach((node, index) => setText(node, copy.projects.subtitles[index]));

    const notes = document.querySelector('[data-home-panel-view="notes"]');
    setText(notes?.querySelector('.home-panel-kicker'), copy.notes.kicker);
    setText(notes?.querySelector('h2'), copy.notes.title);
    setText(notes?.querySelector('.home-panel-lede'), copy.notes.lede);
    [...(notes?.querySelectorAll('.home-note-list .home-object-link > span') || [])]
      .forEach((node, index) => setText(node, copy.notes.titles[index]));

    const contact = document.querySelector('[data-home-panel-view="contact"]');
    setText(contact?.querySelector('.home-panel-kicker'), copy.contact.kicker);
    setText(contact?.querySelector('h2'), copy.contact.title);
    setText(contact?.querySelector('.home-panel-lede'), copy.contact.lede);
  }

  function ensureToggle() {
    let button = document.querySelector('.smirel-language-toggle');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'smirel-language-toggle';
      button.dataset.languageToggle = 'true';
      document.body.appendChild(button);
      button.addEventListener('click', () => api.toggle());
    }
    button.textContent = runtimeCopy[current].switchTarget;
    button.setAttribute('aria-label', runtimeCopy[current].switchAria);
    button.setAttribute('title', runtimeCopy[current].switchAria);
  }

  function currentFieldTitle() {
    const id = document.body?.dataset?.starField;
    if (!id) return '';
    const item = (window.__SMIREL_STELLAR_CATALOG__ || []).find((entry) => entry.id === id);
    return item?.title || '';
  }

  function translateRuntime(root = document) {
    if (current !== 'zh') return;

    root.querySelectorAll?.('.smirel-star-back').forEach((node) => {
      setText(node, runtimeCopy.zh.backGalaxy);
      node.setAttribute('aria-label', '返回星空');
    });

    root.querySelectorAll?.('.smirel-field-back').forEach((node) => {
      setText(node, runtimeCopy.zh.backGalaxyShort);
      node.setAttribute('aria-label', '返回星空');
    });

    root.querySelectorAll?.('.smirel-field-kicker').forEach((node) => {
      if (node.textContent.includes('/ LOCAL FIELD')) {
        setText(node, node.textContent.replace('/ LOCAL FIELD', `/ ${runtimeCopy.zh.fieldSuffix}`));
      }
    });

    root.querySelectorAll?.('.smirel-star-anchor').forEach((node) => {
      const kind = node.dataset.starKind || '';
      setText(node.querySelector('.smirel-star-anchor__label small'), api.kind(kind));
      const id = node.dataset.starId;
      const item = (window.__SMIREL_STELLAR_CATALOG__ || []).find((entry) => entry.id === id);
      if (item?.title) node.setAttribute('aria-label', `打开${item.title}`);
    });

    root.querySelectorAll?.('.star-detail-back').forEach((node) => {
      const fieldTitle = currentFieldTitle();
      setText(node, fieldTitle ? `Esc · 返回 ${fieldTitle}` : runtimeCopy.zh.backGalaxy);
      node.setAttribute('aria-label', fieldTitle ? `返回 ${fieldTitle}` : '返回星空');
    });

    root.querySelectorAll?.('.star-detail-kicker, .stellar-article-eyebrow').forEach((node) => {
      const text = node.textContent.trim();
      if (text.startsWith('Project /')) setText(node, text.replace(/^Project\s*\//, '项目 /'));
      if (text.startsWith('Note /')) setText(node, text.replace(/^Note\s*\//, '文章 /'));
    });

    root.querySelectorAll?.('.project-archive-label, .project-archive-fact > span, .project-progress-list b')
      .forEach((node) => setText(node, api.label(node.textContent.trim())));

    root.querySelectorAll?.('.project-archive-object').forEach((node) => {
      const text = node.textContent;
      if (text.startsWith('Object ')) setText(node, text.replace(/^Object /, '项目 '));
    });

    root.querySelectorAll?.('.stellar-article-footer').forEach((node) => {
      if (node.textContent.includes(' · Blog')) {
        setText(node, node.textContent.replace(' · Blog', ' · 博客'));
      }
    });

    root.querySelectorAll?.('.star-detail-shell').forEach((node) => {
      const id = node.dataset.starId;
      const item = (window.__SMIREL_STELLAR_CATALOG__ || []).find((entry) => entry.id === id);
      if (item?.title) node.setAttribute('aria-label', `${item.title} 详情`);
    });
  }

  function applyAll(root = document) {
    applyStaticCopy();
    ensureToggle();
    translateRuntime(root);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyAll(), { once: true });
  } else {
    applyAll();
  }

  const observer = new MutationObserver((records) => {
    if (current !== 'zh') return;
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        translateRuntime(node);
      }
    }
    translateRuntime(document);
  });

  const startObserver = () => observer.observe(document.body, { childList: true, subtree: true });
  if (document.body) startObserver();
  else document.addEventListener('DOMContentLoaded', startObserver, { once: true });
})();
