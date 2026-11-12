/* =====================================================================
 * 《西游记》西天取经动态路线图 · 逻辑层
 * ---------------------------------------------------------------------
 * 零依赖：原生 SVG(Canvas2D 仅用于纸纹 / 金尘) + Web Audio。
 * 数据全部来自 XIYOU_DATA（js/data.js），本文件只负责渲染与交互。
 * ===================================================================== */
(function () {
  'use strict';

  var D = window.XIYOU_DATA;
  var M = D.META, TEAM = D.TEAM, ANCHORS = D.ANCHORS;
  var CALAMITIES = D.CALAMITIES, HELPERS = D.HELPERS;
  var REGIONS = D.REGIONS;

  /* 纵向舒展属于渲染层：数据层只存原始 y，此处生成视图副本，不改数据对象 */
  var Y_STRETCH = 1.20, Y_BASE = 360;   // 42 站下收敛振幅，避免路线呈锯齿状
  var POINTS = D.WAYPOINTS.map(function (p) {
    var q = {};
    for (var k in p) q[k] = p[k];
    q.y = Math.round(Y_BASE + (p.y - Y_BASE) * Y_STRETCH);
    return q;
  });
  var LAST = POINTS.length - 1;
  var NS = 'http://www.w3.org/2000/svg';
  var $ = function (sel) { return document.querySelector(sel); };

  var svg = $('#map');
  var regionLayer = $('#regionLayer');
  var worldLayer = $('#worldLayer');
  var atmosLayer = $('#atmosLayer');
  var aidLayer = $('#aidLayer');
  var routeLayer = $('#routeLayer');
  var anchorLayer = $('#anchorLayer');
  var nodeLayer = $('#nodeLayer');
  var penLayer = $('#penLayer');
  var tooltip = $('#tooltip');

  /* ---------------- 全局状态 ---------------- */
  var state = {
    progress: 0,         // 行程进度：时间轴 / 路线 / 难数 / 团队
    browse: -1,          // 档案浏览的站（-1 = 跟随行程）；点击节点不改变行程
    drawn: 0,            // 已绘制的路线弧长
    target: 0,           // 目标弧长
    totalLength: 0,
    nodeLens: [],
    playing: false,
    intro: false,        // 开场自动巡游
    aidMode: 'focus',    // focus 聚焦 / all 全览 / off 关闭
    soundOn: true,
    sidebarOpen: false,
    reduceMotion: false, // 遵循系统「减少动态效果」
    codexMode: null,     // 当前典藏面板：calamities / helper / demon
    viewLocked: false,   // 用户手动平移 / 缩放后，不再自动跟随当前站
    cameraOn: true,      // 卷轴镜头：播放 / 回放时随笔尖横移
    cameraActive: false,
    cameraReturning: false,
    cameraReturnAt: 0,
    mood: null,          // 当前氛围 tone
    replay: null,        // 劫难回放会话
    quoteFromReplay: false,
    quoteTimer: null,
    view: { x: 0, y: 0, w: M.mapWidth, h: M.mapHeight },
    lastFrame: 0,
    playTimer: null
  };

  var dom = {};   // 动态生成的 SVG 引用

  /* ================= 工具 ================= */
  function s(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function isNarrow() { return window.innerWidth <= 640; }

  /** 窄屏默认给一段局部视口，避免 1600 宽长卷被压成一条细带 */
  function defaultView() {
    if (!isNarrow()) return { x: 0, y: 0, w: M.mapWidth, h: M.mapHeight };
    var w = 760;
    return {
      x: clamp(POINTS[state.progress].x - w / 2, 0, M.mapWidth - w),
      y: 0, w: w, h: M.mapHeight
    };
  }
  function recenterView() {
    if (!isNarrow() || state.viewLocked || state.cameraActive || state.cameraReturning) return;
    var w = 760;
    state.view.w = w; state.view.h = M.mapHeight;
    state.view.x = clamp(POINTS[state.progress].x - w / 2, 0, M.mapWidth - w);
    applyView();
  }
  function esc(str) { return String(str).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /** Catmull-Rom 插值转三次贝塞尔，得到柔顺的「手绘」路线 */
  function smoothPath(pts) {
    var d = 'M ' + pts[0].x + ' ' + pts[0].y;
    var tension = 0.86;
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      var c1x = p1.x + (p2.x - p0.x) / 6 * tension;
      var c1y = p1.y + (p2.y - p0.y) / 6 * tension;
      var c2x = p2.x - (p3.x - p1.x) / 6 * tension;
      var c2y = p2.y - (p3.y - p1.y) / 6 * tension;
      d += ' C ' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ', ' +
                   c2x.toFixed(1) + ' ' + c2y.toFixed(1) + ', ' + p2.x + ' ' + p2.y;
    }
    return d;
  }

  /** 求每个节点在路径上的弧长位置（保证单调递增，笔尖能精确停在节点上） */
  function measureNodes(path, pts) {
    var L = path.getTotalLength(), out = [], start = 0;
    for (var i = 0; i < pts.length; i++) {
      var best = start, bestDist = Infinity;
      var end = Math.min(L, start + 240);
      for (var l = start; l <= end; l += 1) {
        var p = path.getPointAtLength(l);
        var dd = (p.x - pts[i].x) * (p.x - pts[i].x) + (p.y - pts[i].y) * (p.y - pts[i].y);
        if (dd < bestDist) { bestDist = dd; best = l; }
      }
      out.push(best);
      start = best;
    }
    out[0] = 0;
    out[out.length - 1] = L;
    return out;
  }

  /* ================= 1. 宣纸纹理 & 金尘 ================= */
  function initPaper() {
    var tile = document.createElement('canvas');
    tile.width = tile.height = 256;
    var tc = tile.getContext('2d');
    var img = tc.createImageData(256, 256);
    for (var i = 0; i < img.data.length; i += 4) {
      var n = Math.random();
      var dark = n > 0.972;
      img.data[i] = dark ? 122 : 255;
      img.data[i + 1] = dark ? 98 : 250;
      img.data[i + 2] = dark ? 62 : 238;
      img.data[i + 3] = dark ? 34 : Math.floor(n * 16);
    }
    tc.putImageData(img, 0, 0);
    // 纸纤维
    tc.strokeStyle = 'rgba(150, 118, 66, 0.10)';
    tc.lineWidth = 0.6;
    for (var j = 0; j < 42; j++) {
      var x = Math.random() * 256, y = Math.random() * 256, len = 12 + Math.random() * 46;
      tc.beginPath(); tc.moveTo(x, y);
      tc.bezierCurveTo(x + len * .3, y - 3, x + len * .7, y + 3, x + len, y + (Math.random() - .5) * 4);
      tc.stroke();
    }

    var canvas = $('#paperCanvas'), ctx = canvas.getContext('2d');
    function resize() {
      canvas.width = window.innerWidth; canvas.height = window.innerHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = ctx.createPattern(tile, 'repeat');
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      var dust = $('#dustCanvas');
      dust.width = window.innerWidth; dust.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);
    return $('#dustCanvas').getContext('2d');
  }

  var dustCtx, motes = [];
  function initDust() {
    dustCtx = initPaper();
    motes = [];
    for (var i = 0; i < 44; i++) {
      motes.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: 0.7 + Math.random() * 1.9,
        vx: -0.06 - Math.random() * 0.16,
        vy: -0.03 - Math.random() * 0.12,
        a: 0.15 + Math.random() * 0.45,
        ph: Math.random() * Math.PI * 2
      });
    }
  }
  function drawDust(t) {
    if (!dustCtx || state.reduceMotion) return;
    var w = window.innerWidth, h = window.innerHeight;
    dustCtx.clearRect(0, 0, w, h);
    for (var i = 0; i < motes.length; i++) {
      var m = motes[i];
      m.x += m.vx; m.y += m.vy;
      if (m.y < -10) { m.y = h + 10; m.x = Math.random() * w; }
      if (m.x < -10) { m.x = w + 10; m.y = Math.random() * h; }
      var alpha = m.a * (0.55 + 0.45 * Math.sin(t / 900 + m.ph));
      dustCtx.beginPath();
      dustCtx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      dustCtx.fillStyle = 'rgba(214, 166, 72, ' + alpha.toFixed(3) + ')';
      dustCtx.fill();
    }
  }

  /* ================= 1b. 三大地理色区 · 氛围 · 妖气粒子 ================= */
  var REGION_GRAD = { jade: 'gradRegionJade', ochre: 'gradRegionOchre', gold: 'gradRegionGold' };

  function drawRegions() {
    REGIONS.forEach(function (r) {
      var w = r.x1 - r.x0, cx = r.x0 + w / 2;
      s('rect', {
        x: r.x0, y: 24, width: w, height: 672,
        class: 'rg-band', fill: 'url(#' + REGION_GRAD[r.tone] + ')'
      }, regionLayer);
      if (r.x0 > 0) {
        s('path', { d: 'M ' + r.x0 + ' 30 L ' + r.x0 + ' 690', class: 'rg-edge' }, regionLayer);
      }
      // 区内地貌提示：大唐阡陌 / 西域沙丘 / 天竺塔影，极淡，不抢金线
      for (var k = 0; k < 3; k++) {
        var yy = 512 + k * 36;
        var d;
        if (r.tone === 'jade') {
          d = 'M ' + (r.x0 + 40) + ' ' + yy + ' H ' + (r.x1 - 40);
        } else if (r.tone === 'ochre') {
          d = 'M ' + (r.x0 + 30) + ' ' + yy + ' q 90 -26 180 0 t 180 0 t 180 0 t 180 0';
        } else {
          d = 'M ' + (r.x0 + 30) + ' ' + yy + ' l 18 -22 h 30 l 18 22 M ' +
              (r.x0 + 180) + ' ' + yy + ' l 14 -18 h 24 l 14 18';
        }
        s('path', { d: d, class: 'rg-motif m-' + r.tone }, regionLayer);
      }
      // 区名小匾
      s('rect', { x: cx - 62, y: 42, width: 124, height: 34, rx: 2, class: 'rg-plate' }, regionLayer);
      var nm = s('text', { x: cx, y: 56, class: 'rg-name' }, regionLayer); nm.textContent = r.name;
      var sb = s('text', { x: cx, y: 69, class: 'rg-sub' }, regionLayer); sb.textContent = r.sub;
    });
  }

  /** 按当前氛围重绘局部特效层：始终位于金线之下，不遮挡路线 */
  function drawAtmosphere(mood) {
    atmosLayer.innerHTML = '';
    if (!mood) return;
    var cx = POINTS[Math.floor((mood.from + mood.to) / 2)].x;
    var g = s('g', { class: 'atmos', 'data-mood': mood.tone }, atmosLayer);
    var i, x, d;

    if (mood.tone === 'fire') {
      s('rect', { x: cx - 235, y: 110, width: 470, height: 610, fill: 'url(#gradFireHalo)' }, g);
      // 长短、间距、终点各不相同，避免整齐排成「栅栏」
      [[-158, 556, 366], [-96, 574, 326], [-24, 544, 384], [44, 566, 340], [110, 550, 372], [172, 578, 318]]
        .forEach(function (h, k) {
          x = cx + h[0];
          d = 'M ' + x + ' ' + h[1] + ' C ' + (x - 26) + ' ' + (h[1] - 58) + ' ' +
              (x + 24) + ' ' + (h[1] - 108) + ' ' + x + ' ' + (h[1] - 162) +
              ' S ' + (x - 18) + ' ' + (h[2] + 42) + ' ' + (x + 10) + ' ' + h[2];
          s('path', { d: d, class: 'heat-wave', style: 'animation-delay:' + (-k * 0.62).toFixed(2) + 's' }, g);
        });
    } else if (mood.tone === 'ice') {
      s('rect', { x: cx - 235, y: 120, width: 470, height: 590, fill: 'url(#gradIceHalo)' }, g);
      for (i = 0; i < 4; i++) {
        var iy = 420 + i * 42;
        d = 'M ' + (cx - 180) + ' ' + iy + ' q 45 -16 90 0 t 90 0 t 90 0 t 90 0';
        s('path', { d: d, class: 'ice-line' }, g);
      }
      for (i = 0; i < 9; i++) {
        x = cx - 150 + i * 38;
        s('path', {
          d: 'M ' + x + ' ' + (382 + (i % 3) * 26) + ' l 5 -9 l 5 9 l -5 9 z', class: 'ice-shard'
        }, g);
      }
    } else if (mood.tone === 'dark') {
      s('rect', { x: cx - 240, y: 90, width: 480, height: 610, fill: 'url(#gradDark)' }, g);
      // 模糊的妖雾团 + 少量不规则妖气丝，替代整齐的竖线阵列
      [[-150, 300, 96, 58], [18, 384, 120, 66], [-72, 470, 88, 48], [112, 306, 72, 44]]
        .forEach(function (o) {
          s('ellipse', {
            cx: cx + o[0], cy: o[1], rx: o[2], ry: o[3],
            fill: '#4a1b48', opacity: .13, filter: 'url(#fSoft)'
          }, g);
        });
      [[-190, 606, 268], [-64, 622, 296], [78, 592, 240], [188, 616, 310]]
        .forEach(function (w, k) {
          x = cx + w[0];
          d = 'M ' + x + ' ' + w[1] + ' C ' + (x - 32) + ' 508 ' + (x + 34) + ' 414 ' + (x - 8) + ' ' + w[2];
          s('path', { d: d, class: 'dark-wisp', style: 'animation-delay:' + (-k * 1.4).toFixed(2) + 's' }, g);
        });
    } else if (mood.tone === 'holy') {
      s('rect', { x: cx - 230, y: 60, width: 460, height: 640, fill: 'url(#gradHoly)' }, g);
      var hy = POINTS[Math.floor((mood.from + mood.to) / 2)].y;
      for (i = 0; i < 14; i++) {
        var a = i * Math.PI / 7, len = 110 + (i % 3) * 40;
        s('line', {
          x1: cx + Math.cos(a) * 34, y1: hy + Math.sin(a) * 34,
          x2: cx + Math.cos(a) * len, y2: hy + Math.sin(a) * len, class: 'holy-ray'
        }, g);
      }
    } else if (mood.tone === 'blossom') {
      s('rect', { x: cx - 200, y: 100, width: 400, height: 590, fill: 'url(#gradPetal)' }, g);
      for (i = 0; i < 11; i++) {
        s('ellipse', {
          cx: (cx - 170 + i * 34).toFixed(1), cy: (220 + (i % 4) * 42).toFixed(1),
          rx: 3.6, ry: 6, class: 'petal', style: 'animation-delay:' + (-i * 0.55).toFixed(2) + 's'
        }, g);
      }
    }
  }

  function setMood(i) {
    var mood = D.moodAt(i), tone = mood ? mood.tone : '';
    if (state.mood !== tone) {
      state.mood = tone;
      var area = $('#mapArea');
      if (tone) area.setAttribute('data-mood', tone);
      else area.removeAttribute('data-mood');
      drawAtmosphere(mood);
    }
    updatePlaque(i);
  }

  function updatePlaque(i) {
    var r = D.regionAt(POINTS[i].x), mood = D.moodAt(i);
    $('#rpRegion').textContent = r.name;
    $('#rpSub').textContent = r.sub;
    $('#rpMood').textContent = mood ? mood.title + '　·　' + mood.verse : '';
    $('#regionPlaque').classList.toggle('has-mood', !!mood);
  }

  /** SVG 用户坐标 → canvas 局部坐标（与 preserveAspectRatio="meet" 一致） */
  function project(x, y) {
    var v = state.view, rect = svg.getBoundingClientRect();
    var scale = Math.min(rect.width / v.w, rect.height / v.h);
    var offX = (rect.width - v.w * scale) / 2, offY = (rect.height - v.h * scale) / 2;
    return { x: offX + (x - v.x) * scale, y: offY + (y - v.y) * scale, k: scale };
  }

  var auraCtx = null, auraMotes = {};
  function initAura() { auraCtx = $('#auraCanvas').getContext('2d'); resizeAura(); }
  function resizeAura() {
    var c = $('#auraCanvas'), r = svg.getBoundingClientRect();
    c.width = Math.max(1, Math.round(r.width));
    c.height = Math.max(1, Math.round(r.height));
  }
  function moteSet(i) {
    if (!auraMotes[i]) {
      var arr = [];
      for (var n = 0; n < 7; n++) {
        arr.push({ a: Math.random() * Math.PI * 2, r0: Math.random(), off: Math.random(),
          spd: .18 + Math.random() * .16, size: .6 + Math.random() * .9 });
      }
      auraMotes[i] = arr;
    }
    return auraMotes[i];
  }
  /** 妖气粒子：只保留已到达且靠近焦点的妖穴，最多 8 处，避免全图紫雾 */
  function auraSources() {
    var reached = reachedIndex(), focus = state.browse >= 0 ? state.browse : state.progress, out = [];
    POINTS.forEach(function (p, i) {
      if (!p.demons.length || i > reached) return;
      if (Math.abs(i - focus) <= 3 || i === reached) out.push(i);
    });
    return out.slice(-8);
  }
  function drawAura(t) {
    if (!auraCtx) return;
    var c = auraCtx.canvas;
    auraCtx.clearRect(0, 0, c.width, c.height);
    var time = state.reduceMotion ? 0 : t / 1000;
    auraSources().forEach(function (i) {
      var p = POINTS[i], base = project(p.x, p.y);
      if (base.x < -60 || base.x > c.width + 60 || base.y < -60 || base.y > c.height + 60) return;
      var crimson = p.type === 'demon' || p.demons.length >= 2;
      var rgb = crimson ? '158,38,60' : '104,44,132';
      moteSet(i).forEach(function (m) {
        var ph = time * (0.5 + m.spd) + m.a;
        var radius = (9 + 24 * m.r0 + Math.sin(ph * 0.8) * 5) * Math.min(1.3, Math.max(.65, base.k));
        var rise = state.reduceMotion ? .5 : ((time * m.spd + m.off) % 1);
        var x = base.x + Math.cos(ph) * radius;
        var y = base.y - 4 - rise * 46 * Math.max(.6, base.k);
        var alpha = (0.10 + 0.18 * Math.sin(rise * Math.PI)) * (crimson ? 1 : .85);
        auraCtx.globalAlpha = alpha;
        auraCtx.fillStyle = 'rgb(' + rgb + ')';
        auraCtx.beginPath(); auraCtx.arc(x, y, (1.5 + m.size * .8) * Math.max(.7, base.k), 0, Math.PI * 2); auraCtx.fill();
        auraCtx.globalAlpha = alpha * .26;
        auraCtx.beginPath(); auraCtx.arc(x, y, (5.5 + m.size * 1.4) * Math.max(.7, base.k), 0, Math.PI * 2); auraCtx.fill();
      });
    });
    auraCtx.globalAlpha = 1;
  }

  /* ================= 2. 古地图背景 ================= */
  function drawWorld() {
    // 42 站长卷宽 1600：山水纹样按 1280 底稿等比横向铺开，日轮与文字另画以免变形
    var k = M.mapWidth / 1280;
    var bg = s('g', { transform: 'scale(' + k.toFixed(4) + ' 1)' }, worldLayer);

    s('rect', { x: 16, y: 16, width: 1248, height: 688, rx: 4, class: 'w-frame' }, bg);
    s('rect', { x: 23, y: 23, width: 1234, height: 674, rx: 2, class: 'w-frame', opacity: .5 }, bg);

    // 远山（两层）
    s('path', {
      d: 'M16 596 Q96 516 172 574 T330 556 Q412 486 486 552 T646 576 Q728 508 806 566 T968 548 Q1056 480 1140 558 T1264 544 L1264 704 L16 704 Z',
      class: 'w-mountain'
    }, bg);
    s('path', {
      d: 'M16 646 Q110 590 200 634 T390 622 Q470 566 560 620 T740 638 Q840 578 930 626 T1100 616 Q1190 570 1264 620 L1264 704 L16 704 Z',
      class: 'w-mountain-2'
    }, bg);

    // 河脉与戈壁点纹
    s('path', { d: 'M60 512 C240 470 300 610 470 566 S720 470 880 528 S1100 612 1240 566', class: 'w-river' }, bg);
    s('path', { d: 'M120 220 C300 180 420 246 600 208 S930 176 1180 220', class: 'w-cloud' }, bg);
    for (var i = 0; i < 112; i++) {
      var x = 60 + Math.random() * 1160, y = 480 + Math.random() * 190;
      s('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: (0.6 + Math.random() * 1.5).toFixed(1), class: 'w-dot' }, bg);
    }
    // 如意云纹
    [[110, 170, 1], [430, 110, .8], [760, 150, 1.1], [980, 196, .75], [180, 470, .7], [640, 470, .8]].forEach(function (c) {
      var x = c[0], y = c[1], kk = c[2];
      s('path', {
        d: 'M' + x + ' ' + y + ' c0 -' + (12 * kk) + ' ' + (14 * kk) + ' -' + (18 * kk) + ' ' + (24 * kk) + ' -' + (12 * kk) +
           ' c' + (6 * kk) + ' -' + (15 * kk) + ' ' + (27 * kk) + ' -' + (13 * kk) + ' ' + (31 * kk) + ' ' + (2 * kk) +
           ' c' + (13 * kk) + ' -' + (4 * kk) + ' ' + (21 * kk) + ' ' + (5 * kk) + ' ' + (18 * kk) + ' ' + (13 * kk),
        class: 'w-cloud'
      }, bg);
    });

    // 日轮（右上，长安方向）与地名水印：使用真实长卷坐标，不被横向拉伸
    s('circle', { cx: 1425, cy: 132, r: 92, fill: 'url(#gradSun)', opacity: .45 }, worldLayer);
    s('circle', { cx: 1425, cy: 132, r: 30, fill: 'none', stroke: '#d9ae61', 'stroke-width': 1, opacity: .38 }, worldLayer);
    [['大唐', 1470, 232], ['河西', 1170, 626], ['西域', 700, 158], ['天竺', 190, 210], ['灵山', 80, 500]].forEach(function (t) {
      var e = s('text', { x: t[1], y: t[2], class: 'w-label', 'text-anchor': 'middle' }, worldLayer);
      e.textContent = t[0];
    });
  }

  /* ================= 3. 路线 / 笔尖 / 裁切 ================= */
  function drawRoute() {
    var pts = POINTS.map(function (p) { return { x: p.x, y: p.y }; });
    var d = smoothPath(pts);

    var defs = svg.querySelector('defs');
    var clip = s('clipPath', { id: 'growClip' }, defs);
    dom.clipRect = s('rect', { x: 0, y: 0, width: 0, height: M.mapHeight }, clip);

    dom.ghost = s('path', { d: d, class: 'route-ghost' }, routeLayer);
    dom.red = s('path', { d: d, class: 'route-red' }, routeLayer);
    dom.main = s('path', { d: d, class: 'route-main' }, routeLayer);
    dom.flow = s('path', { d: d, class: 'route-flow', 'clip-path': 'url(#growClip)' }, routeLayer);

    state.totalLength = dom.main.getTotalLength();
    state.nodeLens = measureNodes(dom.main, pts);

    [dom.red, dom.main].forEach(function (p) {
      p.style.strokeDasharray = state.totalLength + ' ' + state.totalLength;
      p.style.strokeDashoffset = state.totalLength;
    });

    dom.pen = s('g', { class: 'pen' }, penLayer);
    s('circle', { cx: 0, cy: 0, r: 26, class: 'pen-halo' }, dom.pen);
    s('circle', { cx: 0, cy: 0, r: 15, class: 'pen-ring' }, dom.pen);
    s('circle', { cx: 0, cy: 0, r: 4.2, class: 'pen-core' }, dom.pen);
  }

  /* ================= 4. 天界锚点 & 神仙援助线 ================= */
  function drawAnchors() {
    Object.keys(ANCHORS).forEach(function (key) {
      var a = ANCHORS[key];
      var g = s('g', { class: 'anchor', transform: 'translate(' + a.x + ',' + a.y + ')' }, anchorLayer);
      s('circle', { cx: 0, cy: 0, r: 40, class: 'anchor-bg' }, g);
      s('circle', { cx: 0, cy: 0, r: 31, fill: 'none', stroke: 'rgba(121,86,166,.35)', 'stroke-width': 1, 'stroke-dasharray': '2 4' }, g);
      s('use', { href: '#' + a.icon, x: -20, y: -38, width: 40, height: 40, class: 'anchor-icon' }, g);
      var n = s('text', { x: 0, y: 54, class: 'anchor-name' }, g); n.textContent = a.short + ' · ' + (key === 'heaven' ? '诸天神佛' : '观音道场');
      var d = s('text', { x: 0, y: 68, class: 'anchor-desc' }, g); d.textContent = a.desc;
    });
  }

  function drawAidLines() {
    dom.aidLines = {};
    POINTS.forEach(function (p) {
      if (!p.aid) return;
      var a = ANCHORS[p.aid];
      // 天庭自上而下、南海自下而上，用二次贝塞尔形成「天降」弧线
      var cx = (a.x + p.x) / 2;
      var cy = Math.min(a.y, p.y) - (p.aid === 'heaven' ? 46 : 12);
      var d = 'M ' + a.x + ' ' + a.y + ' Q ' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + p.x + ' ' + p.y;
      var line = s('path', { d: d, class: 'aid-line', 'data-index': p.index }, aidLayer);
      dom.aidLines[p.index] = line;
    });
  }

  /* ================= 5. 地点节点 ================= */
  var ICONS = {
    capital: 'i-capital', city: 'i-city', temple: 'i-temple', mountain: 'i-mountain',
    water: 'i-water', cave: 'i-cave', demon: 'i-demon', destination: 'i-destination'
  };
  function drawNodes() {
    dom.nodes = [];
    POINTS.forEach(function (p) {
      var above = p.index % 2 === 0;
      var g = s('g', {
        class: 'node' + (p.isDemonLair || p.type === 'demon' ? ' demon' : '') + (p.landmark ? ' landmark' : ''),
        transform: 'translate(' + p.x + ',' + p.y + ')',
        'data-index': p.index, tabindex: 0, role: 'button',
        'aria-label': p.name + '，' + p.era
      }, nodeLayer);

      // 42 站长卷：节点略缩尺，保证 35px 站距下不互相压叠
      // 妖气不再用静态光晕，改由 #auraCanvas 的粒子层绘制（见 drawAura）
      s('circle', { cx: 0, cy: 0, r: 22, class: 'halo' }, g);
      s('circle', { cx: 0, cy: 0, r: 15, class: 'pulse' }, g);
      s('circle', { cx: 0, cy: 0, r: 14.5, class: 'plate' }, g);
      s('circle', { cx: 0, cy: 0, r: 11.5, class: 'plate-inner' }, g);
      s('use', { href: '#' + ICONS[p.type], x: -12, y: -12, width: 24, height: 24, class: 'icon' }, g);

      var ly = above ? -23 : 33;
      var label = s('text', { x: 0, y: ly, class: 'nlabel' }, g);
      label.textContent = p.name.length > 7 ? p.name.slice(0, 6) + '…' : p.name;
      var sub = s('text', { x: 0, y: ly + (above ? -12 : 12), class: 'nsub' }, g);
      sub.textContent = p.year + ' · ' + (p.demons.length ? p.demons[0].replace(/（.*?）/g, '') : p.sub).slice(0, 8);

      s('circle', { cx: 0, cy: 0, r: 21, class: 'hit' }, g);
      dom.nodes.push(g);
    });
  }

  /* ================= 6. 团队面板 ================= */
  function buildTeam() {
    var box = $('#teamList');
    box.innerHTML = TEAM.map(function (t) {
      return '<div class="team-item" data-id="' + t.id + '">' +
        '<div class="avatar"><svg viewBox="0 0 40 40"><use href="#' + t.icon + '" width="40" height="40"></use></svg>' +
        '<span class="tbadge"></span></div>' +
        '<span class="tname">' + esc(t.name) + '</span></div>';
    }).join('');
  }

  /** 成员状态机：未至 → 在队 →（离队）→ 在队；悟空两次被逐由 TEAM.absences 描述 */
  function teamStatus(t, reached) {
    if (t.joinAt > reached) return { key: 'pending' };
    var away = (t.absences || []).filter(function (a) {
      return reached >= a.from && reached < a.until;
    })[0];
    if (away) return { key: 'away', info: away };
    return { key: 'on' };
  }
  function updateTeam(reached) {
    var on = 0, awayNote = '';
    TEAM.forEach(function (t) {
      var item = $('#teamList').querySelector('[data-id="' + t.id + '"]');
      var st = teamStatus(t, reached);
      var wasOn = item.classList.contains('on');
      var wasAway = item.classList.contains('away');
      item.classList.toggle('on', st.key === 'on');
      item.classList.toggle('away', st.key === 'away');
      item.classList.toggle('pending', st.key === 'pending');
      item.querySelector('.tbadge').textContent =
        st.key === 'away' ? '离' : (st.key === 'pending' ? '待' : '');
      item.title = st.key === 'away'
        ? t.name + ' · ' + st.info.label + '（' + st.info.chapter + '）\n' + st.info.note
        : t.name + ' · ' + t.role + (st.key === 'pending' ? '（尚未加入，' + POINTS[t.joinAt].name + '）' : '');
      if (st.key === 'on') {
        on++;
        if (!wasOn && !wasAway && t.joinAt > 0) {
          item.classList.add('just-in');
          setTimeout(function () { item.classList.remove('just-in'); }, 950);
        }
      }
      if (st.key === 'away') awayNote = '⚠ ' + t.name + st.info.label + '（' + st.info.chapter + '）';
    });
    $('#teamCount').textContent = on + ' / ' + TEAM.length;
    var next = TEAM.filter(function (t) { return t.joinAt > reached; })[0];
    $('#teamNote').textContent = awayNote || (next
      ? '待收徒：' + next.name + '（' + POINTS[next.joinAt].name + '）'
      : '师徒四众并白马 · 取经团队齐备');
    $('#teamPanel').classList.toggle('has-away', !!awayNote);
  }

  /* ================= 7. 劫难档案卡 ================= */
  function buildCard(i) {
    var p = POINTS[i];
    var demonTags = p.demons.length
      ? p.demons.map(function (d) { return '<span class="tag">' + esc(d) + '</span>'; }).join('')
      : '<span class="tag none">此站无妖 · ' + esc(p.sub) + '</span>';
    var helperTags = p.canonicalHelpers.map(function (h) {
      return '<button type="button" class="tag god clickable" data-helper="' + esc(h.name) + '" title="查看该神仙出手过的所有地点">' + esc(h.name) + '</button>';
    }).join('');
    var stamp = p.demons.length ? '遭遇<br>妖魔' : (p.type === 'destination' ? '功成<br>行满' : '西行<br>纪事');

    return '' +
      '<div class="card-top">' +
        '<div class="card-idx">第 ' + (i + 1) + ' 站 · 累计第 ' + p.calamity + ' 难</div>' +
        '<div class="card-name">' + esc(p.name) + '</div>' +
        '<div class="card-sub">' + esc(p.sub) + '　|　' + esc(p.type === 'demon' ? '妖氛' : ({ capital: '都城', city: '城邦', temple: '寺观', mountain: '山岭', water: '河涧', cave: '洞府', destination: '佛境' })[p.type]) + '</div>' +
        '<div class="card-stamp">' + stamp + '</div>' +
      '</div>' +
      '<div class="card-section"><h3>时地 · 回目</h3><div class="card-grid">' +
        '<div class="info-cell"><span class="k">发生时间</span><span class="v">' + esc(p.era) + '<br>公元 ' + p.year + ' 年</span></div>' +
        '<div class="info-cell"><span class="k">取经方位</span><span class="v">第 ' + (i + 1) + ' / ' + POINTS.length + ' 站<br>' + (p.aid ? esc(ANCHORS[p.aid].name) + '来援' : '自行度过') + '</span></div>' +
        '<div class="info-cell full"><span class="k">原著回目</span><span class="v">' + esc(p.chapter) + '</span></div>' +
      '</div>' +
      '<button type="button" class="comic-cta" data-act="comic">' +
        '<span class="cc-ic">📖</span>' +
        '<span class="cc-tx"><b>看漫画导读</b><small>四格分镜 · 整回导读 · 赏析 · 思考</small></span>' +
        '<span class="cc-ar">→</span>' +
      '</button>' +
      '</div>' +
      '<div class="card-section"><h3>遭遇妖魔</h3><div class="tag-row">' + demonTags + '</div></div>' +
      '<div class="card-section"><h3>降妖神仙 / 解厄者</h3><div class="tag-row">' + helperTags + '</div></div>' +
      '<div class="card-section"><h3>难簿 · 本站历难 <small>第九十九回</small></h3><div class="cal-list">' +
        (p.calamityList.length
          ? p.calamityList.map(function (c) {
              return '<button type="button" class="cal-chip' + (c.prelude ? ' prelude' : '') + '" data-calamity="' + c.n + '">' +
                '<i>' + c.n + '</i>' + esc(c.name) + '</button>';
            }).join('')
          : '<span class="tag none">本站无独立难目</span>') +
        (p.calamityList.some(function (c) { return c.prelude; })
          ? '<p class="cal-note">前四难为唐僧前尘（金蝉子、江流儿身世），难簿于灵山追记。</p>' : '') +
        (p.calamityList.some(function (c) { return c.note; })
          ? '<p class="cal-note">' + esc(p.calamityList.filter(function (c) { return c.note; })[0].note) + '</p>' : '') +
      '</div></div>' +
      '<div class="card-section"><h3>劫难本事</h3><div class="story">' + esc(p.story) + '</div></div>' +
      '<div class="card-replay">' +
        '<button type="button" data-act="replay">↺ 回放此劫<small>前后三站慢镜复演</small></button>' +
        (D.quoteAt(i) ? '<button type="button" data-act="quote">❝ 原著引文</button>' : '') +
      '</div>' +
      '<div class="card-foot"><span>九九八十一难 · 已历 ' + p.calamity + ' 难</span>' +
        '<div class="card-nav">' +
          '<button type="button" data-nav="prev" ' + (i === 0 ? 'disabled' : '') + '>← 上一站</button>' +
          '<button type="button" data-nav="next" ' + (i === LAST ? 'disabled' : '') + '>下一站 →</button>' +
        '</div></div>';
  }
  /** 浏览档案与行程进度分离时，给出明确的「回到当前行程」出口 */
  function cardBanner() {
    if (state.browse < 0 || state.browse === state.progress) return '';
    var cur = POINTS[state.progress];
    return '<div class="card-banner"><span>档案浏览 · 行程仍在 <b>' + esc(cur.name) +
      '</b>（' + cur.year + ' 年）</span>' +
      '<button type="button" data-nav="return">回到当前行程 →</button></div>';
  }
  function renderCard(i) {
    var body = $('#cardBody');
    body.innerHTML = cardBanner() + buildCard(i);
    body.scrollTop = 0;
    var ret = body.querySelector('[data-nav="return"]');
    if (ret) ret.addEventListener('click', function () {
      state.browse = -1;
      refreshCard();
      updateNodeStates(reachedIndex());
    });
    body.querySelectorAll('[data-nav="prev"], [data-nav="next"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var n = clamp(i + (btn.dataset.nav === 'next' ? 1 : -1), 0, LAST);
        stopIntro(); selectNode(n, true);
      });
    });
    body.querySelectorAll('[data-calamity]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openCodex('calamities', +btn.dataset.calamity);
      });
    });
    // 神仙标签可点：直接反查该神仙出手过的所有地点
    body.querySelectorAll('[data-helper]').forEach(function (tag) {
      tag.addEventListener('click', function () { openCodex('helper', tag.dataset.helper); });
    });
    // 叙事入口：漫画导读 / 慢镜回放 / 原著引文
    body.querySelectorAll('[data-act="comic"]').forEach(function (btn) {
      btn.addEventListener('click', function () { stopIntro(); openComic(i); });
    });
    body.querySelectorAll('[data-act="replay"]').forEach(function (btn) {
      btn.addEventListener('click', function () { startReplay(i); });
    });
    body.querySelectorAll('[data-act="quote"]').forEach(function (btn) {
      btn.addEventListener('click', function () { openQuote(i, false); });
    });
  }
  function currentCardIndex() { return state.browse >= 0 ? state.browse : state.progress; }
  function refreshCard() { if (state.sidebarOpen) renderCard(currentCardIndex()); }

  /* ================= 7b. 检索（地点 / 神仙 / 妖魔 / 回目 / 难目） ================= */
  function closeSearch() {
    $('#searchResults').classList.remove('open');
    $('#searchResults').innerHTML = '';
  }
  function placeItem(i) {
    var p = POINTS[i];
    return '<button type="button" class="sr-item" data-place="' + i + '">' +
      '<b>第 ' + (i + 1) + ' 站 · ' + esc(p.name) + '</b>' +
      '<small>' + esc(p.era) + ' · 第 ' + p.chapters[0] + (p.chapters[1] > p.chapters[0] ? '～' + p.chapters[1] : '') + ' 回 · ' + esc(p.sub) + '</small></button>';
  }
  function renderSearch(raw) {
    var q = String(raw || '').trim();
    var box = $('#searchResults');
    if (!q) { closeSearch(); return; }
    var r = D.lookup(q), html = '';
    function group(label, items) {
      if (!items.length) return;
      html += '<div class="sr-group"><span class="sr-label">' + label + '</span>' + items + '</div>';
    }
    // 地点放首位：搜「昴日星官」回车即直达毒敌山，神仙谱条目紧随其后供反查
    group('地点 · 共 ' + r.places.length + ' 处', r.places.slice(0, 7).map(placeItem).join(''));
    // 神仙谱（异称已归一）
    var gods = r.helpers.filter(function (n) { return n.indexOf(q) >= 0 || q.indexOf(n) >= 0; })
      .concat(r.helpers.filter(function (n) { return n.indexOf(q) < 0 && q.indexOf(n) < 0; }))
      .slice(0, 4);
    group('神仙谱 · 反查所有出手地点', gods.map(function (n) {
      var h = HELPERS.filter(function (x) { return x.name === n; })[0];
      return '<button type="button" class="sr-item god" data-helper="' + esc(n) + '">' +
        '<b>' + esc(n) + '</b><small>' + esc(h && h.meta ? h.meta.title : '诸天神佛') + ' · 出手 ' + h.count + ' 处</small></button>';
    }).join(''));
    // 妖魔谱
    group('妖魔谱', r.demons.slice(0, 3).map(function (n) {
      return '<button type="button" class="sr-item demon" data-demon="' + esc(n) + '">' +
        '<b>' + esc(n) + '</b><small>出现于 ' + (D.INDEX.demons[n] || []).length + ' 站</small></button>';
    }).join(''));
    // 回目
    if (r.chapterNo) {
      group('回目 · 第 ' + r.chapterNo + ' 回', r.chapters.map(placeItem).join(''));
    }
    // 难目
    group('八十一难', r.calamities.slice(0, 4).map(function (n) {
      var c = CALAMITIES[n - 1];
      return '<button type="button" class="sr-item" data-place="' + c.at + '">' +
        '<b>第 ' + n + ' 难 · ' + esc(c.name) + '</b><small>' + esc(POINTS[c.at].name) + '</small></button>';
    }).join(''));
    if (!html) html = '<div class="sr-empty">未检得「' + esc(q) + '」<br><small>可试地点、妖怪、神仙、回目（如 59）或难名</small></div>';
    box.innerHTML = html;
    box.classList.add('open');
  }

  /* ================= 7c. 典藏面板：八十一难难簿 / 神仙谱 / 妖魔谱 ================= */
  var SIDE_LABEL = { heaven: '天庭', sea: '南海 · 佛门', buddha: '西天 · 佛门', self: '取经人自行', court: '大唐朝廷' };
  function openCodex(mode, arg) {
    var title = '', body = '';
    var passed = POINTS[state.progress].calamity;

    if (mode === 'calamities') {
      title = '九九八十一难 · 观音难簿';
      body = '<p class="codex-lead">依第九十九回「灾难的簿子」原文逐条录入：难簿列至<b>凌云渡脱胎第八十难</b>，' +
        '观音补足归途<b>通天河落水</b>方成九九。朱砂底为已历（' + passed + ' / 81），悬停看地点，点击直达档案。</p>' +
        '<div class="codex-grid">' + CALAMITIES.map(function (c) {
          var p = POINTS[c.at];
          return '<button type="button" class="codex-item' + (c.n <= passed ? ' passed' : '') +
            (c.prelude ? ' prelude' : '') + (arg === c.n ? ' flash' : '') + '"' +
            ' data-place="' + c.at + '" data-cal="' + c.n + '"' +
            ' title="第 ' + c.n + ' 难 · ' + esc(p.name) + (c.note ? ' · ' + esc(c.note) : '') + '">' +
            '<i>' + c.n + '</i><span>' + esc(c.name) + '</span><em>' + esc(p.name) + '</em></button>';
        }).join('') + '</div>' +
        '<p class="codex-foot">※ 前四难为唐僧前尘（金蝉遭贬、出胎几杀、满月抛江、寻亲报冤），难簿于灵山追记；' +
        '「折从落坑」一作「落坑折从」，此处从维基文库校本。</p>';
    } else if (mode === 'helper') {
      var h = HELPERS.filter(function (x) { return x.name === arg; })[0];
      if (!h) return;
      title = '神仙谱 · ' + h.name;
      body = '<div class="codex-hero"><div class="codex-seal">' + esc(h.name.slice(0, 1)) + '</div><div>' +
        '<h3>' + esc(h.name) + '</h3><p class="codex-title">' + esc(h.meta ? h.meta.title : SIDE_LABEL[h.side]) + '</p>' +
        '<p class="codex-desc">' + esc(h.meta ? h.meta.desc : '于西行途中出手解厄，详见下列站点档案。') + '</p>' +
        '</div></div>' +
        '<p class="codex-lead">反向索引：共在 <b>' + h.count + '</b> 处出手，按行程先后排列。点击地点直达档案。</p>' +
        placeList(h.places);
    } else if (mode === 'demon') {
      var places = D.INDEX.demons[arg] || [];
      if (!places.length) return;
      title = '妖魔谱 · ' + arg;
      body = '<div class="codex-hero"><div class="codex-seal demon">' + esc(arg.slice(0, 1)) + '</div><div>' +
        '<h3>' + esc(arg) + '</h3><p class="codex-title">西行途中出现的妖魔 / 精怪</p>' +
        '<p class="codex-desc">按原著回目共见于 ' + places.length + ' 处，点击下列地点可查看完整档案与降妖者。</p>' +
        '</div></div><p class="codex-lead">点击地点直达档案。</p>' + placeList(places);
    } else return;

    state.codexMode = mode;
    $('#codexTitle').textContent = title;
    $('#codexBody').innerHTML = body;
    $('#codexModal').classList.add('open');
    $('#codexModal').setAttribute('aria-hidden', 'false');
    $('#codexBody').scrollTop = 0;
    closeSearch();
    $('#searchInput').blur();
    if (mode === 'calamities' && arg) {
      var hit = $('#codexBody').querySelector('.codex-item.flash');
      if (hit && hit.scrollIntoView) hit.scrollIntoView({ block: 'center' });
    }
  }
  function placeList(places) {
    return '<div class="place-list">' + places.map(function (i) {
      var p = POINTS[i];
      return '<button type="button" class="place-item" data-place="' + i + '">' +
        '<span class="place-no">' + (i + 1) + '</span>' +
        '<span class="place-main"><b>' + esc(p.name) + '</b><em>' + esc(p.sub) + '</em></span>' +
        '<span class="place-meta">' + esc(p.era) + '<br>第 ' + p.chapters[0] +
        (p.chapters[1] > p.chapters[0] ? '～' + p.chapters[1] : '') + ' 回 · 累计 ' + p.calamity + ' 难</span></button>';
    }).join('') + '</div>';
  }
  function closeCodex() {
    $('#codexModal').classList.remove('open');
    $('#codexModal').setAttribute('aria-hidden', 'true');
    state.codexMode = null;
  }

  /* ================= 8. 时间轴刻度 ================= */
  function buildTimeline() {
    // 滑块按「站序」逐档推进，年份退为刻度标签，避免同年多站无法单独定位
    var slider = $('#yearSlider');
    slider.max = POINTS.length;
    slider.setAttribute('aria-label', '取经站点滑块（第 1 至 ' + POINTS.length + ' 站）');
    $('#tlHeadText').textContent = '逐站行程 · 贞观十三年 — 贞观二十七年（' + POINTS.length + ' 站）';
    var ticks = $('#yearTicks');
    [639, 642, 645, 648, 651, 653].forEach(function (y) {
      var idx = POINTS.map(function (p, i) { return p.year === y ? i : -1; }).filter(function (i) { return i >= 0; });
      if (!idx.length) return;
      var mid = idx.reduce(function (a, b) { return a + b; }, 0) / idx.length;
      var el = document.createElement('span');
      el.style.left = (mid / LAST * 100) + '%';
      el.textContent = y;
      ticks.appendChild(el);
    });
    var evBox = $('#tlEvents');
    POINTS.filter(function (p) { return p.landmark; }).forEach(function (p) {
      var mark = document.createElement('i');
      mark.style.left = (p.index / LAST * 100) + '%';
      mark.dataset.index = p.index;
      mark.title = '第 ' + (p.index + 1) + ' 站 · ' + p.year + ' · ' + p.name;
      evBox.appendChild(mark);
    });
    evBox.addEventListener('click', function (e) {
      var m = e.target.closest('i[data-index]');
      if (m) { stopIntro(); jumpTo(+m.dataset.index, { sound: true }); }
    });
  }

  /* ================= 9. 进度渲染 ================= */
  function updateHead(p) {
    $('#mYear').textContent = p.era;
    $('#mYearNum').textContent = '公元 ' + p.year + ' 年';
    $('#mPlace').textContent = p.name;
    $('#mCount').textContent = '第 ' + (p.index + 1) + ' / ' + POINTS.length + ' 站';
    $('#mCalamity').textContent = '已历 ' + p.calamity + ' 难 / ' + M.totalCalamities;
    $('#calamityFill').style.width = (p.calamity / M.totalCalamities * 100) + '%';
    var circ = 2 * Math.PI * 22;
    $('#ringFg').style.strokeDashoffset = (circ * (1 - p.calamity / M.totalCalamities)).toFixed(2);
    $('#ringText').textContent = p.calamity;

    $('#tlNow').textContent = '公元 ' + p.year + ' 年 · ' + p.era;
    $('#tlStatus').textContent = p.name;
    $('#tlSub').textContent = '第 ' + p.calamity + ' 难 · 第 ' + (p.index + 1) + ' / ' + POINTS.length + ' 站';
    var slider = $('#yearSlider');
    slider.value = p.index + 1;
    slider.style.setProperty('--fill', (p.index / LAST * 100) + '%');
    $('#tlEvents').querySelectorAll('i').forEach(function (m) {
      m.classList.toggle('current', +m.dataset.index === p.index);
    });
  }

  /** 按已绘制弧长点亮节点，实现「走到哪亮到哪」；浏览态只加描边，不改变行程 */
  function updateNodeStates(reached) {
    var active = Math.min(state.progress, reached);
    var viewing = state.browse >= 0 && state.browse !== active ? state.browse : -1;
    dom.nodes.forEach(function (g, i) {
      g.classList.toggle('locked', i > reached && i !== viewing);
      g.classList.toggle('done', i <= reached && i !== active);
      g.classList.toggle('active', i === active);
      g.classList.toggle('viewing', i === viewing);
    });
    // 援助线降噪：默认只显示焦点站 ±1，选中站始终显示；「全览」可恢复全部
    var focus = viewing >= 0 ? viewing : active;
    Object.keys(dom.aidLines).forEach(function (k) {
      var i = +k, line = dom.aidLines[k];
      var visible = state.aidMode === 'off' ? false
        : state.aidMode === 'all' ? i <= reached
        : ((i <= reached && Math.abs(i - focus) <= 1) || state.browse === i);
      line.classList.toggle('visible', visible);
      line.classList.toggle('active', i === state.browse);
    });
    // 团队是「状态面板」而非沿线点亮动画，与顶部年份/难数同源，避免拖动滑块时中途误显示
    updateTeam(state.progress);
  }

  function reachedIndex() {
    var r = 0;
    for (var i = 0; i < state.nodeLens.length; i++) {
      if (state.nodeLens[i] <= state.drawn + 3) r = i;
    }
    return r;
  }

  /** 每帧：画笔生长 + 笔尖 + 节点点亮 + 金尘 */
  function frame(t) {
    var dt = state.lastFrame ? Math.min(60, t - state.lastFrame) / 1000 : 0.016;
    state.lastFrame = t;

    var diff = state.target - state.drawn;
    if (Math.abs(diff) > 0.4) {
      var speed = clamp(Math.abs(diff) * 3.2, 420, 1500);
      state.drawn += Math.sign(diff) * Math.min(Math.abs(diff), speed * dt);
      renderGrowth();
    } else if (state.drawn !== state.target) {
      state.drawn = state.target;
      renderGrowth();
    }
    updateCamera(dt);
    drawDust(t);
    drawAura(t);
    requestAnimationFrame(frame);
  }

  function renderGrowth() {
    var L = state.totalLength;
    var off = L - state.drawn;
    dom.main.style.strokeDashoffset = off;
    dom.red.style.strokeDashoffset = off;
    var pt = dom.main.getPointAtLength(clamp(state.drawn, 0, L));
    dom.pen.setAttribute('transform', 'translate(' + pt.x.toFixed(1) + ',' + pt.y.toFixed(1) + ')');
    dom.clipRect.setAttribute('x', pt.x.toFixed(1));
    dom.clipRect.setAttribute('width', Math.max(0, M.mapWidth - pt.x).toFixed(1));
    updateNodeStates(reachedIndex());
  }

  /* ---- 两个独立状态：行程进度 vs 档案浏览 ---- */
  /** 改变行程：路线、年份、难数、团队、时间轴随之更新 */
  function setProgress(i, opts) {
    opts = opts || {};
    // 行程一变，上一站的原著引文即收起（回放内部由回放逻辑自行控制）
    if (!state.replay) hideQuote();
    state.progress = clamp(i, 0, LAST);
    state.target = state.nodeLens[state.progress];
    if (!opts.keepBrowse) state.browse = -1;
    updateHead(POINTS[state.progress]);
    setMood(state.progress);
    recenterView();
    refreshCard();
    if (opts.instant || state.reduceMotion) { state.drawn = state.target; renderGrowth(); }
    if (opts.sound) playSound(POINTS[state.progress].sound);
  }

  /** 只浏览档案：高亮与援助线变化，行程进度纹丝不动 */
  function setBrowse(i, opts) {
    opts = opts || {};
    state.browse = clamp(i, 0, LAST);
    refreshCard();
    updateNodeStates(reachedIndex());
    if (opts.sound) playSound(POINTS[state.browse].sound);
  }

  function selectNode(i, sound) {
    if (state.replay) stopReplay(true);
    setBrowse(i, { sound: !!sound });
    openSidebar(true);
    openQuote(i, true);
  }

  /** 进度与档案一起到位：键盘、时间轴事件点、深链使用 */
  function jumpTo(i, opts) {
    opts = opts || {};
    if (state.replay) stopReplay(true);
    setProgress(i, { instant: opts.instant, sound: opts.sound });
    setBrowse(i);
    openSidebar(true);
    openQuote(i, true);
  }

  /* ================= 9b. 原著引文卷轴 ================= */
  function openQuote(i, autoClose) {
    var q = D.quoteAt(i);
    if (!q) { hideQuote(); return; }
    if (state.quoteTimer) { clearTimeout(state.quoteTimer); state.quoteTimer = null; }
    $('#quoteTitle').textContent = POINTS[i].name;
    $('#quoteSource').textContent = q.source;
    $('#quoteText').textContent = '「' + q.text + '」';
    $('#quoteTag').textContent = q.tag + ' · 第 ' + (i + 1) + ' 站';
    $('#btnQuoteReplay').dataset.at = i;
    $('#quoteScroll').classList.add('open');
    if (autoClose && !state.reduceMotion) {
      state.quoteTimer = setTimeout(hideQuote, 6800);
    }
  }
  function hideQuote() {
    $('#quoteScroll').classList.remove('open');
    if (state.quoteTimer) { clearTimeout(state.quoteTimer); state.quoteTimer = null; }
  }

  /* ================= 9c. 劫难回放：选中站前后三站慢镜复演 ================= */
  function updateReplayBar() {
    var r = state.replay;
    if (!r) return;
    $('#rbTitle').textContent = '劫难回放 · ' + POINTS[r.center].name;
    $('#rbInfo').textContent = '第 ' + (r.at + 1) + ' / ' + POINTS.length + ' 站 · ' +
      POINTS[r.at].name + '　（复演 ' + (r.from + 1) + '–' + (r.to + 1) + ' 站）';
    $('#rbFill').style.width = ((r.at - r.from + 1) / (r.to - r.from + 1) * 100) + '%';
  }
  function startReplay(center) {
    if (state.replay) stopReplay(true);
    pausePlay(); stopIntro();
    hideQuote();
    var r = {
      center: clamp(center, 0, LAST),
      from: Math.max(0, center - 3), to: Math.min(LAST, center + 3),
      at: 0, timer: null,
      saved: { progress: state.progress, browse: state.browse, drawn: state.drawn, sidebar: state.sidebarOpen }
    };
    r.at = r.from;
    state.replay = r;
    state.quoteFromReplay = false;
    setProgress(r.from, { instant: true });
    setBrowse(r.from);
    openSidebar(true);
    $('#replayBar').classList.add('open');
    syncCamera();
    stepReplay();
    playSound('woodfish');
  }
  function stepReplay() {
    var r = state.replay;
    if (!r) return;
    if (r.at > r.to) { finishReplay(); return; }
    setProgress(r.at, {});
    setBrowse(r.at);
    updateReplayBar();
    if (r.at === r.center) {
      openQuote(r.center, false);
      state.quoteFromReplay = true;
      playSound('drum');
    } else if (r.at > r.from) {
      playSound(POINTS[r.at].sound || 'bell');
    }
    r.timer = setTimeout(function () { r.at++; stepReplay(); }, r.at === r.center ? 1250 : 700);
  }
  function finishReplay() {
    var r = state.replay;
    if (!r) return;
    r.timer = setTimeout(function () { stopReplay(true); }, 1100);
  }
  /** 复演结束或用户中断：一律回滚到开启回放前的行程 / 档案 / 侧栏状态 */
  function stopReplay(restore) {
    var r = state.replay;
    if (!r) return;
    if (r.timer) clearTimeout(r.timer);
    state.replay = null;
    $('#replayBar').classList.remove('open');
    if (state.quoteFromReplay) { hideQuote(); state.quoteFromReplay = false; }
    syncCamera();
    if (restore) {
      setProgress(r.saved.progress, { instant: true, keepBrowse: true });
      state.browse = r.saved.browse;
      if (!r.saved.sidebar) openSidebar(false);
      updateNodeStates(reachedIndex());
      refreshCard();
    }
  }

  /* ================= 10. 侧栏 / 播放 / 按钮 ================= */
  function openSidebar(open) {
    var changed = state.sidebarOpen !== open;
    state.sidebarOpen = open;
    $('#stage').classList.toggle('collapsed', !open);
    $('#sidebarToggle').setAttribute('aria-expanded', String(open));
    $('#sidebar').setAttribute('aria-hidden', String(!open));
    if (open && changed) renderCard(currentCardIndex());
  }

  function pausePlay() {
    state.playing = false;
    if (state.playTimer) { clearTimeout(state.playTimer); state.playTimer = null; }
    $('#playIcon').textContent = '▶';
    $('#btnPlay').setAttribute('aria-label', '播放取经进度');
    syncCamera();
  }

  function stepPlay(interval) {
    if (!state.playing) return;
    if (state.progress >= LAST) { pausePlay(); stopIntro(); return; }
    setProgress(state.progress + 1);
    state.playTimer = setTimeout(function () { stepPlay(interval); }, interval);
  }

  function startPlay(interval, intro) {
    pausePlay();
    state.intro = !!intro;
    if (state.progress >= LAST) setProgress(0, { instant: true });
    state.playing = true;
    $('#playIcon').textContent = '❚❚';
    $('#btnPlay').setAttribute('aria-label', '暂停取经进度');
    state.playTimer = setTimeout(function () { stepPlay(interval); }, 120);
    syncCamera();
  }

  function stopIntro() {
    if (state.intro) {
      state.intro = false;
      pausePlay();
    }
  }

  /* ================= 11. 音效（Web Audio 合成，无外部音频文件） ================= */
  var actx = null, master = null;
  function audio() {
    if (!actx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
      master = actx.createGain();
      master.gain.value = 0.16;
      master.connect(actx.destination);
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function noise(ctx, dur) {
    var b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    var d = b.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function envelope(g, t0, dur, peak, attack) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }
  function osc(ctx, type, f0, f1, t0, dur, peak) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    envelope(g, t0, dur, peak);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + .02);
  }
  function noiseHit(ctx, filterType, freq, q, t0, dur, peak) {
    var src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noise(ctx, dur);
    f.type = filterType; f.frequency.value = freq; f.Q.value = q || 1;
    envelope(g, t0, dur, peak, dur * .18);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + .02);
  }
  function playSound(kind) {
    if (!state.soundOn) return;
    var ctx = audio();
    if (!ctx) return;
    try {
      var t = ctx.currentTime + 0.01;
      if (kind === 'woodfish') {           // 木鱼：短促的木腔 + 低频点
        noiseHit(ctx, 'bandpass', 540, 8, t, .16, .55);
        osc(ctx, 'sine', 196, 120, t, .12, .30);
      } else if (kind === 'sword') {       // 拔剑：金属扫频 + 高频擦声
        osc(ctx, 'triangle', 1480, 2760, t, .26, .20);
        osc(ctx, 'sine', 2240, 3120, t, .22, .12);
        noiseHit(ctx, 'highpass', 2600, 1, t, .22, .22);
      } else if (kind === 'wind') {        // 风 / 水：低通气流
        noiseHit(ctx, 'lowpass', 420, 1, t, .72, .26);
        osc(ctx, 'sine', 110, 84, t, .55, .10);
      } else if (kind === 'drum') {        // 法鼓：沉稳一击
        osc(ctx, 'sine', 138, 58, t, .38, .55);
        noiseHit(ctx, 'lowpass', 760, 1, t, .14, .22);
      } else {                            // 铃 / 磬：清越泛音
        osc(ctx, 'sine', 784, 780, t, .85, .22);
        osc(ctx, 'sine', 1176, 1170, t + .02, .68, .14);
        osc(ctx, 'sine', 1568, 1560, t + .04, .52, .09);
      }
    } catch (e) { /* 音频不可用时静默降级 */ }
  }

  /* ================= 11b. 卷轴镜头：播放 / 回放时随笔尖横移 ================= */
  function cameraTarget() {
    if (!state.cameraActive || state.viewLocked) return defaultView();
    var pt = dom.main.getPointAtLength(clamp(state.drawn, 0, state.totalLength));
    if (isNarrow()) {
      var nw = 760;
      return { x: clamp(pt.x - nw / 2, 0, M.mapWidth - nw), y: 0, w: nw, h: M.mapHeight };
    }
    var cw = 1000, ch = M.mapHeight * (cw / M.mapWidth);
    return {
      x: clamp(pt.x - cw / 2, -30, M.mapWidth - cw + 30),
      y: clamp(pt.y - ch / 2, -30, M.mapHeight - ch + 30),
      w: cw, h: ch
    };
  }
  function beginCameraReturn() {
    state.cameraActive = false;
    state.cameraReturning = true;
    state.cameraReturnAt = (window.performance && performance.now()) || Date.now();
  }
  function syncCamera() {
    if (state.reduceMotion || state.viewLocked) return;
    var should = state.cameraOn && (state.playing || !!state.replay);
    if (should && !state.cameraActive) { state.cameraActive = true; state.cameraReturning = false; }
    else if (!should && state.cameraActive) beginCameraReturn();
  }
  function updateCamera(dt) {
    if (!state.cameraActive && !state.cameraReturning) return;
    if (state.viewLocked) { state.cameraActive = false; state.cameraReturning = false; return; }
    // 回弹限时收尾：低帧率下 lerp 可能拖尾，2 秒后直接对齐全景
    var now = (window.performance && performance.now()) || Date.now();
    if (state.cameraReturning && now - state.cameraReturnAt > 1900) {
      state.view = defaultView();
      state.cameraReturning = false;
      applyView();
      return;
    }
    var t = cameraTarget(), v = state.view;
    var k = Math.min(1, dt * (state.cameraReturning ? 5 : 2.6)), moving = false;
    ['x', 'y', 'w', 'h'].forEach(function (key) {
      var diff = t[key] - v[key];
      if (Math.abs(diff) > 0.5) { v[key] += diff * k; moving = true; }
      else v[key] = t[key];
    });
    applyView();
    if (!moving && state.cameraReturning) state.cameraReturning = false;
  }

  /* ================= 12. 地图缩放 / 平移 ================= */
  function applyView() {
    var v = state.view;
    svg.setAttribute('viewBox', v.x.toFixed(1) + ' ' + v.y.toFixed(1) + ' ' + v.w.toFixed(1) + ' ' + v.h.toFixed(1));
    svg.classList.toggle('zoomed', v.w < 1350 && !isNarrow());
  }
  function zoomAt(factor, clientX, clientY) {
    state.viewLocked = true;
    var v = state.view;
    var nw = clamp(v.w * factor, 460, 2000);
    if (nw === v.w) return;
    var nh = v.h * (nw / v.w);   // 保持当前视口宽高比，窄屏局部视图缩放不跳变
    var rect = svg.getBoundingClientRect();
    // 以 preserveAspectRatio=meet 计算可视区域，得到鼠标对应的 SVG 用户坐标
    var scale = Math.min(rect.width / v.w, rect.height / v.h);
    var offX = (rect.width - v.w * scale) / 2, offY = (rect.height - v.h * scale) / 2;
    var ux = v.x + (clientX - rect.left - offX) / scale;
    var uy = v.y + (clientY - rect.top - offY) / scale;
    var k = nw / v.w;
    v.x = ux - (ux - v.x) * k;
    v.y = uy - (uy - v.y) * k;
    v.w = nw; v.h = nh;
    applyView();
  }
  function resetView() {
    state.viewLocked = false;
    state.cameraActive = false;
    state.cameraReturning = false;
    state.view = defaultView();
    applyView();
  }
  function bindPanZoom() {
    var dragging = false, sx = 0, sy = 0, vx = 0, vy = 0, moved = false;
    svg.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.node')) return;
      dragging = true; moved = false;
      sx = e.clientX; sy = e.clientY;
      vx = state.view.x; vy = state.view.y;
      svg.classList.add('dragging');
      svg.setPointerCapture(e.pointerId);
      stopIntro();
    });
    svg.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var rect = svg.getBoundingClientRect();
      var scale = Math.min(rect.width / state.view.w, rect.height / state.view.h);
      var dx = (e.clientX - sx) / scale, dy = (e.clientY - sy) / scale;
      if (Math.abs(dx) + Math.abs(dy) > 2) { moved = true; state.viewLocked = true; }
      state.view.x = clamp(vx - dx, -220, M.mapWidth - state.view.w + 220);
      state.view.y = clamp(vy - dy, -180, M.mapHeight - state.view.h + 180);
      applyView();
    });
    function end(e) {
      if (!dragging) return;
      dragging = false;
      svg.classList.remove('dragging');
      try { svg.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
    }
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('wheel', function (e) {
      e.preventDefault();
      stopIntro();
      zoomAt(e.deltaY > 0 ? 1.12 : 0.89, e.clientX, e.clientY);
    }, { passive: false });
  }

  /* ================= 13. Tooltip ================= */
  function showTooltip(p, e) {
    var demon = p.demons.length
      ? p.demons.map(esc).join(' · ')
      : (p.type === 'destination' ? '功成行满 · 五圣成真' : '无妖魔 · ' + esc(p.sub));
    var gods = p.canonicalHelpers.slice(0, 3).map(function (h) { return esc(h.name); }).join('、') || '自行度过';
    tooltip.innerHTML =
      '<div class="tt-name">' + esc(p.name) + '<span class="tt-era">' + p.year + ' · ' + esc(p.era) + '</span></div>' +
      '<div class="tt-demon">妖魔：' + demon + '</div>' +
      '<div class="tt-god">解厄：' + gods + '</div>' +
      '<div class="tt-hint">第 ' + p.chapters[0] + (p.chapters[1] > p.chapters[0] ? '～' + p.chapters[1] : '') +
        ' 回 · 累计第 ' + p.calamity + ' 难 · 点击展开档案</div>';
    tooltip.classList.add('show');
    moveTooltip(e);
  }
  function moveTooltip(e) {
    var w = tooltip.offsetWidth || 210, h = tooltip.offsetHeight || 76;
    var x = Math.min(e.clientX, window.innerWidth - w - 26);
    var y = Math.min(e.clientY, window.innerHeight - h - 26);
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
  }
  function hideTooltip() { tooltip.classList.remove('show'); }

  /* ================= 13b. 漫画导读入口 ================= */
  function comicFileFor(i) {
    var n = i + 1;
    if (n === 11) return 'comic-baihuling.html';
    return 'comic-' + (n < 10 ? '0' + n : '' + n) + '.html';
  }
  function openComic(i) { window.location.href = comicFileFor(i); }

  /* ================= 14. 事件绑定 ================= */
  function bindEvents() {
    // 节点：悬停 / 点击 / 键盘
    svg.addEventListener('mousemove', function (e) {
      var g = e.target.closest ? e.target.closest('.node') : null;
      if (g) {
        if (state.hoverIndex !== +g.dataset.index) {
          state.hoverIndex = +g.dataset.index;
          showTooltip(POINTS[state.hoverIndex], e);
        } else moveTooltip(e);
      } else if (state.hoverIndex !== -1) { state.hoverIndex = -1; hideTooltip(); }
    });
    svg.addEventListener('mouseleave', function () { state.hoverIndex = -1; hideTooltip(); });
    nodeLayer.addEventListener('click', function (e) {
      var g = e.target.closest('.node');
      if (!g) return;
      stopIntro();
      var i = +g.dataset.index;
      selectNode(i, true);
      hideTooltip();
    });
    svg.addEventListener('keydown', function (e) {
      var g = e.target.closest && e.target.closest('.node');
      if (g && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault(); e.stopPropagation();
        stopIntro(); selectNode(+g.dataset.index, true);
      }
    });

    // 时间轴：按站序推进，年份仅作刻度
    $('#yearSlider').addEventListener('input', function () {
      if (state.replay) stopReplay(true);
      pausePlay(); stopIntro();
      setProgress(+this.value - 1, {});
    });

    // 播放 / 重播
    $('#btnPlay').addEventListener('click', function () {
      if (state.replay) stopReplay(true);
      stopIntro();
      if (state.playing) pausePlay(); else startPlay(190, false);
      playSound('woodfish');
    });
    $('#btnReplay').addEventListener('click', function () {
      if (state.replay) stopReplay(true);
      pausePlay(); stopIntro();
      setProgress(0, { instant: true });
      startPlay(160, true);
      playSound('bell');
    });

    // 侧栏
    $('#sidebarToggle').addEventListener('click', function () {
      openSidebar(!state.sidebarOpen);
      playSound('woodfish');
    });

    // 援助雷达三态：聚焦（默认） → 全览 → 关闭
    var aidModes = ['focus', 'all', 'off'];
    var aidLabels = { focus: '✧ 雷达·聚焦', all: '✧ 雷达·全览', off: '✧ 雷达·关闭' };
    $('#btnAid').addEventListener('click', function () {
      state.aidMode = aidModes[(aidModes.indexOf(state.aidMode) + 1) % aidModes.length];
      this.textContent = aidLabels[state.aidMode];
      this.classList.toggle('active', state.aidMode !== 'off');
      svg.classList.toggle('aid-off', state.aidMode === 'off');
      updateNodeStates(reachedIndex());
      playSound('bell');
    });
    $('#btnSound').addEventListener('click', function () {
      state.soundOn = !state.soundOn;
      this.classList.toggle('active', state.soundOn);
      if (state.soundOn) playSound('bell');
    });
    function setHelp(open) {
      $('#helpModal').classList.toggle('open', open);
      $('#helpModal').setAttribute('aria-hidden', String(!open));
    }
    $('#btnHelp').addEventListener('click', function () { setHelp(true); });
    $('#btnCloseHelp').addEventListener('click', function () { setHelp(false); });
    $('#helpModal').addEventListener('click', function (e) {
      if (e.target === this) setHelp(false);
    });

    // 叙事控件：卷轴镜头 / 原著引文 / 劫难回放
    $('#btnCamera').addEventListener('click', function () {
      state.cameraOn = !state.cameraOn;
      this.classList.toggle('tool-on', state.cameraOn);
      this.setAttribute('aria-pressed', String(state.cameraOn));
      this.title = state.cameraOn ? '卷轴镜头已开：播放时跟随笔尖（点击关闭）' : '卷轴镜头已关：始终显示全景（点击开启）';
      if (!state.cameraOn) beginCameraReturn();
      else syncCamera();
      playSound('bell');
    });
    $('#btnCloseQuote').addEventListener('click', hideQuote);
    $('#btnQuoteReplay').addEventListener('click', function () {
      startReplay(clamp(parseInt(this.dataset.at, 10) || 0, 0, LAST));
    });
    $('#btnReplayExit').addEventListener('click', function () { stopReplay(true); playSound('woodfish'); });

    // 地图工具
    $('#btnZoomIn').addEventListener('click', function () {
      var r = svg.getBoundingClientRect();
      zoomAt(0.82, r.left + r.width / 2, r.top + r.height / 2);
    });
    $('#btnZoomOut').addEventListener('click', function () {
      var r = svg.getBoundingClientRect();
      zoomAt(1.22, r.left + r.width / 2, r.top + r.height / 2);
    });
    $('#btnReset').addEventListener('click', resetView);

    // 检索：输入即时联想，回车直达首条，/ 快速聚焦
    var input = $('#searchInput');
    input.addEventListener('input', function () { renderSearch(this.value); });
    input.addEventListener('focus', function () { if (this.value.trim()) renderSearch(this.value); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var first = $('#searchResults').querySelector('.sr-item');
        if (first) first.click();
      } else if (e.key === 'Escape') {
        closeSearch(); this.value = ''; this.blur();
      }
    });
    $('#searchResults').addEventListener('click', function (e) {
      var it = e.target.closest('.sr-item');
      if (!it) return;
      if (it.dataset.helper) openCodex('helper', it.dataset.helper);
      else if (it.dataset.demon) openCodex('demon', it.dataset.demon);
      else if (it.dataset.place !== undefined) {
        stopIntro(); pausePlay();
        jumpTo(+it.dataset.place, { instant: true, sound: true });
        closeSearch(); input.value = ''; input.blur();
      }
    });
    document.addEventListener('pointerdown', function (e) {
      if (!e.target.closest('.search-wrap')) closeSearch();
    });

    // 典藏面板：难簿 / 神仙谱 / 妖魔谱
    $('#btnCodex').addEventListener('click', function () { openCodex('calamities'); playSound('woodfish'); });
    $('#btnCloseCodex').addEventListener('click', closeCodex);
    $('#codexModal').addEventListener('click', function (e) {
      if (e.target === this) closeCodex();
    });
    $('#codexBody').addEventListener('click', function (e) {
      var it = e.target.closest('[data-place]');
      if (!it) return;
      stopIntro(); pausePlay();
      jumpTo(+it.dataset.place, { instant: true, sound: true });
      closeCodex();
    });
    // 顶部环形进度也可点开难簿
    $('.calamity-box').style.cursor = 'pointer';
    $('.calamity-box').addEventListener('click', function () { openCodex('calamities'); });

    // 键盘
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        setHelp(false);
        closeCodex();
        closeSearch();
        if (state.replay) stopReplay(true);
        hideQuote();
        if (state.sidebarOpen) openSidebar(false);
        return;
      }
      if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
        e.preventDefault(); input.focus(); input.select();
        return;
      }
      if ($('#helpModal').classList.contains('open') || $('#codexModal').classList.contains('open')) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault(); pausePlay(); stopIntro();
        var base = state.browse >= 0 ? state.browse : state.progress;
        jumpTo(clamp(base + (e.key === 'ArrowRight' ? 1 : -1), 0, LAST), { sound: true });
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (state.replay) stopReplay(true);
        stopIntro();
        if (state.playing) pausePlay(); else startPlay(190, false);
      }
    });

    var wasNarrow = isNarrow();
    window.addEventListener('resize', function () {
      var nowNarrow = isNarrow();
      if (wasNarrow !== nowNarrow) {
        var enteringNarrow = nowNarrow && !wasNarrow;
        wasNarrow = nowNarrow;
        state.viewLocked = false;
        state.view = defaultView();
        // 从宽屏切入窄屏时收起档案卡，避免底部抽屉一上来就盖住地图
        if (enteringNarrow) { openSidebar(false); hideQuote(); }
      }
      resizeAura();
      applyView();
    });
  }

  /* ================= 15. 启动 ================= */
  function init() {
    state.reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    initDust();
    drawRegions();
    drawWorld();
    drawRoute();
    drawAnchors();
    drawAidLines();
    drawNodes();
    buildTeam();
    buildTimeline();
    bindPanZoom();
    bindEvents();
    initAura();
    $('#btnCamera').setAttribute('aria-pressed', String(state.cameraOn));

    // 默认收起侧栏，先给一份「待查看」的空态
    $('#stage').classList.add('collapsed');
    $('#cardBody').innerHTML =
      '<div class="card-empty"><div class="empty-seal">劫<br>难</div>' +
      '四十二站，八十一难。<br>点选地图上的地点，<br>展开这一站的劫难档案。</div>';

    setProgress(0, { instant: true });
    applyView();
    requestAnimationFrame(frame);

    // 深链：index.html?node=9&card=1 直达第 9 站并展开档案（便于分享某一难）
    var qs = new URLSearchParams(window.location.search);
    var deep = parseInt(qs.get('node'), 10);
    if (!isNaN(deep)) {
      var at = clamp(deep - 1, 0, LAST);
      setProgress(at, { instant: true });
      setBrowse(at);
      if (qs.get('card') === '1') openSidebar(true);
      openQuote(at, false);
    } else if (!state.reduceMotion) {
      // 开场：金线自长安一路画向灵山（任何主动操作即打断）
      setTimeout(function () {
        if (state.progress === 0 && !state.playing) startPlay(160, true);
      }, 900);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
