(() => {
  const chineseName = "邹羽宸";

  content.zh.sections.about = content.zh.sections.about
    .replace('alt="Jack 的像素头像"', `alt="${chineseName}的像素头像"`)
    .replace('<h1 class="profile-name">Jack</h1>', `<h1 class="profile-name">${chineseName}</h1>`)
    .replaceAll("CHEN", "YUCHEN");

  content.en.sections.about = content.en.sections.about
    .replace('alt="Pixel portrait of Jack"', `alt="Pixel portrait of Zou Yuchen (${chineseName})"`)
    .replace('<h1 class="profile-name">Jack</h1>', `<h1 class="profile-name">${chineseName}</h1>`)
    .replaceAll("CHEN", "YUCHEN");

  document.title = `${chineseName}的个人主页`;
  const description = document.querySelector('meta[name="description"]');
  if (description) {
    description.setAttribute(
      "content",
      `${chineseName}的个人主页：电气工程、AI 应用、工程仿真与科研数据分析。`
    );
  }

  render();
})();
