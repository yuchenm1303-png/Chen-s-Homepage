(() => {
  const mount = async () => {
    if (document.querySelector('.product-story')) return;
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = './portal-content-v2.css?v=20260813-1';
    document.head.appendChild(css);
    const hero = document.querySelector('.portal-title-copy > p:last-child');
    if (hero) hero.textContent = 'Listing Studio 是面向 Makro Seller Center 的商品采集、AI 字段规划与浏览器上架工作区。单链接或批量商品，都从同一套受控流程进入草稿。';
    const details = document.querySelector('.utility-grid');
    if (!details) return;
    try {
      const response = await fetch('./portal-content-v2.html?v=20260813-1', { cache: 'no-store' });
      if (!response.ok) return;
      const holder = document.createElement('div');
      holder.innerHTML = await response.text();
      Array.from(holder.children).forEach((node) => details.before(node));
    } catch (_) {}
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
