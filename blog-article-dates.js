(() => {
  const dateByArticleId = {
    'opengl-liquid-glass': '2026-05-07',
    'computer-use-design': '2026-06-23',
    'gan-hemt-stability': '2026-03-07'
  };

  const articles = window.BlogArticles?.zh;
  if (!Array.isArray(articles)) return;

  articles.forEach((article) => {
    const nextDate = dateByArticleId[article.id];
    if (nextDate) article.date = nextDate;
  });
})();
