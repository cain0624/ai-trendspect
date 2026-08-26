/* 明势 TrendSpect - 交互层 */
(function () {
  "use strict";

  const D = window.DATA;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ============ 工具 ============ */
  function esc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 2800);
  }

  /* ============ AI 金融热点手风琴画廊（AccordionGallery 移植） ============ */
  function initAccordionGallery() {
    const root = $("#heroGallery");
    if (!root) return;
    const panels = $$(".ag-panel", root);
    if (!panels.length) return;

    const count = panels.length;
    const parallax = 0.5;
    const tilt = 8;
    let active = Math.min(2, count - 1);
    let mediaSize = 90;
    /* 鼠标跟随浮动（3D 倾角，带缓动追帧） */
    const mouse = { x: 0, y: 0, tx: 0, ty: 0, active: false };
    let tiltRaf = 0;

    function measure() {
      const rect = root.getBoundingClientRect();
      const cs = getComputedStyle(root);
      const gap = parseFloat(cs.getPropertyValue("--ag-gap")) || 10;
      const grow = parseFloat(cs.getPropertyValue("--ag-grow")) || 2.6;
      const avail = Math.max(1, rect.width - (count - 1) * gap);
      // 展开面板锁定 16:9：画廊高度 = 激活面板宽度 × 9/16，任何屏幕比例下展开即 16:9
      const activeW = (avail * grow) / (count - 1 + grow);
      const h = Math.max(56, activeW * (9 / 16));
      root.style.height = h + "px";
      mediaSize = Math.max(120, h * (16 / 9));
      applyLayout();
    }

    function applyLayout() {
      panels.forEach((p, i) => {
        const isActive = i === active;
        p.classList.toggle("ag-panel--active", isActive);
        p.setAttribute("aria-current", isActive ? "true" : "");
        if (reduceMotion) {
          p.style.transform = "none";
        } else {
          const rot = isActive ? 0 : i < active ? tilt : -tilt;
          p.style.transform = "rotateX(" + mouse.x.toFixed(2) + "deg) rotateY(" + (rot + mouse.y).toFixed(2) + "deg)";
        }
        const media = $(".ag-panel__media", p);
        if (media) {
          const drift = Math.max(-1.5, Math.min(1.5, active - i));
          const shift = drift * parallax * mediaSize * 0.06;
          media.style.setProperty("--ag-shift", (reduceMotion ? 0 : shift) + "px");
        }
      });
    }

    function tiltFrame() {
      const k = 1 - Math.exp(-0.11);
      mouse.x += (mouse.tx - mouse.x) * k;
      mouse.y += (mouse.ty - mouse.y) * k;
      applyLayout();
      if (mouse.active || Math.abs(mouse.x - mouse.tx) > 0.01 || Math.abs(mouse.y - mouse.ty) > 0.01) {
        tiltRaf = requestAnimationFrame(tiltFrame);
      } else {
        tiltRaf = 0;
      }
    }

    let sweepRaf = 0;
    let hoverSweepRaf = 0;
    function playBorderSweep(panel) {
      if (reduceMotion || !panel || !panel.classList.contains("border-glow")) return;
      if (hoverSweepRaf) stopHoverSweep();
      panel.classList.add("sweep-active");
      const t0 = performance.now();
      const duration = 2200;
      const angleStart = 110;
      const angleEnd = 470;
      function tick(now) {
        const t = Math.min((now - t0) / duration, 1);
        const angle = angleStart + (angleEnd - angleStart) * t;
        panel.style.setProperty("--cursor-angle", angle.toFixed(2) + "deg");
        let prox;
        if (t < 0.2) prox = (t / 0.2) * 90;
        else if (t < 0.75) prox = 90;
        else prox = 90 * (1 - (t - 0.75) / 0.25);
        panel.style.setProperty("--edge-proximity", prox.toFixed(2));
        if (t < 1) {
          sweepRaf = requestAnimationFrame(tick);
        } else {
          panel.classList.remove("sweep-active");
          panel.style.setProperty("--edge-proximity", "0");
          sweepRaf = 0;
        }
      }
      cancelAnimationFrame(sweepRaf);
      sweepRaf = requestAnimationFrame(tick);
    }

    function playHoverSweep(panel) {
      if (reduceMotion || !panel || !panel.classList.contains("border-glow")) return;
      if (sweepRaf) {
        cancelAnimationFrame(sweepRaf);
        sweepRaf = 0;
      }
      if (hoverSweepRaf) return;
      panel.classList.add("sweep-active");
      const t0 = performance.now();
      const speed = 110;
      function tick(now) {
        const angle = ((now - t0) * 0.001 * speed) % 360;
        panel.style.setProperty("--cursor-angle", angle.toFixed(2) + "deg");
        panel.style.setProperty("--edge-proximity", "90");
        hoverSweepRaf = requestAnimationFrame(tick);
      }
      hoverSweepRaf = requestAnimationFrame(tick);
    }

    function stopHoverSweep() {
      if (hoverSweepRaf) {
        cancelAnimationFrame(hoverSweepRaf);
        hoverSweepRaf = 0;
      }
      const p = panels[active];
      if (p) {
        p.classList.remove("sweep-active");
        p.style.setProperty("--edge-proximity", "0");
      }
    }

    function setActive(next, sweep) {
      active = (next + count) % count;
      applyLayout();
      if (sweep) playBorderSweep(panels[active]);
    }

    /* ---------- 自动轮播：进入视口后每 3 秒切换下一张 ---------- */
    let autoTimer = null;
    let autoPaused = false;
    let autoVisible = false;

    function stopAuto() {
      if (autoTimer) {
        clearInterval(autoTimer);
        autoTimer = null;
      }
    }

    function startAuto() {
      stopAuto();
      if (autoPaused || !autoVisible) return;
      autoTimer = setInterval(() => setActive(active + 1, true), 3000);
    }

    function pauseAuto() {
      autoPaused = true;
      stopAuto();
    }

    function resumeAuto() {
      autoPaused = false;
      startAuto();
    }

    panels.forEach((p, i) => {
      p.addEventListener("mouseenter", () => {
        if (reduceMotion) return;
        setActive(i);
        playHoverSweep(p);
      });
      p.addEventListener("focus", () => setActive(i));
      p.addEventListener("click", (e) => {
        // 鼠标/触控笔：hover 已展开，点击直接跳转到对应模块；
        // 触屏/键盘：首次点击先展开，再次点击跳转。
        const viaPointer = e.pointerType === "mouse" || e.pointerType === "pen";
        if (i !== active && !viaPointer) {
          e.preventDefault();
          setActive(i);
        }
      });
      p.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); setActive(i + 1); }
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); setActive(i - 1); }
      });
    });

    root.addEventListener("mouseenter", pauseAuto);
    root.addEventListener("mouseleave", () => {
      stopHoverSweep();
      resumeAuto();
    });
    root.addEventListener("focusin", pauseAuto);
    root.addEventListener("focusout", resumeAuto);
    root.addEventListener("touchstart", pauseAuto, { passive: true });
    root.addEventListener("pointermove", (e) => {
      if (reduceMotion) return;
      const rect = root.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
      const ny = ((e.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1;
      mouse.tx = -ny * 5;
      mouse.ty = nx * 9;
      mouse.active = true;
      if (!tiltRaf) tiltRaf = requestAnimationFrame(tiltFrame);
    }, { passive: true });
    root.addEventListener("pointerleave", () => {
      if (reduceMotion) return;
      mouse.active = false;
      mouse.tx = 0;
      mouse.ty = 0;
      if (!tiltRaf) tiltRaf = requestAnimationFrame(tiltFrame);
    });

    const autoIo = new IntersectionObserver((entries) => {
      autoVisible = entries.some((en) => en.isIntersecting);
      if (autoVisible) startAuto();
      else stopAuto();
    }, { threshold: 0 });
    autoIo.observe(root);

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") startAuto();
      else stopAuto();
    });

    const ro = new ResizeObserver(measure);
    ro.observe(root);
    measure();
    applyLayout();
    startAuto();
    // 页面进入时给默认展开的卡片播放一遍边框走光
    setTimeout(() => playBorderSweep(panels[active]), 900);
  }

  /* ============ 滚动显现 ============ */
  function initReveal() {
    const targets = [];
    $$(".section").forEach((section) => {
      Array.from(section.children).forEach((child, i) => {
        if (child.classList.contains("prlx")) return;
        child.classList.add("reveal");
        child.style.setProperty("--i", Math.min(i, 6));
        targets.push(child);
      });
      $$(".chart-card, .forecast-cell, .insight-card, .tools-layout > .panel, .tools-stats", section).forEach((card, i) => {
        card.classList.add("reveal");
        card.style.setProperty("--i", Math.min(i % 4, 5));
        targets.push(card);
      });
    });

    if (reduceMotion) {
      targets.forEach((t) => t.classList.add("is-visible"));
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    targets.forEach((t) => io.observe(t));
  }

  /* ============ 滚动呼吸视差（单 rAF 驱动，缓存元素位置） ============ */
  /* ============ 全站滚动视差 ============ */
  const PARALLAX_SELECTOR = [
    ".section",
    ".section-head",
    ".news-toolbar",
    ".news-card",
    ".panel",
    ".chart-card",
    ".graph-main",
    ".graph-side",
    ".forecast-cell",
    ".insight-card",
    ".tools-layout > .panel",
    ".tools-stats",
    ".footer"
  ].join(",");

  let parallaxState = null;

  function parallaxSpeed(el) {
    if (el.dataset.prlx) return parseFloat(el.dataset.prlx);
    if (el.classList.contains("section-head")) return 0.12;
    if (el.classList.contains("news-toolbar")) return 0.06;
    if (el.classList.contains("news-card")) return 0.12;
    if (el.classList.contains("chart-card") ||
        el.classList.contains("forecast-cell") ||
        el.classList.contains("insight-card")) return 0.1;
    if (el.classList.contains("graph-main") || el.classList.contains("graph-side")) return 0.08;
    if (el.classList.contains("footer")) return 0.06;
    if (el.tagName === "SECTION") return 0.03;
    return 0.09;
  }

  /* 每个元素允许的最大视差位移（px）。幅度大幅收敛：
     模块中心在视口中心时位移为 0，越靠近视口边缘位移越大，
     但被 amp 限幅，保证内容不会跑出所属模块。 */
  function parallaxAmp(el) {
    const speed = parallaxSpeed(el);
    if (!speed) return 0;
    if (el.tagName === "SECTION") return 5;
    if (el.classList.contains("section-head")) return 14;
    if (el.classList.contains("news-card")) return 14;
    if (el.classList.contains("chart-card") ||
        el.classList.contains("forecast-cell") ||
        el.classList.contains("insight-card")) return 11;
    if (el.classList.contains("graph-main") || el.classList.contains("graph-side")) return 9;
    if (el.classList.contains("footer")) return 7;
    return 10;
  }

  function initParallax() {
    if (reduceMotion) return;
    if (parallaxState) {
      parallaxState.refresh();
      return;
    }

    let els = [];
    const tops = [];
    const halfs = [];
    let amps = [];
    let currents = [];

    function measure() {
      for (let i = 0; i < els.length; i++) {
        tops[i] = els[i].getBoundingClientRect().top + window.scrollY;
        halfs[i] = els[i].offsetHeight / 2;
      }
    }
    measure();

    let raf = 0;
    let running = true;
    let t0 = performance.now();
    let lastFrame = 0;

    function frame(now) {
      if (!running) return;
      // 30fps 节流：视差位移幅度小，低频下无感知
      if (now - lastFrame < 32) {
        raf = requestAnimationFrame(frame);
        return;
      }
      const dt = Math.min((now - lastFrame) / 1000, 0.08);
      lastFrame = now;
      const t = (now - t0) * 0.001;
      const breathe = 1 + Math.sin(t * 0.7) * 0.04;
      const sy = window.scrollY;
      const vh = window.innerHeight;
      for (let i = 0; i < els.length; i++) {
        if (!els[i]._prlxOn) continue;
        // 归一化进度：0 = 模块中心正对屏幕中心；±1 = 相距半屏（限幅，不再无限累积）
        const p = Math.max(-1, Math.min(1, (tops[i] + halfs[i] - sy - vh / 2) / (vh * 0.55)));
        const target = p * amps[i] * breathe;
        // 近中心加速收敛：模块滚到屏幕中间时，元素快速回归静态原位
        const near = 1 - Math.min(1, Math.abs(p) / 0.3);
        const k = 1 - Math.exp(-dt * (5 + near * 10));
        currents[i] += (target - currents[i]) * k;
        // 用独立 translate 属性叠加，避免覆盖 hover/reveal 的 transform
        els[i].style.translate = "0px " + currents[i].toFixed(1) + "px";
      }
      raf = requestAnimationFrame(frame);
    }

    let io = null;

    function bind() {
      els = $$(PARALLAX_SELECTOR);
      amps = els.map(parallaxAmp);
      currents = new Array(els.length).fill(0);
      if (io) io.disconnect();
      io = new IntersectionObserver((entries) => {
        entries.forEach((en) => { en.target._prlxOn = en.isIntersecting; });
      }, { rootMargin: "180px 0px" });
      els.forEach((el) => {
        el._prlxOn = false;
        io.observe(el);
      });
      measure();
    }

    bind();

    document.addEventListener("visibilitychange", () => {
      running = document.visibilityState === "visible";
      if (running) {
        cancelAnimationFrame(raf);
        t0 = performance.now();
        raf = requestAnimationFrame(frame);
      }
    });
    window.addEventListener("resize", () => {
      measure();
      for (let i = 0; i < els.length; i++) els[i]._prlxOn = true;
    });

    parallaxState = {
      refresh: function () {
        bind();
      }
    };

    raf = requestAnimationFrame(frame);
  }

  /* ============ 首屏内容滚动视差（固定头图内文案/画廊随滚动缓动漂移） ============ */
  function initHeroParallax() {
    if (reduceMotion) return;
    const body = $(".hero__body");
    const gallery = $(".hero-gallery");
    if (!body) return;

    let raf = 0;
    let last = performance.now();
    let bodyY = 0;
    let galleryY = 0;

    function frame(now) {
      const dt = Math.min((now - last) / 1000, 0.08);
      last = now;
      const sy = window.scrollY;
      // 头图内容漂移限幅：滚过约一屏后停止，幅度收敛不再无限上移
      const progress = Math.max(0, Math.min(1, sy / (window.innerHeight * 0.9)));
      const bodyTarget = -progress * 56;
      const galleryTarget = -progress * 28;
      const k = 1 - Math.exp(-dt * 5);
      bodyY += (bodyTarget - bodyY) * k;
      galleryY += (galleryTarget - galleryY) * k;
      body.style.translate = "0px " + bodyY.toFixed(1) + "px";
      if (gallery) gallery.style.translate = "0px " + galleryY.toFixed(1) + "px";
      raf = requestAnimationFrame(frame);
    }

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      cancelAnimationFrame(raf);
      last = performance.now();
      raf = requestAnimationFrame(frame);
    });
    raf = requestAnimationFrame(frame);
  }

  /* ============ 下滑箭头：缓动滚动到首屏模块，吸附至导航栏下方 24px ============ */
  function initHeroScroll() {
    const btn = $("#heroScrollBtn");
    if (!btn) return;
    const target = $("#overview");
    if (!target) return;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const targetY = Math.max(0, target.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(target).scrollMarginTop) || 88));
      const startY = window.scrollY;
      const delta = targetY - startY;
      if (Math.abs(delta) < 1) return;
      const duration = Math.min(1200, Math.max(600, Math.abs(delta) * 0.55));
      const start = performance.now();
      const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      function step(now) {
        const p = Math.min(1, (now - start) / duration);
        window.scrollTo(0, startY + delta * easeInOutCubic(p));
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  /* ============ BorderGlow 移植：模块/轮播卡片光标跟随渐变光边 ============ */
  function initBorderGlow() {
    $$(".ag-panel").forEach((card) => {
      if (card.classList.contains("border-glow")) return;
      card.classList.add("border-glow");
      card.addEventListener("pointermove", (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const dx = x - cx;
        const dy = y - cy;
        let kx = Infinity;
        let ky = Infinity;
        if (dx !== 0) kx = cx / Math.abs(dx);
        if (dy !== 0) ky = cy / Math.abs(dy);
        const edge = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);
        const angle = dx === 0 && dy === 0 ? 0 : (Math.atan2(dy, dx) * (180 / Math.PI) + 90 + 360) % 360;
        card.style.setProperty("--edge-proximity", (edge * 100).toFixed(3));
        card.style.setProperty("--cursor-angle", angle.toFixed(3) + "deg");
      }, { passive: true });
    });
  }

  /* ============ 快讯渲染 ============ */
  let newsCat = "all";
  let newsRange = "24h";

  function filteredNews() {
    return D.news.filter((n) =>
      (newsCat === "all" || n.cat === newsCat) &&
      (newsRange === "all" || n.range === newsRange || n.range === "24h")
    );
  }

  function renderNews() {
    const feed = $("#newsFeed");
    const list = filteredNews();
    if (!list.length) {
      feed.innerHTML = "<div class='panel' style='text-align:center;color:var(--text-3)'>该分类暂无快讯，试试其他筛选条件。</div>";
      return;
    }
    feed.innerHTML = list.map((n) =>
      "<article class='news-card' data-id='" + n.id + "' tabindex='0' role='button' aria-label='查看快讯详情：" + esc(n.title) + "'>" +
        "<div class='news-meta'>" +
          "<span class='news-time mono'>" + n.time + "</span>" +
          "<span class='level-badge level-" + n.level + "'>" + n.levelText + "</span>" +
        "</div>" +
        "<h3 class='news-title'>" + esc(n.title) + "</h3>" +
        "<p class='news-ai'>AI 解读：<span>" + esc(n.ai) + "</span></p>" +
        "<div class='news-footer'>" +
          "<span class='news-source'>来源：" + esc(n.source) + "</span>" +
          "<span class='news-score mono'>事件权重 " + n.score + "</span>" +
          "<button class='btn btn-ghost btn-xs' type='button' data-link='1'>原文</button>" +
        "</div>" +
      "</article>"
    ).join("");

    $$(".news-card", feed).forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-link]")) {
          e.stopPropagation();
          openSource(card.dataset.id);
          return;
        }
        openNews(card.dataset.id);
      });
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openNews(card.dataset.id);
        }
      });
    });

    renderWeights();
  }

  function renderWeights() {
    const list = D.news.slice().sort((a, b) => b.score - a.score).slice(0, 5);
    $("#weightList").innerHTML = list.map((n, i) =>
      "<li>" +
        "<span class='rank'>" + String(i + 1).padStart(2, "0") + "</span>" +
        "<div style='flex:1'>" +
          "<span class='w-title'>" + esc(n.title) + "</span>" +
          "<span class='weight-bar'><i style='width:" + (n.weight * 100).toFixed(0) + "%'></i></span>" +
        "</div>" +
        "<span class='w-score'>" + n.score + "</span>" +
      "</li>"
    ).join("");
  }

  function openNews(id) {
    const n = D.news.find((x) => x.id === id);
    if (!n) return;
    renderRelated(n);
    openModal(n.title, [
      "<div class='kv'>" +
        "<span>时间</span><span class='mono'>" + n.time + " · " + n.range + "窗口</span>" +
        "<span>事件等级</span><span class='level-badge level-" + n.level + "'>" + n.levelText + "</span>" +
        "<span>来源</span><span>" + esc(n.source) + "</span>" +
        "<span>事件权重</span><span class='mono'>" + n.score + "/100</span>" +
      "</div>",
      "<h4>AI 深度解读</h4><p>" + esc(n.ai) + "</p>",
      "<h4>关联上下游标的</h4><p>" + n.related.map((r) => "<span class='chip' style='cursor:default;margin-right:6px'>" + esc(r) + "</span>").join("") + "</p>",
      "<h4>历史同类事件复盘</h4>" +
        (n.similar.length
          ? "<ul class='similar-list'>" + n.similar.map((s) => "<li><span class='s-year'>" + s.year + "</span>" + esc(s.text) + "</li>").join("") + "</ul>"
          : "<p>暂无历史同类事件。</p>")
    ].join(""));
  }

  function openSource(id) {
    const n = D.news.find((x) => x.id === id);
    if (!n) return;
    toast("演示环境：原文链接已记录（来源：" + n.source + "）");
  }

  function renderRelated(n) {
    const box = $("#relatedBox");
    let html = "";
    html += "<div class='related-item'><span class='r-type'>关联标的</span><span class='r-text'>" +
      n.related.map((r) => esc(r)).join("、") + "</span></div>";
    if (n.similar.length) {
      html += n.similar.slice(0, 2).map((s) =>
        "<div class='related-item'><span class='r-type'>历史复盘 " + s.year + "</span><span class='r-text'>" + esc(s.text) + "</span></div>"
      ).join("");
    } else {
      html += "<div class='related-item'><span class='r-type'>历史复盘</span><span class='r-text'>暂无同类事件数据</span></div>";
    }
    box.innerHTML = html;
  }

  function initNewsControls() {
    $$(".tab[data-cat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        $$(".tab[data-cat]").forEach((b) => {
          b.classList.toggle("is-active", b === btn);
          b.setAttribute("aria-selected", b === btn ? "true" : "false");
        });
        newsCat = btn.dataset.cat;
        renderNews();
      });
    });
    $$(".seg[data-range]").forEach((btn) => {
      btn.addEventListener("click", () => {
        $$(".seg[data-range]").forEach((b) => b.classList.toggle("is-active", b === btn));
        newsRange = btn.dataset.range;
        renderNews();
      });
    });
  }

  /* ============ 图表下钻 ============ */
  function initChartDrills() {
    window.CHARTS._onChartReady("fundChart", (chart) => {
      chart.on("click", (params) => {
        if (!params || params.dataIndex == null) return;
        const dim = $(".chart-card .seg.is-active") ? $(".chart-card .seg.is-active").dataset.dim : "day";
        const s = D.fundFlow[dim];
        const x = s.x[params.dataIndex];
        const aiV = s.ai[params.dataIndex];
        const techV = s.tech[params.dataIndex];
        openModal("资金流向下钻 · " + x, [
          "<div class='kv'>" +
            "<span>时间窗口</span><span class='mono'>" + x + "</span>" +
            "<span>AI赛道净流入</span><span class='mono'>" + (aiV >= 0 ? "+" : "") + aiV + " 亿元</span>" +
            "<span>科技板块基准</span><span class='mono'>" + (techV >= 0 ? "+" : "") + techV + " 亿元</span>" +
          "</div>",
          "<h4>AI 解读</h4><p>" + (aiV >= 0
            ? "净流入集中在算力与设备，情绪偏暖。"
            : "获利了结为主，量能未放大，属结构性调整。") + "</p>",
          "<h4>关联快讯</h4><p>" + D.news.slice(0, 3).map((n) => "- " + esc(n.title) + "<br>").join("") + "</p>"
        ].join(""));
      });
    });
    window.CHARTS._onChartReady("heatChart", (chart) => {
      chart.on("click", (params) => {
        if (!params || !params.value) return;
        const sector = D.heatmap.sectors[params.value[1]];
        const day = D.heatmap.days[params.value[0]];
        const v = params.value[2];
        openModal("板块下钻 · " + sector, [
          "<div class='kv'>" +
            "<span>交易日</span><span>" + day + "</span>" +
            "<span>区间涨跌</span><span class='mono' style='color:" + (v >= 0 ? "var(--good)" : "var(--bad)") + "'>" + (v >= 0 ? "+" : "") + v + "%</span>" +
          "</div>",
          "<h4>AI 解读</h4><p>" + (v >= 0
            ? sector + " 领涨，量价齐升，动量延续。"
            : sector + " 获利了结为主，关注下方承接。") + "</p>",
          "<h4>细分驱动</h4><p>- 主力净流入 " + (Math.abs(v) * 4.6).toFixed(1) + " 亿元<br>- 成交占比 " + (12 + Math.abs(v) * 1.8).toFixed(1) + "%<br>- 龙头贡献 " + (Math.abs(v) * 2.4).toFixed(1) + "pct</p>"
        ].join(""));
      });
    });
  }

  /* ============ 事件图谱 ============ */
  function graphClick(id) {
    const d = D.graph.detail[id];
    const node = D.graph.nodes.find((n) => n.id === id);
    if (!d || !node) return;
    const color = { "政策": "var(--accent)", "产业": "var(--accent-2)", "资金": "var(--good)", "股价": "var(--warn)" }[node.cat];
    const chainHtml = D.graph.chain.map((c) =>
      "<span class='chain-step' style='border-color:" + color + ";color:" + color + "'>" + c + "</span>"
    ).join("<span class='chain-arrow'>→</span>");

    const side = $("#graphSide");
    side.innerHTML = [
      "<div class='panel'>",
        "<h3 class='g-title'>" + esc(node.name) + "</h3>",
        "<span class='g-badge'><i style='background:" + color + "'></i>" + node.cat + "节点 · 事件权重 " + node.value + "</span>",
        "<p class='g-desc'>" + esc(d.desc) + "</p>",
      "</div>",
      "<div class='panel'>",
        "<h3 class='panel-title'>传导链定位</h3>",
        "<div class='chain'>" + chainHtml + "</div>",
      "</div>",
      "<div class='panel'>",
        "<h3 class='panel-title'>上下游影响</h3>",
        "<p class='g-desc'>上游：" + (d.up.length ? d.up.map(esc).join(" → ") : "无") + "</p>",
        "<p class='g-desc' style='margin-top:6px'>下游：" + (d.down.length ? d.down.map(esc).join(" → ") : "无") + "</p>",
      "</div>",
      "<div class='panel'>",
        "<h3 class='panel-title'>历史相似事件</h3>",
        d.similar.length
          ? "<ul class='similar-list'>" + d.similar.map((s) => "<li><span class='s-year'>" + s.year + "</span>" + esc(s.text) + "</li>").join("") + "</ul>"
          : "<p class='g-desc'>暂无匹配的历史复盘样本。</p>",
      "</div>"
    ].join("");
  }

  function initGraphLegend() {
    $("#graphLegend").innerHTML = D.graph.legend.map((l) =>
      "<span><i style='display:inline-block;width:8px;height:8px;border-radius:50%;background:" + l.color + ";margin-right:5px'></i>" + l.name + "</span>"
    ).join("");
  }

  /* ============ 预测模型静态渲染 ============ */
  function renderForecast() {
    const rank = $("#rankList");
    rank.innerHTML = D.forecast.ranking.map((r, i) =>
      "<div class='rank-row'>" +
        "<span class='rank-idx'>" + String(i + 1).padStart(2, "0") + "</span>" +
        "<span class='rank-name'>" + esc(r.name) + "</span>" +
        "<span class='rank-val'>" + r.value + "</span>" +
        "<span class='rank-track'><i style='width:" + (r.value / 100 * 100) + "%'></i></span>" +
      "</div>"
    ).join("");

    const risks = $("#riskList");
    risks.innerHTML = D.forecast.risks.map((r) =>
      "<li><span class='risk-dot' style='background:var(--" + r.dot + ")'></span><span>" + esc(r.text) + "</span></li>"
    ).join("");
  }

  /* ============ 专栏弹层 ============ */
  function initInsights() {
    $$("[data-article]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const a = D.articles[btn.dataset.article];
        if (!a) return;
        openModal(a.title, [
          "<p class='insight-type mono' style='display:inline-block;margin-bottom:10px'>" + a.type + "</p>",
          "<h4>引言</h4><p>" + esc(a.intro) + "</p>",
          "<h4>核心数据支撑</h4><p>" + esc(a.data) + "</p>",
          "<h4>事件复盘</h4><p>" + esc(a.review) + "</p>",
          "<h4>逻辑推导</h4><p>" + esc(a.logic) + "</p>",
          "<h4>结论预测</h4><p>" + esc(a.conclusion) + "</p>",
          "<p class='form-note'>本文为演示内容，仅用于展示专栏排版与交互，不构成投资建议。</p>"
        ].join(""));
      });
    });
  }

  /* ============ 弹层 ============ */
  function openModal(title, bodyHtml) {
    const modal = $("#modal");
    $("#modalTitle").textContent = title;
    $("#modalBody").innerHTML = bodyHtml;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    const closeBtn = $("[data-close-modal]", modal);
    if (closeBtn) setTimeout(() => closeBtn.focus(), 50);
  }

  function closeModal() {
    const modal = $("#modal");
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  function initModal() {
    $$("[data-close-modal]").forEach((el) => el.addEventListener("click", closeModal));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !$("#modal").hidden) closeModal();
    });
  }

  /* ============ 订阅 / 工具箱 ============ */
  function initTools() {
    $("#subscribeForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const email = $("#emailInput").value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        toast("请输入有效的邮箱地址");
        return;
      }
      toast("订阅成功，每日简报将发送至 " + email);
      e.target.reset();
    });

    $("#footerForm").addEventListener("submit", (e) => {
      e.preventDefault();
      toast("订阅成功，感谢关注明势 TrendSpect");
      e.target.reset();
    });

    $$(".seg[data-channel]").forEach((btn) => {
      btn.addEventListener("click", () => {
        $$(".seg[data-channel]").forEach((b) => b.classList.toggle("is-active", b === btn));
      });
    });

    $$("#focusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        chip.classList.toggle("is-selected");
      });
    });

    $("#buildBriefBtn").addEventListener("click", () => {
      const picks = $$("#focusChips .chip.is-selected").map((c) => c.textContent.trim());
      toast(picks.length ? "已生成专属简报，关注赛道：" + picks.join("、") : "请先选择至少一个关注赛道");
    });

    $$("[data-download]").forEach((btn) => {
      btn.addEventListener("click", () => download(btn.dataset.download));
    });
  }

  function download(kind) {
    if (kind === "csv") {
      const s = D.fundFlow.day;
      const rows = [["time", "ai_net_inflow", "tech_benchmark"], ...s.x.map((x, i) => [x, s.ai[i], s.tech[i]])];
      const blob = new Blob(["\uFEFF" + rows.map((r) => r.join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
      triggerDownload(blob, "ai_fund_flow_daily.csv");
    } else if (kind === "json") {
      const blob = new Blob([JSON.stringify(D.graph, null, 2)], { type: "application/json" });
      triggerDownload(blob, "event_graph_data.json");
    } else if (kind === "pdf") {
      const blob = new Blob([makePdf()], { type: "application/pdf" });
      triggerDownload(blob, "monthly_report_2026-07.pdf");
    }
    toast("文件已开始下载（演示数据）");
  }

  function triggerDownload(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function makePdf() {
    const text = "MINGSHI TrendSpect - Monthly Report (Demo Data)";
    const lines = [
      "1 0 0 1 72 720 cm",
      "BT /F1 18 Tf 0 0 0 rg (" + text + ") Tj ET",
      "BT /F1 11 Tf 0.4 0.4 0.4 rg",
      "72 690 m 540 690 l S",
      "BT 72 660 Tf (AI fund flow: +142.8 CNY bn, MoM +12.8%) Tj ET",
      "BT 72 642 Tf (Sentiment score: 72.6/100) Tj ET",
      "BT 72 624 Tf (Backtest hit rate: 68.4%) Tj ET",
      "BT 72 580 Tf (Disclaimer: This report is a demo and not investment advice.) Tj ET",
      "ET"
    ].join("\n");
    const bytes = unescape(encodeURIComponent(lines)).length;
    return "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length " + bytes + ">>stream\n" + lines + "\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF";
  }

  /* ============ 导航 ============ */
  function initNav() {
    const burger = $("#navBurger");
    const menu = $("#mobileMenu");
    const menuLinks = $$(".mobile-menu-inner a");
    const desktopQuery = window.matchMedia("(min-width: 901px)");

    function setMenu(forceOpen) {
      const isOpen = forceOpen === undefined ? !menu.classList.contains("is-open") : forceOpen;
      menu.classList.toggle("is-open", isOpen);
      menu.setAttribute("aria-hidden", isOpen ? "false" : "true");
      burger.classList.toggle("is-open", isOpen);
      burger.setAttribute("aria-expanded", isOpen ? "true" : "false");
      burger.setAttribute("aria-label", isOpen ? "关闭菜单" : "打开菜单");
      if (isOpen) {
        menu.removeAttribute("inert");
        document.body.classList.add("menu-open");
        setTimeout(() => { const f = menuLinks[0]; if (f) f.focus(); }, 340);
      } else {
        menu.setAttribute("inert", "");
        document.body.classList.remove("menu-open");
        burger.focus();
      }
    }

    burger.addEventListener("click", () => setMenu());
    menuLinks.forEach((a) => a.addEventListener("click", () => setMenu(false)));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menu.classList.contains("is-open")) setMenu(false);
    });
    desktopQuery.addEventListener("change", (e) => {
      if (e.matches && menu.classList.contains("is-open")) setMenu(false);
    });

    const sections = $$("main section[id]");
    const links = $$(".nav-link");
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          links.forEach((l) => {
            const active = l.getAttribute("href") === "#" + id;
            l.style.color = active ? "var(--accent-2)" : "";
          });
        }
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    sections.forEach((s) => io.observe(s));
  }

  /* ============ 免责声明 ============ */
  /* ============ 图表导出与维度切换 ============ */
  function initChartActions() {
    $$(".export-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.CHARTS.exportPng(btn.dataset.export, btn.dataset.export);
        toast("图表已导出为 PNG");
      });
    });

    $$(".chart-card .seg[data-dim]").forEach((btn) => {
      btn.addEventListener("click", () => {
        $$(".chart-card .seg[data-dim]").forEach((b) => b.classList.toggle("is-active", b === btn));
        window.CHARTS.updateFund(btn.dataset.dim);
      });
    });
  }

    /* 按钮镜面光效已替换为 CSS 实现（性能优化） */

