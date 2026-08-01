# Chen's Homepage

一个原创的复古个人主页：Windows 95/98 窗口、梦核粉色云层、像素素材、CRT 扫描线和中英文切换。

## 当前内容

- About / Projects / Blog / Contact 四个栏目
- 中文与英文切换
- 最小化、最大化、关闭与重新打开窗口
- 桌面快捷方式、任务栏与时钟
- 原创 SVG 像素头像、像素猫和应用图标
- 桌面、iPad、手机响应式布局
- GitHub Pages 自动部署工作流

## 修改个人信息

主要文字内容位于 `script.js`：

- 姓名和个人简介：搜索 `Jack`
- GitHub：搜索 `github.com/yuchenm1303-png`
- 邮箱：搜索 `your-email@example.com`
- 简历：搜索 `resume.pdf`
- 项目与博客：修改 `sections.projects` 和 `sections.blog`

图片位于 `assets/`：

- `avatar.svg`：头像
- `cat.svg`：窗口顶部像素猫
- `icon.svg`：窗口和网站图标

## 部署到 GitHub Pages

仓库已经包含 `.github/workflows/deploy-pages.yml`。

首次部署时，在 GitHub 仓库中进入：

`Settings → Pages → Build and deployment → Source → GitHub Actions`

保存后，打开 `Actions` 页面运行 **Deploy homepage to GitHub Pages**，或向 `main` 分支提交一次修改。

部署完成后的默认地址通常为：

`https://yuchenm1303-png.github.io/Chen-s-Homepage/`

## 本地预览

这是纯静态网站，可以直接打开 `index.html`。为避免浏览器对本地资源的限制，也可以使用任意静态文件服务器预览。
