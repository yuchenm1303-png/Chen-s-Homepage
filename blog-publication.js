(() => {
  const articles = window.BlogArticles;
  if (!articles) return;

  const unpublishedArticleIds = new Set(['building-homepage']);

  ['zh', 'en'].forEach((lang) => {
    if (!Array.isArray(articles[lang])) return;
    articles[lang] = articles[lang].filter((article) => !unpublishedArticleIds.has(article.id));
  });

  if (location.hash === '#/blog/building-homepage') {
    history.replaceState({}, '', '#/blog');
  }
})();
