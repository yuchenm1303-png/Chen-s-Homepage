(() => {
  const SCAN_API = "https://nfzkphjbelyltrzgkdwt.supabase.co/functions/v1/lead-radar-scan";
  let currentFilter = "all";
  let latestPosts = [];
  let latestResult = null;

  const decisionMeta = {
    stored: { label: "通过 · 潜客", className: "is-stored" },
    filtered: { label: "已过滤", className: "is-filtered" },
    seen: { label: "已处理", className: "is-seen" },
    error: { label: "需复核", className: "is-error" },
    unknown: { label: "待判断", className: "is-unknown" },
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function formatTime(value) {
    if (!value) return "时间未知";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "时间未知";
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
      hour12: false,
    }).format(date);
  }

  function metricText(metrics) {
    if (!metrics || typeof metrics !== "object") return [];
    const rows = [
      ["赞", metrics.likes],
      ["评", metrics.comments],
      ["藏", metrics.collects],
      ["转", metrics.shares],
    ];
    return rows.filter(([, value]) => value !== null && value !== undefined).map(([label, value]) => `${label} ${value}`);
  }

  function ensurePanel() {
    let panel = document.getElementById("scanPostsPanel");
    if (panel) return panel;
    const feed = document.getElementById("opportunities");
    if (!feed?.parentNode) return null;

    panel = el("section", "release-card cards fade scan-posts-panel");
    panel.id = "scanPostsPanel";

    const head = el("div", "scan-posts-head");
    const heading = el("div");
    heading.append(el("p", "kicker", "SCAN REVIEW"));
    heading.append(el("h2", "", "本次扫描帖子"));
    heading.append(el("p", "radar-muted", "这里展示本次扫描抓到的公开帖子原文，用来人工判断数据源与筛选质量。"));
    head.append(heading);

    const count = el("div", "scan-posts-count");
    count.append(el("strong", "", "0"));
    count.querySelector("strong").id = "scanPostsCount";
    count.append(el("span", "", "POSTS"));
    head.append(count);
    panel.append(head);

    const toolbar = el("div", "scan-posts-toolbar");
    const filters = [
      ["all", "全部"],
      ["stored", "通过"],
      ["filtered", "已过滤"],
      ["seen", "已处理"],
    ];
    for (const [key, label] of filters) {
      const button = el("button", `release-badge scan-post-filter${key === "all" ? " active" : ""}`, label);
      button.type = "button";
      button.dataset.filter = key;
      button.addEventListener("click", () => {
        currentFilter = key;
        toolbar.querySelectorAll(".scan-post-filter").forEach((item) => item.classList.toggle("active", item.dataset.filter === key));
        renderPosts();
      });
      toolbar.append(button);
    }
    panel.append(toolbar);

    const body = el("div", "scan-posts-list");
    body.id = "scanPostsList";
    panel.append(body);

    feed.parentNode.insertBefore(panel, feed);
    return panel;
  }

  function createImageGallery(images, title) {
    const urls = Array.isArray(images) ? images.filter(Boolean).slice(0, 9) : [];
    if (!urls.length) return null;
    const gallery = el("div", `scan-post-images count-${Math.min(urls.length, 4)}`);
    urls.forEach((url, index) => {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      const image = document.createElement("img");
      image.src = url;
      image.alt = `${title || "帖子图片"} ${index + 1}`;
      image.loading = "lazy";
      image.decoding = "async";
      image.addEventListener("error", () => link.remove());
      link.append(image);
      gallery.append(link);
    });
    return gallery;
  }

  function createPostCard(post, index) {
    const card = el("article", "scan-post-card");
    const top = el("div", "scan-post-top");

    const identity = el("div", "scan-post-identity");
    if (post?.author?.avatar) {
      const avatar = document.createElement("img");
      avatar.src = post.author.avatar;
      avatar.alt = "";
      avatar.loading = "lazy";
      avatar.addEventListener("error", () => avatar.remove());
      identity.append(avatar);
    }
    const identityText = el("div");
    identityText.append(el("strong", "", post?.author?.nickname || "小红书公开用户"));
    identityText.append(el("span", "", `${formatTime(post?.published_at)} · #${index + 1}`));
    identity.append(identityText);
    top.append(identity);

    const decision = String(post?.decision || "unknown");
    const meta = decisionMeta[decision] || decisionMeta.unknown;
    top.append(el("span", `release-badge scan-post-decision ${meta.className}`, meta.label));
    card.append(top);

    card.append(el("h3", "scan-post-title", post?.title || "无标题"));

    const body = el("div", "scan-post-body");
    body.textContent = post?.body || "（正文为空）";
    card.append(body);

    const gallery = createImageGallery(post?.images, post?.title);
    if (gallery) card.append(gallery);

    const footer = el("div", "scan-post-footer");
    const left = el("div", "scan-post-meta");
    metricText(post?.metrics).forEach((text) => left.append(el("span", "", text)));
    (Array.isArray(post?.tags) ? post.tags : []).slice(0, 8).forEach((tag) => left.append(el("span", "scan-post-tag", `#${tag}`)));
    footer.append(left);

    if (post?.url) {
      const link = el("a", "radar-action is-primary scan-post-link", "打开原帖 ↗");
      link.href = post.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      footer.append(link);
    }
    card.append(footer);
    return card;
  }

  function renderPosts() {
    const panel = ensurePanel();
    const list = document.getElementById("scanPostsList");
    if (!panel || !list) return;

    const posts = latestPosts.filter((post) => currentFilter === "all" || String(post?.decision || "unknown") === currentFilter);
    document.getElementById("scanPostsCount").textContent = String(latestPosts.length);
    list.replaceChildren();

    if (!latestResult) {
      list.append(el("div", "scan-post-empty", "正在读取本次扫描帖子…"));
      return;
    }

    if (!latestPosts.length) {
      const scanned = Number(latestResult?.scanned || 0);
      const fresh = Number(latestResult?.fresh || 0);
      const message = scanned > 0
        ? `这次历史扫描抓到 ${scanned} 条、其中 ${fresh} 条为 24 小时内内容，但当时后端还没有保存帖子正文快照。下一次扫描开始会在这里完整显示每条帖子。`
        : "当前还没有可预览的扫描帖子。";
      list.append(el("div", "scan-post-empty", message));
      return;
    }

    if (!posts.length) {
      list.append(el("div", "scan-post-empty", "当前筛选下没有帖子。"));
      return;
    }

    posts.forEach((post, index) => list.append(createPostCard(post, index)));
  }

  async function load() {
    try {
      const response = await fetch(`${SCAN_API}/api/v1/status`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      latestResult = data?.latest_request?.result || data?.active_request?.result || data?.last_scan || null;
      latestPosts = Array.isArray(latestResult?.posts) ? latestResult.posts : [];
      renderPosts();
    } catch {}
  }

  ensurePanel();
  renderPosts();
  load();
  window.setInterval(load, 10000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") load();
  });
})();
