(() => {
  const installBackgroundTone = () => {
    if (document.getElementById('portal-background-tone-v1')) return;

    const style = document.createElement('style');
    style.id = 'portal-background-tone-v1';
    style.textContent = `
      .cosmos { background: #495b8a; }
      .cosmos-sky {
        background: linear-gradient(
          180deg,
          #6a96b3 0%,
          #6287a6 25%,
          #586f99 47%,
          #5f668f 68%,
          #766292 86%,
          #4d5478 100%
        );
      }
      .cosmos-glow {
        background:
          radial-gradient(ellipse at 22% 18%, rgba(255,255,255,.17), transparent 42%),
          radial-gradient(ellipse at 76% 38%, rgba(169,243,239,.12), transparent 37%),
          radial-gradient(ellipse at 32% 85%, rgba(235,188,235,.10), transparent 44%);
      }
      .cosmos-nebula { opacity: .74; }
      .cosmos-vignette {
        box-shadow:
          inset 0 0 220px rgba(38,43,78,.36),
          inset 0 -140px 210px rgba(42,40,76,.31),
          inset 0 90px 160px rgba(255,255,255,.02);
      }
    `;
    document.head.appendChild(style);
  };

  const mount = async () => {
    installBackgroundTone();
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
