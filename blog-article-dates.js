(() => {
  const articles = window.BlogArticles?.zh;
  if (!Array.isArray(articles)) return;

  const hiddenArticleIds = new Set(['computer-use-design']);
  const visibleArticles = articles.filter((article) => !hiddenArticleIds.has(article.id));
  articles.splice(0, articles.length, ...visibleArticles);

  const dateByArticleId = {
    'opengl-liquid-glass': '2026-05-07',
    'gan-hemt-stability': '2026-03-07'
  };

  articles.forEach((article) => {
    const nextDate = dateByArticleId[article.id];
    if (nextDate) article.date = nextDate;

    if (typeof article.body === 'string') {
      article.body = article.body.replace(
        '在 AI 助手页面的当前兼容路径中',
        '在当前原生应用页面的兼容路径中'
      );
    }
  });
})();
