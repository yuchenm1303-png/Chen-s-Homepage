(() => {
  const SCAN_API = "https://nfzkphjbelyltrzgkdwt.supabase.co/functions/v1/lead-radar-scan";
  const API = "https://nfzkphjbelyltrzgkdwt.supabase.co/functions/v1/lead-radar-api";
  let currentFilter = "stored";
  let latestPosts = [];
  let latestResult = null;
  let latestFailure = "";
  let feedbackByKey = new Map();
  let feedbackLoading = false;
  let feedbackLoadedAt = 0;
  let feedbackSnapshot = null;
  let scanSnapshot = null;
  let loadInFlight = false;

  const decisionMeta = {
    stored: { label: "通过 · 潜客", className: "is-stored" },
    filtered: { label: "已过滤", className: "is-filtered" },
    seen: { label: "已处理", className: "is-seen" },
    duplicate: { label: "已处理", className: "is-seen" },
    error: { label: "需复核", className: "is-error" },
    unknown: { label: "待判断", className: "is-unknown" },
  };

  const feedbackMeta = {
    lead: { label: "真潜客", className: "is-human-lead" },
    maybe: { label: "可能", className: "is-human-maybe" },
    not_lead: { label: "不是", className: "is-human-not-lead" },
  };

  const reasonMeta = {
    provider_self_promo: "服务商",
    tutorial_content: "教程内容",
    recruiting: "招聘",
    learning: "学习",
    general_discussion: "普通讨论",
    other: "其他",
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function friendlyError(value) {
    const text = String(value || "").trim();
    if (/INSUFFICIENT BALANCE|business code 601/i.test(text)) return "Just One 余额不足，本次请求没有返回任何帖子。";
    return text || "本次扫描失败，没有返回可预览帖子。";
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
    const rows = [["赞", metrics.likes], ["评", metrics.comments], ["藏", metrics.collects], ["转", metrics.shares]];
    return rows.filter(([, value]) => value !== null && value !== undefined).map(([label, value]) => `${label} ${value}`);
  }

  function normalizeImageUrl(value) {
    if (!value) return "";
    try {
      const url = new URL(String(value));
      if (!["http:", "https:"].includes(url.protocol)) return "";
      let href = url.href;
      if (/xhscdn\.com$/i.test(url.hostname) || /\.xhscdn\.com$/i.test(url.hostname)) {
        href = href.replace(/\/format\/heif(?=\/|&|$)/gi, "/format/webp");
        href = href.replace(/format=heif/gi, "format=webp");
      }
      return href;
    } catch {
      return "";
    }
  }

  function normalizedImages(images) {
    const result = [];
    const seen = new Set();
    for (const raw of Array.isArray(images) ? images : []) {
      const url = normalizeImageUrl(raw);
      if (!url) continue;
      let key = url;
      try {
        const parsed = new URL(url);
        key = `${parsed.origin}${parsed.pathname}`;
      } catch {}
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(url);
      if (result.length >= 9) break;
    }
    return result;
  }

  function createRemoteImage(url, alt, className = "") {
    const image = document.createElement("img");
    image.src = url;
    image.alt = alt || "帖子图片";
    image.loading = "lazy";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    if (className) image.className = className;
    return image;
  }

  function feedbackKey(post) {
    const source = String(post?.source || "小红书").trim();
    const id = String(post?.id || "").trim();
    return source && id ? `${source}|${id}` : "";
  }

  function feedbackFor(post) {
    const key = feedbackKey(post);
    return key ? feedbackByKey.get(key) || null : null;
  }

  function feedbackFingerprint(map) {
    return JSON.stringify([...map.entries()]
      .map(([key, row]) => [
        key,
        String(row?.label || ""),
        String(row?.reason_code || ""),
        String(row?.updated_at || row?.created_at || ""),
      ])
      .sort((left, right) => left[0].localeCompare(right[0])));
  }

  function scanFingerprint(data) {
    const latest = data?.latest_request || null;
    const active = data?.active_request || null;
    return JSON.stringify({
      latest: latest ? {
        id: latest.id || null,
        status: latest.status || null,
        started_at: latest.started_at || null,
        finished_at: latest.finished_at || null,
        error: latest.error || null,
        result: latest.result || null,
      } : null,
      active: active ? {
        id: active.id || null,
        status: active.status || null,
        error: active.error || null,
        result: active.result || null,
      } : null,
      last_scan: data?.last_scan || null,
    });
  }

  async function loadFeedback(force = false) {
    if (feedbackLoading) return false;
    if (!force && Date.now() - feedbackLoadedAt < 12000) return false;
    feedbackLoading = true;
    try {
      const response = await fetch(`${API}/api/v1/feedback?source=${encodeURIComponent("小红书")}&limit=500`, { cache: "no-store" });
      if (!response.ok) return false;
      const rows = await response.json();
      const next = new Map();
      for (const row of Array.isArray(rows) ? rows : []) {
        const source = String(row?.source || "").trim();
        const sourceId = String(row?.source_id || "").trim();
        if (source && sourceId) next.set(`${source}|${sourceId}`, row);
      }
      const nextSnapshot = feedbackFingerprint(next);
      const changed = nextSnapshot !== feedbackSnapshot;
      feedbackByKey = next;
      feedbackSnapshot = nextSnapshot;
      feedbackLoadedAt = Date.now();
      return changed;
    } catch {
      // Feedback is supplementary; preview remains usable if this read fails.
      return false;
    } finally {
      feedbackLoading = false;
    }
  }

  function feedbackFilterActive() {
    return currentFilter.startsWith("human_");
  }

  function updateReviewedCount() {
    const reviewed = latestPosts.filter((post) => Boolean(feedbackFor(post))).length;
    const reviewedNode = document.getElementById("scanPostsReviewed");
    if (reviewedNode) reviewedNode.textContent = `${reviewed}/${latestPosts.length} REVIEWED`;
  }

  function refreshFeedbackControls(post) {
    const key = feedbackKey(post);
    if (!key) return;
    document.querySelectorAll(".scan-feedback").forEach((wrapper) => {
      if (wrapper.dataset.feedbackKey !== key) return;
      const compact = wrapper.dataset.feedbackCompact === "true";
      wrapper.replaceWith(createFeedbackControls(post, compact));
    });
  }

  function refreshFeedbackUI() {
    if (feedbackFilterActive()) {
      renderPosts();
      return;
    }
    latestPosts.forEach(refreshFeedbackControls);
    updateReviewedCount();
  }

  async function submitFeedback(post, label, reasonCode = null, trigger = null) {
    const key = feedbackKey(post);
    if (!key || !feedbackMeta[label]) return;
    if (label === "not_lead" && !reasonMeta[reasonCode]) return;
    if (trigger) trigger.disabled = true;
    try {
      const response = await fetch(`${API}/api/v1/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: String(post?.source || "小红书"),
          source_id: String(post?.id || ""),
          label,
          reason_code: label === "not_lead" ? reasonCode : null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.detail || `API ${response.status}`);
      const saved = data?.feedback || {
        source: String(post?.source || "小红书"),
        source_id: String(post?.id || ""),
        label,
        reason_code: label === "not_lead" ? reasonCode : null,
      };
      feedbackByKey.set(key, saved);
      feedbackSnapshot = feedbackFingerprint(feedbackByKey);
      feedbackLoadedAt = Date.now();
      post.__reasonOpen = label === "not_lead";
      if (feedbackFilterActive()) renderPosts();
      else {
        refreshFeedbackControls(post);
        updateReviewedCount();
      }
      if (typeof window.loadLeads === "function") window.loadLeads({ silent: true });
      const suffix = label === "not_lead" && reasonCode ? ` · ${reasonMeta[reasonCode]}` : "";
      showToast(`人工判断已保存：${feedbackMeta[label].label}${suffix}`);
    } catch (error) {
      showToast(`保存失败：${error?.message || "请稍后重试"}`);
    } finally {
      if (trigger) trigger.disabled = false;
    }
  }

  function createFeedbackControls(post, compact = false) {
    const wrapper = el("div", `scan-feedback${compact ? " is-compact" : ""}`);
    const key = feedbackKey(post);
    if (key) wrapper.dataset.feedbackKey = key;
    wrapper.dataset.feedbackCompact = compact ? "true" : "false";
    wrapper.addEventListener("click", (event) => event.stopPropagation());
    wrapper.addEventListener("keydown", (event) => event.stopPropagation());

    const current = feedbackFor(post);
    const top = el("div", "scan-feedback-top");
    top.append(el("span", "scan-feedback-label", "人工判断"));
    if (current?.label && feedbackMeta[current.label]) {
      const currentMeta = feedbackMeta[current.label];
      const currentText = current.label === "not_lead" && current.reason_code && reasonMeta[current.reason_code]
        ? `${currentMeta.label} · ${reasonMeta[current.reason_code]}`
        : currentMeta.label;
      top.append(el("span", `scan-feedback-current ${currentMeta.className}`, currentText));
    } else {
      top.append(el("span", "scan-feedback-current", "未标注"));
    }
    wrapper.append(top);

    const actions = el("div", "scan-feedback-actions");
    [["lead", "真潜客"], ["maybe", "可能"], ["not_lead", "不是"]].forEach(([label, text]) => {
      const button = el("button", `scan-feedback-button${current?.label === label ? " active" : ""}`, text);
      button.type = "button";
      button.dataset.feedbackLabel = label;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (label === "not_lead") {
          post.__reasonOpen = true;
          wrapper.querySelector(".scan-feedback-reasons")?.removeAttribute("hidden");
          return;
        }
        submitFeedback(post, label, null, button);
      });
      actions.append(button);
    });
    wrapper.append(actions);

    const reasons = el("div", "scan-feedback-reasons");
    if (!(post.__reasonOpen || current?.label === "not_lead")) reasons.hidden = true;
    Object.entries(reasonMeta).forEach(([code, text]) => {
      const button = el("button", `scan-feedback-reason${current?.reason_code === code ? " active" : ""}`, text);
      button.type = "button";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        submitFeedback(post, "not_lead", code, button);
      });
      reasons.append(button);
    });
    wrapper.append(reasons);
    return wrapper;
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
    heading.append(el("p", "radar-muted", "先在小卡片上快速标注质量；需要细看时点击卡片查看完整正文、图片与原帖。"));
    head.append(heading);

    const count = el("div", "scan-posts-count");
    const countStrong = el("strong", "", "0");
    countStrong.id = "scanPostsCount";
    const countUnit = el("span", "", "POSTS");
    const reviewed = el("span", "scan-posts-reviewed", "0 REVIEWED");
    reviewed.id = "scanPostsReviewed";
    count.append(countStrong, countUnit, reviewed);
    head.append(count);
    panel.append(head);

    const toolbar = el("div", "scan-posts-toolbar");
    [
      ["all", "全部"],
      ["human_unlabeled", "未标注"],
      ["human_lead", "真潜客"],
      ["human_maybe", "可能"],
      ["human_not_lead", "不是"],
      ["stored", "系统通过"],
      ["filtered", "系统过滤"],
      ["seen", "已处理"],
    ].forEach(([key, label]) => {
      const button = el("button", `release-badge scan-post-filter${key === currentFilter ? " active" : ""}`, label);
      button.type = "button";
      button.dataset.filter = key;
      button.addEventListener("click", () => {
        currentFilter = key;
        toolbar.querySelectorAll(".scan-post-filter").forEach((item) => item.classList.toggle("active", item.dataset.filter === key));
        renderPosts();
      });
      toolbar.append(button);
    });
    panel.append(toolbar);

    const body = el("div", "scan-posts-list");
    body.id = "scanPostsList";
    panel.append(body);
    feed.parentNode.insertBefore(panel, feed);
    return panel;
  }

  function ensureModal() {
    let layer = document.getElementById("scanPostModal");
    if (layer) return layer;

    layer = el("div", "scan-post-modal-layer");
    layer.id = "scanPostModal";
    layer.hidden = true;
    layer.innerHTML = `
      <div class="scan-post-modal-mask" data-scan-post-close></div>
      <article class="cards scan-post-modal-card" role="dialog" aria-modal="true" aria-labelledby="scanPostModalTitle">
        <button class="scan-post-modal-close" type="button" aria-label="关闭" data-scan-post-close>×</button>
        <div id="scanPostModalContent"></div>
      </article>`;
    document.body.append(layer);
    layer.querySelectorAll("[data-scan-post-close]").forEach((node) => node.addEventListener("click", closePostModal));
    return layer;
  }

  function closePostModal() {
    const layer = document.getElementById("scanPostModal");
    if (!layer) return;
    layer.hidden = true;
    document.body.classList.remove("scan-post-modal-open");
  }

  function openPostModal(post) {
    const layer = ensureModal();
    const content = document.getElementById("scanPostModalContent");
    if (!layer || !content) return;
    content.replaceChildren();

    const decision = String(post?.decision || "unknown");
    const meta = decisionMeta[decision] || decisionMeta.unknown;
    const header = el("div", "scan-post-modal-head");
    const identity = el("div", "scan-post-modal-identity");
    identity.append(el("strong", "", post?.author?.nickname || "小红书公开用户"));
    identity.append(el("span", "", formatTime(post?.published_at)));
    header.append(identity, el("span", `release-badge scan-post-decision ${meta.className}`, meta.label));
    content.append(header);

    const title = el("h2", "scan-post-modal-title", post?.title || "无标题");
    title.id = "scanPostModalTitle";
    content.append(title);

    const images = normalizedImages(post?.images);
    if (images.length) {
      const gallery = el("div", "scan-post-modal-images");
      images.forEach((url, index) => {
        const holder = el("a", "scan-post-modal-image");
        holder.href = url;
        holder.target = "_blank";
        holder.rel = "noopener noreferrer";
        const image = createRemoteImage(url, `${post?.title || "帖子图片"} ${index + 1}`);
        image.addEventListener("error", () => holder.classList.add("is-image-failed"));
        holder.append(image, el("span", "scan-post-image-fallback", "图片暂不可预览"));
        gallery.append(holder);
      });
      content.append(gallery);
    }

    const body = el("div", "scan-post-modal-body", post?.body || "（正文为空）");
    content.append(body);

    const metaRow = el("div", "scan-post-modal-meta");
    metricText(post?.metrics).forEach((text) => metaRow.append(el("span", "", text)));
    (Array.isArray(post?.tags) ? post.tags : []).slice(0, 12).forEach((tag) => metaRow.append(el("span", "scan-post-tag", `#${tag}`)));
    content.append(metaRow);
    content.append(createFeedbackControls(post, false));

    if (post?.url) {
      const link = el("a", "radar-action is-primary scan-post-modal-link", "打开小红书原帖 ↗");
      link.href = post.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      content.append(link);
    }

    layer.hidden = false;
    document.body.classList.add("scan-post-modal-open");
  }

  function createCover(post) {
    const cover = el("div", "scan-post-cover");
    const fallback = el("div", "scan-post-cover-fallback", "XHS");
    cover.append(fallback);
    const images = normalizedImages(post?.images);
    if (!images.length) {
      cover.classList.add("is-image-failed");
      return cover;
    }

    let index = 0;
    const image = createRemoteImage(images[index], post?.title || "帖子封面", "scan-post-cover-image");
    const tryNext = () => {
      index += 1;
      if (index < images.length) {
        image.src = images[index];
        return;
      }
      cover.classList.add("is-image-failed");
      image.remove();
    };
    image.addEventListener("load", () => cover.classList.add("is-image-ready"));
    image.addEventListener("error", tryNext);
    cover.append(image);
    return cover;
  }

  function createPostCard(post, index) {
    const card = el("article", "scan-post-card");
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `查看帖子：${post?.title || "无标题"}`);
    card.addEventListener("click", () => openPostModal(post));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openPostModal(post);
      }
    });

    const cover = createCover(post);
    const decision = String(post?.decision || "unknown");
    const meta = decisionMeta[decision] || decisionMeta.unknown;
    cover.append(el("span", `release-badge scan-post-decision scan-post-cover-badge ${meta.className}`, meta.label));
    card.append(cover);

    const content = el("div", "scan-post-card-content");
    const eyebrow = el("div", "scan-post-card-eyebrow");
    eyebrow.append(el("span", "", post?.author?.nickname || "小红书公开用户"), el("span", "", `${formatTime(post?.published_at)} · #${index + 1}`));
    content.append(eyebrow);
    content.append(el("h3", "scan-post-title", post?.title || "无标题"));
    content.append(el("p", "scan-post-body", post?.body || "（正文为空）"));
    content.append(createFeedbackControls(post, true));

    const footer = el("div", "scan-post-card-footer");
    const metrics = el("div", "scan-post-meta");
    metricText(post?.metrics).slice(0, 4).forEach((text) => metrics.append(el("span", "", text)));
    footer.append(metrics, el("span", "scan-post-detail-hint", "详情 ↗"));
    content.append(footer);
    card.append(content);
    return card;
  }

  function matchesCurrentFilter(post) {
    const decision = String(post?.decision || "unknown");
    const feedback = feedbackFor(post);
    if (currentFilter === "human_unlabeled") return !feedback;
    if (currentFilter === "human_lead") return feedback?.label === "lead";
    if (currentFilter === "human_maybe") return feedback?.label === "maybe";
    if (currentFilter === "human_not_lead") return feedback?.label === "not_lead";
    if (currentFilter === "seen") return ["seen", "duplicate"].includes(decision);
    return currentFilter === "all" || decision === currentFilter;
  }

  function renderPosts() {
    const panel = ensurePanel();
    const list = document.getElementById("scanPostsList");
    if (!panel || !list) return;

    const posts = latestPosts.filter(matchesCurrentFilter);
    document.getElementById("scanPostsCount").textContent = String(latestPosts.length);
    updateReviewedCount();
    list.replaceChildren();

    if (latestFailure) {
      list.append(el("div", "scan-post-empty", `${latestFailure} 这不是“筛选后为 0”，而是数据源没有返回内容。`));
      return;
    }
    if (!latestResult) {
      list.append(el("div", "scan-post-empty", "正在读取本次扫描帖子…"));
      return;
    }
    if (!latestPosts.length) {
      const scanned = Number(latestResult?.scanned || 0);
      const fresh = Number(latestResult?.fresh || 0);
      const message = scanned > 0
        ? `上一轮成功扫描抓到 ${scanned} 条、其中 ${fresh} 条为 24 小时内内容，但那一轮发生在帖子快照功能上线前，因此没有正文可恢复。`
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

  function applyScanState(data) {
    const latest = data?.latest_request || null;
    if (latest?.status === "failed") {
      latestFailure = friendlyError(latest.error);
      latestResult = latest.result || {};
      latestPosts = [];
      return;
    }
    latestFailure = "";
    latestResult = latest?.result || data?.active_request?.result || data?.last_scan || null;
    latestPosts = Array.isArray(latestResult?.posts) ? latestResult.posts : [];
  }

  async function load() {
    if (loadInFlight) return;
    loadInFlight = true;
    try {
      const response = await fetch(`${SCAN_API}/api/v1/status`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      const nextScanSnapshot = scanFingerprint(data);
      const scanChanged = nextScanSnapshot !== scanSnapshot;
      if (scanChanged) {
        scanSnapshot = nextScanSnapshot;
        applyScanState(data);
      }
      const feedbackChanged = await loadFeedback();
      if (scanChanged) renderPosts();
      else if (feedbackChanged) refreshFeedbackUI();
    } catch {
      // Keep the last stable preview on transient polling failures.
    } finally {
      loadInFlight = false;
    }
  }

  ensurePanel();
  ensureModal();
  renderPosts();
  load();
  window.setInterval(load, 5000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") load();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePostModal();
  });
})();