/* ============ 首屏背景：LightTunnel 移植（WebGL 光隧道） ============ */
  function initLightTunnel() {
    const container = $("#heroTunnel");
    if (!container) return;

    const VERT = "#version 300 es\nin vec2 position;\nvoid main() { gl_Position = vec4(position, 0.0, 1.0); }";
    const FRAG = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uSpeed;
uniform float uFlowDir;
uniform float uPulseSpeed;
uniform float uPulseLength;
uniform float uPulseBlend;
uniform float uPulseWidth;
uniform float uCableCount;
uniform float uThickness;
uniform float uRimWidth;
uniform float uWaviness;
uniform float uSway;
uniform float uSize;
uniform vec2 uCenter;
uniform vec2 uMouseOffset;
uniform float uGlow;
uniform float uFadeNear;
uniform float uFadeFar;
uniform float uBrightness;
uniform float uColorVariance;
uniform float uOpacity;
uniform vec3 uCableColor;
uniform vec3 uPulseColor;
uniform vec3 uTunnelColor;
uniform float uTunnelOpacity;
uniform float uGrain;
uniform float uGrainIntensity;
out vec4 fragColor;

void mainImage(out vec4 o, in vec2 fragCoord) {
  float size = uSize * 2.0;
  float flowDir = uFlowDir;
  float speedBase = uSpeed * 4.0 * flowDir;
  float waviness = uWaviness * 0.15;
  float rotationOsc = uSway * 0.5;
  float baseThick = uThickness * 0.35 + 0.05;
  float borderWeight = uRimWidth * 0.15 + 0.01;
  float cablesCount = floor(uCableCount);

  vec2 res = iResolution.xy;
  vec2 uv = (fragCoord - 0.5 * res) / min(res.y, res.x);
  uv -= (uCenter + uMouseOffset);
  uv /= (size + 0.0001);

  float r = length(uv);
  float angle = atan(uv.y, uv.x);
  float depth = -log(r + 0.0001);

  float swing = sin(iTime * (uSpeed * 0.5 + 0.1)) * rotationOsc;
  float waveOffset = sin(depth * 1.2 + iTime * speedBase * 0.25) * waviness;

  float angleNormalized = (angle / 6.2831853) + 0.5;
  float finalAngle = fract(angleNormalized + waveOffset + swing);

  float cableID = floor(finalAngle * cablesCount);
  float gvX = (fract(finalAngle * cablesCount) - 0.5);

  float rand = fract(sin(cableID * 12.9898) * 43758.5453);
  float randSpeed = (0.4 + rand * 0.6) * speedBase * uPulseSpeed;
  float cableThick = baseThick * (0.6 + rand * 0.4);

  vec3 cableCol = uCableColor;
  cableCol *= 1.0 + (rand - 0.5) * 0.4 * uColorVariance;
  cableCol = mix(cableCol, uPulseColor, rand * 0.25 * uColorVariance);

  float scroll = depth + (iTime * randSpeed);
  float pulseFact = fract(scroll);

  float distToCore = abs(gvX);
  float wireMask = smoothstep(cableThick, cableThick - 0.05, distToCore);
  float rimGlow = smoothstep(borderWeight, 0.0, abs(distToCore - cableThick));

  float pulseThick = cableThick * uPulseWidth;
  float pulseMask = smoothstep(pulseThick, pulseThick - 0.05 * uPulseWidth, distToCore);

  float pulseDist = abs(pulseFact - 0.5);
  float pulseTotal = uPulseLength;
  float pulseCore = pulseTotal * (1.0 - uPulseBlend);
  float pulseLo = min(pulseCore, pulseTotal - max(fwidth(scroll), 1e-4));
  float dataPulse = 1.0 - smoothstep(pulseLo, pulseTotal, pulseDist);

  float aBody = wireMask * uTunnelOpacity;
  float aRim = rimGlow;
  float aPulse = clamp(dataPulse * pulseMask, 0.0, 1.0);

  vec3 fiberCol = uTunnelColor * aBody
    + cableCol * aRim * 1.3 * uGlow
    + uPulseColor * dataPulse * 3.0 * pulseMask;

  float distFade = smoothstep(0.0, uFadeNear, r) * smoothstep(uFadeFar, uFadeFar - 0.9, r);
  float inten = clamp(aBody + aRim + aPulse, 0.0, 1.0) * distFade;

  vec3 finalCol = fiberCol * uBrightness;
  float alpha = clamp(inten, 0.0, 1.0) * uOpacity;
  vec3 outRgb = finalCol * alpha;

  if (uGrain > 0.5) {
    float gv = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + iTime) * 43758.5453) - 0.5) * uGrainIntensity;
    outRgb = clamp(outRgb + gv, 0.0, 1.0);
    alpha = clamp(alpha + gv, 0.0, 1.0);
  }

  o = vec4(outRgb, alpha);
}

