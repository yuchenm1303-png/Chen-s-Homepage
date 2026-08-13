(() => {
  const mount = async () => {
    if (document.querySelector('.studio-intro')) return;

    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = './portal-content-v3.css?v=20260813-1';
    document.head.appendChild(css);

    const hero = document.querySelector('.portal-title-copy > p:last-child');
    if (hero) {
      hero.textContent = '从供应商链接到 Makro 草稿。先准备，再执行；每一步都可检查。';
    }

    const details = document.querySelector('.utility-grid');
    if (!details) return;

    try {
      const response = await fetch('./portal-content-v3.html?v=20260813-1', { cache: 'no-store' });
      if (!response.ok) return;

      const holder = document.createElement('div');
      holder.innerHTML = await response.text();
      const nodes = Array.from(holder.children);
      nodes.forEach((node) => details.before(node));

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const sections = nodes.filter((node) => node.classList.contains('studio-reveal'));

      if (reducedMotion || !('IntersectionObserver' in window)) {
        sections.forEach((section) => section.classList.add('is-visible'));
        return;
      }

      document.documentElement.classList.add('studio-motion-ready');

      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }, {
        root: null,
        rootMargin: '0px 0px -12% 0px',
        threshold: 0.08,
      });

      sections.forEach((section) => observer.observe(section));
    } catch (_) {}
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
