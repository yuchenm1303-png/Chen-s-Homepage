# Smirel's Homepage

一个原创的复古个人主页：Windows 95/98 窗口、梦核粉色云层、像素素材、CRT 扫描线和中英文切换。

## 当前内容

- About / Projects / Blog / Contact 四个栏目
- 中文与英文切换
- 最小化、最大化、关闭与重新打开窗口
- 任务栏与时钟
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

## 复古渲染层

`retro-authentic.css` 是最后加载的一层，负责把界面统一到 90 年代的渲染规则上：
硬边（不用模糊与辉光）、抖动（2px 棋盘格模拟色深不足）、有限调色板（渐变分成
可数的色带）。整层删掉即可回到之前的外观，不影响其它样式文件。

其中有两处约定不要随手改动：

- 字号只用 12px 和 10px 两档（大标题 24px）。点阵字按固定网格设计，字号一旦不是
  网格尺寸就会被插值，边缘立刻发灰，所以正文走 12px 的字模、次级文字走 10px 的
  字模，而不是把同一套字模缩放。层级由字号和颜色承担，不要改用 font-weight ——
  方舟像素没有真正的粗体字重，合成粗体会把抗锯齿带回来。
- 滚动条区域先把 `scrollbar-color` / `scrollbar-width` 还原成 `auto`。只要这两个
  标准属性有值，Chrome 就会忽略全部 `::-webkit-scrollbar-*` 规则，复古滚动条不会出现。

## 字体

中文点阵字使用 [方舟像素字体 Ark Pixel](https://github.com/TakWolf/ark-pixel-font)
（proportional zh_cn），授权为 SIL Open Font License 1.1，许可全文见
`assets/fonts/OFL.txt`。仓库内收录了 12px 与 10px 两个字号的裁剪版，
收录范围都是「站内实际用字 + GB2312 一级字（3755 个常用字）」，合计约 118 KB。

关于高分屏：这里刻意不做字号补偿。dpr 1.5 要让字模落在整数像素格上得把字号提到
16px，但那样整个界面会比设计尺寸大三分之一。清晰度和比例在分数倍 dpr 上无法兼得，
这里选比例。

若日后新增了不在该范围内的生僻字，它会回退到系统宋体。需要补字时重新子集化即可：

```bash
pyftsubset ark-pixel-12px-proportional-zh_cn.otf.woff2   --text-file=chars.txt --flavor=woff2 --layout-features='*'   --output-file=assets/fonts/ark-pixel-12px-zh_cn-subset.woff2
```

---

Deployment trigger: 2026-08-01 19:16 (UTC+8)
