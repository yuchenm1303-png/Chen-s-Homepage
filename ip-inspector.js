/*
 * IP 检测器
 *
 * 桌面上的第一个「应用」。它不是关于我的一个栏目，所以不进左栏导航，
 * 而是挂在桌面图标上，打开时把窗口标题也换掉 —— 这样它读起来是一个被打开的程序，
 * 而不是主页的第五个页签。
 *
 * 挂载方式沿用 projects.js 已经建立的约定：往 content 字典里塞一个 section，
 * 再包一层 render。不改 script.js，也不动 HTML 的既有结构。
 */
(() => {
  'use strict';

  /*
   * 三个数据源按顺序尝试。全部实测支持 Access-Control-Allow-Origin: *，
   * 浏览器可直接调用，不需要后端中转：
   *   ipwho.is   字段最全（ASN / ISP / 组织 / 时区 / 经纬度），作主源
   *   ipinfo.io  字段够用，作备源
   *   ipify      只回 IP，最后兜底，至少保证主字段不空
   * 任何一家都可能限流或被网络环境挡掉，所以必须能退。
   */
  const SOURCES = [
    {
      name: 'ipwho.is',
      url: 'https://ipwho.is/',
      parse: (d) => {
        if (!d || d.success === false) return null;
        const c = d.connection || {};
        const tz = d.timezone || {};
        return {
          ip: d.ip,
          type: d.type,
          city: d.city,
          region: d.region,
          country: d.country,
          countryCode: d.country_code,
          asn: c.asn ? ('AS' + c.asn) : '',
          isp: c.isp || '',
          org: c.org || '',
          tzId: tz.id || '',
          tzUtc: tz.utc || '',
          lat: d.latitude,
          lon: d.longitude
        };
      }
    },
    {
      name: 'ipinfo.io',
      url: 'https://ipinfo.io/json',
      parse: (d) => {
        if (!d || !d.ip) return null;
        // ipinfo 把 ASN 和组织揉在一个 org 字段里，形如 "AS13335 Cloudflare, Inc."
        const org = d.org || '';
        const m = org.match(/^(AS\d+)\s+(.*)$/);
        const loc = (d.loc || '').split(',');
        return {
          ip: d.ip,
          type: d.ip.includes(':') ? 'IPv6' : 'IPv4',
          city: d.city,
          region: d.region,
          country: d.country,
          countryCode: d.country,
          asn: m ? m[1] : '',
          isp: m ? m[2] : org,
          org: m ? m[2] : org,
          tzId: d.timezone || '',
          tzUtc: '',
          lat: loc[0],
          lon: loc[1]
        };
      }
    },
    {
      name: 'ipify',
      url: 'https://api.ipify.org?format=json',
      parse: (d) => (d && d.ip)
        ? { ip: d.ip, type: d.ip.includes(':') ? 'IPv6' : 'IPv4' }
        : null
    }
  ];

  const TEXT = {
    zh: {
      shortcut: 'IP 检测器',
      appTitle: 'IP 检测器',
      title: '// IP 检测器',
      current: '当前 IP',
      probing: '检测中…',
      copy: '复制',
      copied: '已复制',
      refresh: '重新检测',
      failed: '三个数据源都没能取到结果。可能是网络受限或接口临时限流，稍后再试。',
      via: '数据源',
      groupNet: '网络',
      groupClient: '本机',
      groupCheck: '一致性',
      f: {
        type: '协议', location: '归属地', asn: 'ASN', isp: '运营商', org: '组织',
        tz: '时区', coord: '坐标',
        browser: '浏览器', os: '操作系统', screen: '屏幕', viewport: '视口',
        dpr: '像素比', sysTz: '系统时区', lang: '语言', cores: 'CPU 线程',
        memory: '内存', touch: '触摸', online: '网络状态'
      },
      yes: '支持', no: '不支持', on: '在线', off: '离线', unknown: '未知',
      tzMatch: 'IP 归属时区与系统时区一致',
      tzDiff: 'IP 归属时区与系统时区不一致，通常意味着正在经过代理或 VPN'
    },
    en: {
      shortcut: 'IP Inspector',
      appTitle: 'IP Inspector',
      title: '// IP INSPECTOR',
      current: 'Your IP',
      probing: 'Probing…',
      copy: 'Copy',
      copied: 'Copied',
      refresh: 'Re-check',
      failed: 'All three sources failed. The network may be restricted, or the APIs are rate limiting. Try again later.',
      via: 'Source',
      groupNet: 'Network',
      groupClient: 'This machine',
      groupCheck: 'Consistency',
      f: {
        type: 'Protocol', location: 'Location', asn: 'ASN', isp: 'ISP', org: 'Organisation',
        tz: 'Timezone', coord: 'Coordinates',
        browser: 'Browser', os: 'OS', screen: 'Screen', viewport: 'Viewport',
        dpr: 'Pixel ratio', sysTz: 'System timezone', lang: 'Language', cores: 'CPU threads',
        memory: 'Memory', touch: 'Touch', online: 'Connection'
      },
      yes: 'yes', no: 'no', on: 'online', off: 'offline', unknown: 'unknown',
      tzMatch: 'IP timezone matches the system timezone',
      tzDiff: 'IP timezone differs from the system timezone, which usually means a proxy or VPN is in use'
    }
  };

  function template(lang) {
    const t = TEXT[lang];
    return `
      <section class="ipx-app">
        <h2 class="section-title">${t.title}</h2>

        <div class="ipx-hero">
          <span class="ipx-hero-label">${t.current}</span>
          <strong class="ipx-hero-ip" id="ipxIp">${t.probing}</strong>
          <span class="ipx-hero-actions">
            <button class="retro-action" type="button" id="ipxCopy">${t.copy}</button>
            <button class="retro-action" type="button" id="ipxRefresh">${t.refresh}</button>
          </span>
        </div>

        <p class="ipx-note" id="ipxNote"></p>

        <h3 class="ipx-group">${t.groupNet}</h3>
        <dl class="ipx-grid" id="ipxNet"></dl>

        <h3 class="ipx-group">${t.groupClient}</h3>
        <dl class="ipx-grid" id="ipxClient"></dl>
      </section>
    `;
  }

  function row(label, value) {
    if (value === undefined || value === null || value === '') return '';
    return `<dt class="ipx-label">${label}</dt><dd class="ipx-value">${String(value)}</dd>`;
  }

  /* 从 UA 里挑出浏览器和系统。只求认得出常见的几个，不做完整解析。 */
  function readAgent() {
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    let os = 'Unknown';

    const brands = navigator.userAgentData && navigator.userAgentData.brands;
    if (brands && brands.length) {
      const real = brands.find((b) => !/Not.*Brand/i.test(b.brand));
      if (real) browser = real.brand + ' ' + real.version;
    }
    if (browser === 'Unknown') {
      const m = ua.match(/(Firefox|Edg|OPR|Chrome|Safari)\/([\d.]+)/);
      if (m) {
        const nameMap = { Edg: 'Edge', OPR: 'Opera' };
        browser = (nameMap[m[1]] || m[1]) + ' ' + m[2].split('.')[0];
      }
    }

    if (/Windows NT 10/.test(ua)) os = 'Windows 10/11';
    else if (/Windows NT/.test(ua)) os = 'Windows';
    else if (/Android ([\d.]+)/.test(ua)) os = 'Android ' + RegExp.$1;
    else if (/(iPhone|iPad)/.test(ua)) os = 'iOS';
    else if (/Mac OS X/.test(ua)) os = 'macOS';
    else if (/Linux/.test(ua)) os = 'Linux';

    return { browser, os };
  }

  function readClient(lang) {
    const t = TEXT[lang];
    const a = readAgent();
    const dm = navigator.deviceMemory;
    return [
      [t.f.browser, a.browser],
      [t.f.os, a.os],
      [t.f.screen, screen.width + ' × ' + screen.height],
      [t.f.viewport, window.innerWidth + ' × ' + window.innerHeight],
      [t.f.dpr, String(window.devicePixelRatio)],
      [t.f.sysTz, Intl.DateTimeFormat().resolvedOptions().timeZone || t.unknown],
      [t.f.lang, navigator.language],
      [t.f.cores, navigator.hardwareConcurrency ? String(navigator.hardwareConcurrency) : t.unknown],
      [t.f.memory, dm ? dm + ' GB' : t.unknown],
      [t.f.touch, navigator.maxTouchPoints > 0 ? t.yes : t.no],
      [t.f.online, navigator.onLine ? t.on : t.off]
    ];
  }

  function fetchWithTimeout(url, ms) {
    // AbortSignal.timeout 在旧一点的 WebView 上没有，这里自己拼一个
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { signal: ctrl.signal, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .finally(() => clearTimeout(timer));
  }

  async function probe() {
    for (const source of SOURCES) {
      try {
        const raw = await fetchWithTimeout(source.url, 8000);
        const data = source.parse(raw);
        if (data && data.ip) return { data, via: source.name };
      } catch (err) {
        /* 换下一家 */
      }
    }
    return null;
  }

  let inFlight = false;

  async function fill(lang) {
    const t = TEXT[lang];
    const ipEl = document.getElementById('ipxIp');
    const noteEl = document.getElementById('ipxNote');
    const netEl = document.getElementById('ipxNet');
    const clientEl = document.getElementById('ipxClient');
    if (!ipEl) return;

    clientEl.innerHTML = readClient(lang).map((r) => row(r[0], r[1])).join('');

    if (inFlight) return;
    inFlight = true;
    ipEl.textContent = t.probing;
    noteEl.textContent = '';
    noteEl.classList.remove('is-warn');

    const result = await probe();
    inFlight = false;

    // 取回结果时用户可能已经切走了，这时不要往别的页面上写
    if (state.section !== 'ipinfo') return;
    const stillThere = document.getElementById('ipxIp');
    if (!stillThere) return;

    if (!result) {
      stillThere.textContent = '—';
      noteEl.textContent = t.failed;
      noteEl.classList.add('is-warn');
      netEl.innerHTML = '';
      return;
    }

    const d = result.data;
    stillThere.textContent = d.ip;

    const place = [d.city, d.region, d.country].filter(Boolean).join(' · ');
    const coord = (d.lat && d.lon) ? (Number(d.lat).toFixed(3) + ', ' + Number(d.lon).toFixed(3)) : '';
    const tz = d.tzId ? (d.tzId + (d.tzUtc ? ' (UTC' + d.tzUtc + ')' : '')) : '';

    netEl.innerHTML = [
      row(t.f.type, d.type),
      row(t.f.location, place),
      row(t.f.asn, d.asn),
      row(t.f.isp, d.isp),
      row(t.f.org, d.org && d.org !== d.isp ? d.org : ''),
      row(t.f.tz, tz),
      row(t.f.coord, coord)
    ].join('');

    /*
     * 时区一致性。真正的 IP 检测站都会做这一条：IP 归属地的时区和浏览器报告的
     * 系统时区对不上，基本就说明流量在经过代理。这是整个应用里唯一「有判断」的字段。
     */
    const sysTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (d.tzId && sysTz) {
      const same = d.tzId === sysTz;
      noteEl.textContent = (same ? t.tzMatch : t.tzDiff) + '   ·   ' + t.via + ': ' + result.via;
      noteEl.classList.toggle('is-warn', !same);
    } else {
      noteEl.textContent = t.via + ': ' + result.via;
    }
  }

  function initIpInspector() {
    const lang = state.lang;
    const t = TEXT[lang];

    const copyBtn = document.getElementById('ipxCopy');
    const refreshBtn = document.getElementById('ipxRefresh');

    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const ip = document.getElementById('ipxIp').textContent.trim();
        if (!ip || ip === '—' || ip === t.probing) return;
        try {
          await navigator.clipboard.writeText(ip);
        } catch (err) {
          // 剪贴板在非安全上下文里会被拒，退回选中文本让用户自己复制
          const range = document.createRange();
          range.selectNodeContents(document.getElementById('ipxIp'));
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          return;
        }
        copyBtn.textContent = t.copied;
        setTimeout(() => { copyBtn.textContent = t.copy; }, 1400);
      });
    }

    if (refreshBtn) refreshBtn.addEventListener('click', () => fill(lang));

    fill(lang);
  }

  /* ---- 挂进主程序 ---- */

  content.zh.shortcutIp = TEXT.zh.shortcut;
  content.en.shortcutIp = TEXT.en.shortcut;
  content.zh.sections.ipinfo = template('zh');
  content.en.sections.ipinfo = template('en');

  const baseRender = render;
  render = function renderWithIpInspector() {
    baseRender();

    /*
     * 标题栏跟着走。左栏那四项是「关于我」的栏目，IP 检测器不是其中之一，
     * 所以打开时左栏不会有任何一项高亮 —— 如果标题栏还写着 Smirel，
     * 看上去就像页面坏了。换成应用名，它才读得出是一个被打开的程序。
     */
    const titleEl = document.querySelector('#windowTitle span');
    if (titleEl) {
      titleEl.textContent = state.section === 'ipinfo'
        ? TEXT[state.lang].appTitle
        : 'Smirel';
    }

    if (state.section === 'ipinfo') initIpInspector();
  };
})();
