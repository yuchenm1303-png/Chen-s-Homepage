(() => {
  const mount = async () => {
    if (document.querySelector('.studio-intro')) return;

    const styles = [
      './portal-content-v3.css?v=20260813-2',
      './portal-motion-v1.css?v=20260813-1',
      './portal-refine-v1.css?v=20260813-1',
      './portal-depth-v1.css?v=20260813-1'
    ];

    for (const href of styles) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }

    const hero = document.querySelector('.portal-title-copy > p:last-child');
    if (hero) hero.textContent = '从供应商链接到 Makro 草稿。先准备，再执行；每一步都可检查。';

    const details = document.querySelector('.utility-grid');
    if (!details) return;

    try {
      const response = await fetch('./portal-content-v4.html?v=20260813-1', { cache: 'no-store' });
      if (!response.ok) return;

      const holder = document.createElement('div');
      holder.innerHTML = await response.text();
      const nodes = Array.from(holder.children);
      const fragment = document.createDocumentFragment();
      nodes.forEach((node) => fragment.appendChild(node));
      details.parentNode.insertBefore(fragment, details.nextSibling);

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const sections = nodes.filter((node) => node.classList.contains('studio-reveal'));

      if (reducedMotion || !('IntersectionObserver' in window)) {
        sections.forEach((section) => section.classList.add('is-visible'));
        return;
      }

      document.documentElement.classList.add('studio-motion-ready');

      const revealObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) entry.target.classList.add('is-visible');
        }
      }, {
        root: null,
        rootMargin: '0px 0px -12% 0px',
        threshold: 0.08
      });

      const resetObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) entry.target.classList.remove('is-visible');
        }
      }, {
        root: null,
        rootMargin: '18% 0px 18% 0px',
        threshold: 0
      });

      sections.forEach((section) => {
        revealObserver.observe(section);
        resetObserver.observe(section);
      });
    } catch (_) {}
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