void main() {
  vec4 o = vec4(0.0);
  mainImage(o, gl_FragCoord.xy);
  fragColor = o;
}
`;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.appendChild(canvas);

    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) {
      canvas.remove();
      return;
    }

    function compile(type, src) {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    }
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) {
      canvas.remove();
      return;
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      canvas.remove();
      return;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(prog, "position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const U = {};
    [
      "iTime", "iResolution", "uSpeed", "uFlowDir", "uPulseSpeed", "uPulseLength",
      "uPulseBlend", "uPulseWidth", "uCableCount", "uThickness", "uRimWidth",
      "uWaviness", "uSway", "uSize", "uCenter", "uMouseOffset", "uGlow",
      "uFadeNear", "uFadeFar", "uBrightness", "uColorVariance", "uOpacity",
      "uCableColor", "uPulseColor", "uTunnelColor", "uTunnelOpacity", "uGrain", "uGrainIntensity"
    ].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });

    gl.clearColor(0, 0, 0, 0);

    // 默认参数（对齐示例：紫色霓虹隧道）
    const defs = {
      uSpeed: 0.1,
      uFlowDir: -1.0,
      uPulseSpeed: 2.0,
      uPulseLength: 0.28,
      uPulseBlend: 1.0,
      uPulseWidth: 1.0,
      uCableCount: 22,
      uThickness: 0.4,
      uRimWidth: 0.22,
      uWaviness: 0.3,
      uSway: 0.5,
      uSize: 1.0,
      uGlow: 1.35,
      uFadeNear: 0.45,
      uFadeFar: 1.75,
      uBrightness: 1.12,
      uColorVariance: 1.0,
      uOpacity: 1.0,
      uTunnelOpacity: 0.1,
      uGrain: 1.0,
      uGrainIntensity: 0.05
    };
    const cable = [0.1059, 0.302, 1.0];     // #1B4DFF 深科技蓝
    const pulse = [0.1804, 0.6078, 1.0];    // #2E9BFF 亮蓝脉冲
    const tunnel = [0.0824, 0.1882, 0.8];   // #1530CC 深蓝底

    function setSize() {
      const rect = container.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(U.iResolution, canvas.width, canvas.height);
    }
    const ro = new ResizeObserver(setSize);
    ro.observe(container);
    setSize();

    Object.keys(defs).forEach((k) => gl.uniform1f(U[k], defs[k]));
    gl.uniform2f(U.uCenter, 0, 0);
    gl.uniform2f(U.uMouseOffset, 0, 0);
    gl.uniform3fv(U.uCableColor, cable);
    gl.uniform3fv(U.uPulseColor, pulse);
    gl.uniform3fv(U.uTunnelColor, tunnel);

    // 鼠标视差（隧道消失点跟随指针）
    const currentMouse = [0.5, 0.5];
    const targetMouse = [0.5, 0.5];
    const strength = 0.12;
    function onMove(e) {
      const rect = canvas.getBoundingClientRect();
      targetMouse[0] = (e.clientX - rect.left) / rect.width;
      targetMouse[1] = 1.0 - (e.clientY - rect.top) / rect.height;
    }
    function onLeave() {
      targetMouse[0] = 0.5;
      targetMouse[1] = 0.5;
    }
    if (!reduceMotion) {
      canvas.addEventListener("mousemove", onMove);
      canvas.addEventListener("mouseleave", onLeave);
    }

    let raf = 0;
    let isVisible = true;
    let isPageVisible = !document.hidden;
    const t0 = performance.now();

    function loop(t) {
      if (reduceMotion) return;
      gl.uniform1f(U.iTime, (t - t0) * 0.001);
      currentMouse[0] += 0.05 * (targetMouse[0] - currentMouse[0]);
      currentMouse[1] += 0.05 * (targetMouse[1] - currentMouse[1]);
      gl.uniform2f(U.uMouseOffset, (currentMouse[0] - 0.5) * strength, (currentMouse[1] - 0.5) * strength);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(loop);
    }
    const tryStart = () => {
      if (isVisible && isPageVisible && raf === 0 && !reduceMotion) raf = requestAnimationFrame(loop);
    };
    const tryStop = () => {
      if (raf !== 0) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    const io = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      isVisible ? tryStart() : tryStop();
    }, { threshold: 0 });
    io.observe(container);
    const onVisibility = () => {
      isPageVisible = !document.hidden;
      isPageVisible ? tryStart() : tryStop();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // 减弱动效：只画一帧静态隧道
    if (reduceMotion) {
      gl.uniform1f(U.iTime, 0.8);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else {
      tryStart();
    }
  }

  /* WarpText 已移除（性能优化）：模块标题直接使用普通文字 */

/* ============ 首屏主文案（ParticleText 移植：粒子散聚成字 + 指针排斥 + 呼吸漂移） ============ */
  function initParticleText() {
    const container = $("#heroParticleText");
    if (!container) return;
    const canvas = $(".particle-text__canvas", container);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const settings = {
      text: "AI Trends",
      particleSize: 1.15,
      density: 2.4,
      color: "#93d7f5",
      highlightColor: "#f3fbff",
      scatter: 180,
      gatherDuration: 1600,
      stagger: 420,
      pointerRepel: 26,
      repelRadius: 120,
      idleDrift: 0.4,
      fontSize: "clamp(2.8rem, 10.75vw, 7.5rem)",
      fontWeight: 800
    };

    const hexToRgb = (hex) => {
      const clean = hex.replace("#", "").trim();
      if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
      return {
        r: parseInt(clean.slice(0, 2), 16),
        g: parseInt(clean.slice(2, 4), 16),
        b: parseInt(clean.slice(4, 6), 16)
      };
    };
    const mixRgb = (from, to, amount) => ({
      r: Math.round(from.r + (to.r - from.r) * amount),
      g: Math.round(from.g + (to.g - from.g) * amount),
      b: Math.round(from.b + (to.b - from.b) * amount)
    });
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    /* 预渲染柔边粒子贴图：粒子边缘径向渐变（12 档颜色缓存，避免逐帧建渐变） */
    const SPRITE_BUCKETS = 12;
    const dotSprites = (function buildSprites() {
      const base = hexToRgb(settings.color) || { r: 255, g: 255, b: 255 };
      const hl = hexToRgb(settings.highlightColor) || base;
      const sprites = [];
      for (let k = 0; k < SPRITE_BUCKETS; k++) {
        const blend = k / (SPRITE_BUCKETS - 1);
        const rgb = mixRgb(base, hl, blend);
        const c = document.createElement("canvas");
        c.width = 32;
        c.height = 32;
        const g = c.getContext("2d");
        const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",1)");
        grad.addColorStop(0.5, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.55)");
        grad.addColorStop(1, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0)");
        g.fillStyle = grad;
        g.fillRect(0, 0, 32, 32);
        sprites.push(c);
      }
      return sprites;
    })();

    let particles = [];
    let animationFrame = null;
    let resizeFrame = null;
    let buildId = 0;
    let gathering = false;
    let gatherStart = 0;
    let lastRender = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let heroVisible = true;
    let pageVisible = !document.hidden;

    const pointer = { active: false, x: 0, y: 0, smoothX: 0, smoothY: 0 };
    const waves = [];
    let lastWaveAt = 0;
    let lastWaveX = -1e4;
    let lastWaveY = -1e4;

    function startGather(fromScatter) {
      if (!particles.length) return;
      const now = performance.now();
      const spread = reduceMotion ? 0 : settings.scatter;
      particles.forEach((particle) => {
        if (fromScatter) {
          const angle = particle.seed * Math.PI * 2;
          const distance = spread * (0.35 + particle.depth * 0.75);
          particle.x = particle.targetX + Math.cos(angle) * distance + (particle.depth - 0.5) * spread * 0.55;
          particle.y = particle.targetY + Math.sin(angle) * distance + (particle.seed - 0.5) * spread * 0.55;
        }
        particle.startX = particle.x;
        particle.startY = particle.y;
        particle.delay = reduceMotion ? 0 : particle.seed * settings.stagger;
      });
      gatherStart = now;
      gathering = true;
    }

    function drawParticle(particle) {
      // 柔边渐变贴图：绘制尺寸收紧，边缘渐隐但字形更清晰
      const size = particle.size * 2.2;
      ctx.drawImage(dotSprites[particle.spriteIndex], particle.x - size / 2, particle.y - size / 2, size, size);
    }

    function spawnWave(x, y) {
      const now = performance.now();
      if (now - lastWaveAt < 180) return;
      if (Math.hypot(x - lastWaveX, y - lastWaveY) < 24) return;
      lastWaveAt = now;
      lastWaveX = x;
      lastWaveY = y;
      waves.push({ x: x, y: y, born: now, amplitude: 14, speed: 220, width: 54, spread: 300, duration: 1.2 });
      if (waves.length > 6) waves.shift();
    }

    function waveField(x, y, now) {
      let wx = 0;
      let wy = 0;
      for (let i = waves.length - 1; i >= 0; i--) {
        const w = waves[i];
        const age = (now - w.born) / 1000;
        if (age >= w.duration) {
          waves.splice(i, 1);
          continue;
        }
        const dx = x - w.x;
        const dy = y - w.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        const life = age / w.duration;
        // 平滑起落包络：入场无突变
        const env = Math.sin(Math.min(life, 1) * Math.PI) * (1 - life);
        // 平滑扩散的高斯脉冲环：无高频正弦振荡，波纹柔和不抖动
        const travel = w.speed * age;
        const ring = dist - travel;
        const gauss = Math.exp(-(ring * ring) / (2 * w.width * w.width));
        const amp = w.amplitude * env * gauss * Math.exp(-dist / w.spread);
        wx += amp * (dx / dist);
        wy += amp * (dy / dist);
      }
      return { wx: wx, wy: wy };
    }

    function render(now) {
      if (!heroVisible || !pageVisible || document.hidden) {
        animationFrame = 0;
        return;
      }
      // 空闲（已成形且无交互）时降到 ~30fps，交互/汇聚期间保持 60fps
      const idle = !gathering && !pointer.active && waves.length === 0;
      const interval = idle ? 33 : 16;
      if (now - lastRender < interval) {
        animationFrame = requestAnimationFrame(render);
        return;
      }
      lastRender = now;
      ctx.clearRect(0, 0, width, height);
      // 柔边贴图自带光晕，省去昂贵的 shadowBlur 逐帧合成
      ctx.shadowBlur = 0;

      pointer.smoothX += (pointer.x - pointer.smoothX) * 0.18;
      pointer.smoothY += (pointer.y - pointer.smoothY) * 0.18;

      let complete = true;
      particles.forEach((particle) => {
        let baseX = particle.targetX;
        let baseY = particle.targetY;
        let progress = 1;

        if (gathering) {
          const local = (now - gatherStart - particle.delay) / Math.max(1, reduceMotion ? 1 : settings.gatherDuration);
          progress = clamp(local, 0, 1);
          const eased = easeOutCubic(progress);
          baseX = particle.startX + (particle.targetX - particle.startX) * eased;
          baseY = particle.startY + (particle.targetY - particle.startY) * eased;
          if (progress < 1) complete = false;
        } else if (!reduceMotion && settings.idleDrift > 0) {
          const driftTime = now * 0.001;
          baseX += Math.sin(driftTime * 0.9 + particle.seed * 10) * settings.idleDrift * particle.depth;
          baseY += Math.cos(driftTime * 0.75 + particle.depth * 10) * settings.idleDrift * particle.depth;
        }

        // hover 波动：与入场汇聚动画分离，只在文字成形后触发涟漪
        if (!reduceMotion && !gathering && waves.length) {
          const wf = waveField(baseX, baseY, now);
          baseX += wf.wx;
          baseY += wf.wy;
        }

        if (pointer.active && !reduceMotion && settings.pointerRepel > 0 && settings.repelRadius > 0) {
          const dx = baseX - pointer.smoothX;
          const dy = baseY - pointer.smoothY;
          const distance = Math.hypot(dx, dy);
          if (distance > 0 && distance < settings.repelRadius) {
            const force = Math.pow(1 - distance / settings.repelRadius, 2) * settings.pointerRepel;
            baseX += (dx / distance) * force;
            baseY += (dy / distance) * force;
          }
        }

        const follow = reduceMotion ? 1 : 0.22;
        particle.x += (baseX - particle.x) * follow;
        particle.y += (baseY - particle.y) * follow;

        ctx.globalAlpha = clamp(0.35 + progress * 0.65, 0, 1);
        drawParticle(particle);
      });

      ctx.globalAlpha = 1;
      if (gathering && complete) gathering = false;
      animationFrame = requestAnimationFrame(render);
    }

    function ensureRenderLoop() {
      if (heroVisible && pageVisible && !document.hidden && animationFrame === null) {
        animationFrame = requestAnimationFrame(render);
      }
    }

    function resolveFontSize(value, fontWeight, fontFamily) {
      if (typeof value === "number") return value;
      const probe = document.createElement("span");
      probe.textContent = "M";
      probe.style.position = "absolute";
      probe.style.visibility = "hidden";
      probe.style.pointerEvents = "none";
      probe.style.fontSize = value;
      probe.style.fontWeight = String(fontWeight);
      probe.style.fontFamily = fontFamily;
      container.appendChild(probe);
      const size = parseFloat(getComputedStyle(probe).fontSize) || 96;
      probe.remove();
      return size;
    }

    async function waitForFonts(font) {
      if (!("fonts" in document)) return;
      try {
        await document.fonts.load(font);
      } catch (e) { /* 忽略字体加载失败，用当前可用字体采样 */ }
      await document.fonts.ready;
    }

    async function sampleText() {
      const currentBuild = ++buildId;
      const rect = container.getBoundingClientRect();
      width = Math.floor(rect.width);
      height = Math.floor(rect.height);
      if (width <= 0 || height <= 0) return;

      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const computed = getComputedStyle(container);
      const resolvedFamily = computed.fontFamily || "sans-serif";
      let resolvedSize = resolveFontSize(settings.fontSize, settings.fontWeight, resolvedFamily);
      let font = settings.fontWeight + " " + resolvedSize + "px " + resolvedFamily;

      await waitForFonts(font);
      if (currentBuild !== buildId) return;

      const offscreen = document.createElement("canvas");
      const offCtx = offscreen.getContext("2d", { willReadFrequently: true });
      if (!offCtx) return;

      const content = String(settings.text || " ");
      const maxTextWidth = width * 0.92;
      offCtx.font = font;
      let metrics = offCtx.measureText(content);
      let measuredWidth = Math.max(1, metrics.width);
      if (measuredWidth > maxTextWidth) {
        resolvedSize = Math.max(18, resolvedSize * (maxTextWidth / measuredWidth));
        font = settings.fontWeight + " " + resolvedSize + "px " + resolvedFamily;
        await waitForFonts(font);
        if (currentBuild !== buildId) return;
        offCtx.font = font;
        metrics = offCtx.measureText(content);
      }

      const left = Math.ceil(metrics.actualBoundingBoxLeft || 0);
      const right = Math.ceil(metrics.actualBoundingBoxRight || metrics.width);
      const ascent = Math.ceil(metrics.actualBoundingBoxAscent || resolvedSize * 0.78);
      const descent = Math.ceil(metrics.actualBoundingBoxDescent || resolvedSize * 0.22);
      const padding = Math.max(12, Math.ceil(resolvedSize * 0.08));
      const textWidth = Math.max(1, left + right);
      const textHeight = Math.max(1, ascent + descent);

      offscreen.width = textWidth + padding * 2;
      offscreen.height = textHeight + padding * 2;
      offCtx.clearRect(0, 0, offscreen.width, offscreen.height);
      offCtx.font = font;
      offCtx.textAlign = "left";
      offCtx.textBaseline = "alphabetic";
      offCtx.fillStyle = "#ffffff";
      offCtx.fillText(content, padding - left, padding + ascent);

      const imageData = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
      const targets = [];
      const step = Math.max(2, settings.density);
      for (let y = 0; y < offscreen.height; y += step) {
        for (let x = 0; x < offscreen.width; x += step) {
          const xi = Math.min(offscreen.width - 1, Math.floor(x));
          const yi = Math.min(offscreen.height - 1, Math.floor(y));
          const alpha = imageData.data[(yi * offscreen.width + xi) * 4 + 3];
          if (alpha > 90) {
            targets.push({ x: width / 2 - offscreen.width / 2 + x, y: height / 2 - offscreen.height / 2 + y, alpha: alpha / 255 });
          }
        }
      }

      const maxParticles = Math.max(1800, Math.min(4600, Math.floor((width * height) / 36)));
      const stride = Math.max(1, Math.ceil(targets.length / maxParticles));
      const baseRgb = hexToRgb(settings.color);
      const highlightRgb = hexToRgb(settings.highlightColor);
      const selected = targets.filter((_, index) => index % stride === 0);

      particles = selected.map((target, index) => {
        const seed = ((index * 9301 + 49297) % 233280) / 233280;
        const depth = 0.45 + (((index * 233 + 97) % 1000) / 1000) * 0.9;
        const blend = baseRgb && highlightRgb ? clamp((target.x / Math.max(1, width)) * 0.45 + (seed - 0.5) * 0.18, 0, 1) : 0;
        const spriteIndex = Math.round(clamp(blend, 0, 1) * (SPRITE_BUCKETS - 1));
        const angle = seed * Math.PI * 2;
        const distance = (reduceMotion ? 0 : settings.scatter) * (0.35 + depth * 0.75);
        const startX = target.x + Math.cos(angle) * distance + (seed - 0.5) * settings.scatter * 0.45;
        const startY = target.y + Math.sin(angle) * distance + (depth - 0.9) * settings.scatter * 0.45;
        return {
          x: reduceMotion ? target.x : startX,
          y: reduceMotion ? target.y : startY,
          startX: startX,
          startY: startY,
          targetX: target.x,
          targetY: target.y,
          size: Math.max(0.6, settings.particleSize * (0.75 + target.alpha * 0.45)),
          spriteIndex: spriteIndex,
          seed: seed,
          depth: depth,
          delay: seed * settings.stagger
        };
      });

      pointer.x = width / 2;
      pointer.y = height / 2;
      pointer.smoothX = pointer.x;
      pointer.smoothY = pointer.y;

      if (reduceMotion) {
        particles.forEach((particle) => {
          particle.x = particle.targetX;
          particle.y = particle.targetY;
          particle.startX = particle.targetX;
          particle.startY = particle.targetY;
          particle.delay = 0;
        });
        gathering = false;
        // 减弱动效：静态绘制一帧，不启动渲染循环
        ctx.clearRect(0, 0, width, height);
        particles.forEach((particle) => drawParticle(particle));
        return;
      }
      startGather(false);
      ensureRenderLoop();
    }

    function queueSample() {
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(sampleText);
    }

    const handlePointerMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = true;
      spawnWave(pointer.x, pointer.y);
    };
    const handlePointerLeave = () => { pointer.active = false; };
    const handlePointerEnter = (event) => {
      handlePointerMove(event);
    };
    const handleClick = () => { startGather(true); };

    canvas.addEventListener("pointerenter", handlePointerEnter);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerleave", handlePointerLeave);
    canvas.addEventListener("click", handleClick);

    const ro = new ResizeObserver(queueSample);
    ro.observe(container);
    // 首屏滚出视口后暂停粒子渲染，避免后台持续消耗 GPU
    const heroIo = new IntersectionObserver((entries) => {
      heroVisible = entries.some((en) => en.isIntersecting);
      if (!heroVisible) {
        if (animationFrame) cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      } else if (animationFrame === 0) {
        ensureRenderLoop();
      }
    }, { threshold: 0 });
    heroIo.observe(container);
    document.addEventListener("visibilitychange", () => {
      pageVisible = !document.hidden;
      if (!pageVisible) {
        if (animationFrame) cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      } else if (heroVisible && animationFrame === 0) {
        ensureRenderLoop();
      }
    });
    sampleText();
  }

  /* ============ 启动 ============ */
  /* ============ 预加载：等待关键资源就绪后淡出 Loading ============ */
  function initPreloader() {
    const el = document.getElementById("preloader");
    if (!el) return;

    const started = performance.now();
    const MIN_MS = 600;   // 至少展示 0.6s，避免闪一下
    const MAX_MS = 3000;  // 兜底：最多 3s，资源再慢也不卡住页面
    let done = false;

    function finish() {
      if (done) return;
      done = true;
      el.classList.add("is-done");
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 700);
    }

    const marks = {
      load: document.readyState === "complete",
      fonts: !(document.fonts && document.fonts.ready)
    };
    let resourcesReady = false;

    function check() {
      if (resourcesReady || !(marks.load && marks.fonts)) return;
      resourcesReady = true;
      const wait = Math.max(0, MIN_MS - (performance.now() - started));
      setTimeout(finish, wait);
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { marks.fonts = true; check(); });
    }
    window.addEventListener("load", () => { marks.load = true; check(); });
    // 兜底超时：无论资源是否就绪，最多等待 MAX_MS 后关闭
    setTimeout(() => { marks.load = true; marks.fonts = true; check(); }, MAX_MS);
    check();
  }

  document.addEventListener("DOMContentLoaded", () => {
    initPreloader();
    initAccordionGallery();
    initParticleText();
    initLightTunnel();

    initReveal();
    initParallax();
    initHeroParallax();
    initHeroScroll();
    initBorderGlow();
    renderNews();
    if (parallaxState) parallaxState.refresh();
    renderWeights();
    renderForecast();
    initNewsControls();
    initGraphLegend();
    graphClick("p1");
    initInsights();
    initModal();
    initTools();
    initNav();
    initChartActions();

    window.CHARTS.initAll(graphClick);
    initChartDrills();

    let resizeT;
    window.addEventListener("resize", () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(() => window.CHARTS.resize(), 180);
    });
  });
})();
