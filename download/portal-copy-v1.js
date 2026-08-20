(() => {
  const exact = new Map([
    ["登录后验证权限", "登录后验证权限"],
    ["仅已授权账户可下载最新版安装包。", "下载权限由账户授权状态决定。"],
    ["正在验证下载权限…", "正在验证访问权限…"],
    ["保持登录", "已登录"],
    ["已解锁", "可下载"],
    ["下载权限已过期", "权限已过期"],
    ["下载权限已停用", "权限已停用"],
    ["暂时无法验证权限", "权限验证失败"],
    ["账户未获下载权限", "未获下载权限"],
    ["登录服务尚未配置。", "登录服务不可用。"],
    ["登录服务初始化失败，请稍后重试。", "登录服务暂不可用。"],
    ["登录服务初始化失败", "登录服务暂不可用"],
    ["登录服务尚未就绪", "登录服务暂不可用"],
    ["正在验证账户与下载权限…", "正在验证账户…"],
    ["登录成功，下载权限已解锁", "账户已验证，可下载"],
    ["登录成功，但下载权限已过期", "账户已验证，下载权限已过期"],
    ["登录成功，但下载权限已停用", "账户已验证，下载权限已停用"],
    ["登录成功，但权限验证失败", "账户已验证，权限验证失败"],
    ["登录成功，但账户尚未获得下载权限", "账户已验证，未获下载权限"],
    ["邮箱或密码错误，请重试。", "邮箱或密码不正确。"],
    ["当前账户没有有效下载权限", "当前账户无有效下载权限"],
    ["正在生成安全链接…", "正在准备下载…"],
    ["最新版安装包尚未发布", "当前版本安装包暂不可用"],
    ["暂时无法生成下载链接", "下载服务暂不可用"],
    ["正在确认最新正式版本…", "正在确认正式版本…"],

    ["当前正式版本的核心变化。这里会跟随后续发布版本持续更新。", "当前版本变更记录。"],
    ["安装前建议确认以下基础环境，避免首次启动时缺少浏览器运行时或系统组件。", "安装前请确认系统环境符合以下要求。"],
    ["Makro 浏览器自动化依赖本机 Microsoft Edge。正式安装包发布后，这里还会显示准确的安装包大小与校验信息。", "Listing Studio 使用本机 Microsoft Edge 运行浏览器自动化。"],
    ["如果安装、登录或启动出现问题，可以先按下面三个方向快速排查。", "安装、登录或启动异常时，请按以下项目检查。"],
    ["确认 Windows 为 x64，并重新下载安装包后以普通用户方式启动安装。", "确认系统为 Windows x64；安装包异常时请重新下载。"],
    ["确认邮箱与密码正确。登录成功后，系统还会继续验证该账户是否具有下载权限。", "确认账户信息正确。登录后系统将继续验证下载权限。"],
    ["确认 Microsoft Edge 可正常打开，并检查系统是否拦截了首次运行。", "确认 Microsoft Edge 可正常运行，并检查 Windows 安全策略是否限制程序启动。"],

    ["这里列出仍保留正式 Windows 安装包的历史 Stable 版本。需要回退或兼容测试时可以直接下载。", "已保留安装包的 Windows 正式版本。"],
    ["暂时没有可下载的历史版本。", "暂无可下载的历史版本。"],
    ["历史版本不会替代当前 Stable 推荐版本；除非需要回退排查，通常建议使用最新版。", "默认推荐当前 Stable 版本。历史版本用于回退与兼容性验证。"],
    ["正在读取历史 Stable 版本…", "正在加载版本记录…"],
    ["暂时无法读取历史版本，请稍后重试。", "版本记录暂不可用。"],
    ["生成中…", "处理中…"],
    ["请先登录后下载历史版本", "请先登录"],
    ["登录状态已失效，请重新登录", "登录状态已失效"],
    ["这个历史版本当前不可下载", "该版本当前不可下载"],
    ["暂时无法生成历史版本下载链接", "下载服务暂不可用"],
    ["这个历史版本没有可用安装包", "该版本无可用安装包"],
    ["暂时无法下载历史版本", "下载服务暂不可用"],

    ["注册 Listing Studio 账号", "创建账户"],
    ["创建账号", "创建账户"],
    ["先创建登录账号。账号创建成功后仍需要管理员授权，未授权账号不能下载或运行正式安装版。", "创建账户后仍需获得软件授权。未授权账户无法下载或运行正式版本。"],
    ["注册账号与软件授权是两件事。注册只建立登录身份；管理员授权后，账号才获得下载、应用启动和更新权限。默认普通账号最多激活 2 台设备。", "账户创建与软件授权相互独立。获得授权后可使用下载、启动与更新功能。标准账户最多激活 2 台设备。"],
    ["账号服务尚未就绪。", "账户服务暂不可用。"],
    ["正在创建账号…", "正在创建账户…"],
    ["账号已创建。当前账号尚未获得软件授权，请等待管理员授权。", "账户已创建。软件授权尚未生效。"],
    ["账号申请已提交。请先检查邮箱完成验证，然后等待管理员授权。", "账户申请已提交。请完成邮箱验证。软件授权将单独生效。"],
    ["账号已创建，仍需管理员授权", "账户已创建，等待授权"],
    ["这个邮箱可能已经注册，请直接登录或使用“忘记密码”。", "该邮箱可能已注册。请直接登录或重设密码。"],
    ["暂时无法创建账号，请稍后重试。", "账户创建失败。"],

    ["重设登录密码", "重设密码"],
    ["输入注册邮箱获取一次性验证码。验证码不会被 QQ 等邮箱的安全链接扫描提前消费。", "输入注册邮箱获取一次性验证码。"],
    ["验证并保存新密码", "保存新密码"],
    ["发送成功后 60 秒内不能重复发送；刷新页面也会保留剩余时间。验证码验证成功后才允许修改密码。", "验证码发送后 60 秒内不可重复发送。验证通过后可设置新密码。"],
    ["正在发送密码重设验证码…", "正在发送验证码…"],
    ["如果该邮箱已注册，验证码已经发送。请查看最新一封 Listing Studio 邮件。", "若该邮箱已注册，验证码将发送至对应邮箱。"],
    ["输入邮件中的验证码，再设置新密码。", "输入验证码并设置新密码。"],
    ["密码重设验证码已请求发送", "验证码已发送"],
    ["发送过于频繁，请等待倒计时结束后再试。", "请求频率过高。请在倒计时结束后重试。"],
    ["请等待倒计时结束后再发送", "请在倒计时结束后重试"],
    ["暂时无法发送验证码，请稍后重试。", "验证码发送失败。"],
    ["正在验证验证码…", "正在验证验证码…"],
    ["新密码已保存。网站和 Listing Studio 正式安装版都使用这个账号密码登录。", "新密码已保存。网站与客户端使用同一账户密码。"],
    ["验证码无效或已过期，请等待倒计时结束后重新发送。", "验证码无效或已过期。请重新获取验证码。"],
    ["暂时无法完成密码重设，请稍后重试。", "密码重设失败。"],
    ["检测到旧式密码重设链接。若链接被邮箱安全扫描提前访问，请关闭此窗口，使用“忘记密码”中的验证码方式重设。", "当前密码重设链接已停用。请使用验证码方式重设密码。"],
    ["正在确认密码重设会话…", "正在验证重设会话…"],
    ["新密码已保存。以后网站和 Listing Studio 正式安装版都使用这个账号密码登录。", "新密码已保存。网站与客户端使用同一账户密码。"],
    ["旧式链接会话已失效。请关闭此窗口，使用“忘记密码”重新发送验证码。", "当前重设链接已失效。请使用验证码方式重设密码。"],
    ["重设会话已验证，可以设置新密码。", "重设会话已验证。"],
    ["未检测到有效重设会话，请改用验证码方式重设。", "当前重设会话无效。请使用验证码方式重设密码。"],
    ["已退出当前账户，请登录其他账户。", "当前账户已退出。"]
  ]);

  const phrases = [
    [/管理员授权/g, "软件授权"],
    [/管理员开通/g, "软件授权"],
    [/等待管理员授权/g, "等待软件授权"],
    [/账号/g, "账户"],
    [/稍后再试/g, "请稍后重试"],
    [/看看/g, "查看"],
    [/还没准备好/g, "暂不可用"]
  ];

  function rewrite(value) {
    const raw = String(value ?? "");
    const trimmed = raw.trim();
    if (!trimmed) return raw;
    let next = exact.get(trimmed) ?? trimmed;
    for (const [pattern, replacement] of phrases) next = next.replace(pattern, replacement);
    return next === trimmed ? raw : raw.replace(trimmed, next);
  }

  function rewriteText(node) {
    if (!(node instanceof Text)) return;
    const next = rewrite(node.nodeValue || "");
    if (next !== node.nodeValue) node.nodeValue = next;
  }

  function rewriteAttributes(element) {
    if (!(element instanceof Element)) return;
    for (const name of ["aria-label", "placeholder", "title"]) {
      if (!element.hasAttribute(name)) continue;
      const current = element.getAttribute(name) || "";
      const next = rewrite(current);
      if (next !== current) element.setAttribute(name, next);
    }
  }

  function rewriteTree(root) {
    if (!root) return;
    if (root instanceof Text) {
      rewriteText(root);
      return;
    }
    if (root instanceof Element) rewriteAttributes(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node instanceof Text) rewriteText(node);
      else rewriteAttributes(node);
    }
  }

  document.title = "Listing Studio for Windows";
  rewriteTree(document.body);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData") rewriteText(mutation.target);
      if (mutation.type === "attributes") rewriteAttributes(mutation.target);
      for (const node of mutation.addedNodes) rewriteTree(node);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["aria-label", "placeholder", "title"]
  });
})();
