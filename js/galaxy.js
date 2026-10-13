/* The rotating galaxy: ten stations on a slowly turning ring, drawn on one 2D canvas. No libraries, no images.
   The front station grows and its own little graphic plays; the rest hold still. Drag, swipe, click a body, press the
   arrow keys, or use the numbered buttons. Auto-advance pauses on hover/focus and is off under prefers-reduced-motion. */
(function () {
  'use strict';
  var stage = document.getElementById('galaxy-stage');
  var canvas = document.getElementById('galaxy');
  if (!stage || !canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var capBox = document.getElementById('galaxy-caption');
  var capNo = document.getElementById('cap-no');
  var capTitle = document.getElementById('cap-title');
  var capText = document.getElementById('cap-text');
  var dotsHost = document.getElementById('stations');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var C = { text: '#f2f2f5', soft: '#a3a6b0', faint: '#5d606c', line: '#3a3c46', body: '#0f1116', bodyEdge: '#2a2c35',
            green: '#4ecb7d', amber: '#e0a852', coral: '#d97757', blue: '#4ea1ff', cyan: '#3fc6ff' };
  var TAU = Math.PI * 2;

  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r); c.lineTo(x + w, y + h - r);
    c.arcTo(x + w, y + h, x + w - r, y + h, r); c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r); c.lineTo(x, y + r);
    c.arcTo(x, y, x + r, y, r); c.closePath();
  }
  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function pulse(t, period, off) { return 0.5 + 0.5 * Math.sin((t / period + (off || 0)) * TAU); }

  /* ---- the ten graphics. Unit space: the body is a disc of radius r centred on (0,0); t = seconds this station has been in front. */
  var S = [];

  S.push({ title: 'Hybrid: local and Claude, together',
    text: 'Playpen’s own AI and your Claude subscription share the work. Or use either one on its own.',
    draw: function (c, t, r) {                      // two orbs, light flowing both ways
      var lx = -r * 0.5, rx = r * 0.5, w = r * 0.035;
      c.lineWidth = w; c.strokeStyle = C.line; c.beginPath(); c.moveTo(lx, 0); c.lineTo(rx, 0); c.stroke();
      c.fillStyle = C.text; circle(c, lx, 0, r * 0.2); c.fill();
      c.fillStyle = C.coral; circle(c, rx, 0, r * 0.2); c.fill();
      for (var i = 0; i < 4; i++) {
        var p = ((t * 0.55 + i / 4) % 1);
        c.fillStyle = C.text; circle(c, lx + (rx - lx) * p, -r * 0.06, r * 0.045); c.fill();
        c.fillStyle = C.coral; circle(c, rx - (rx - lx) * ((p + 0.5) % 1), r * 0.06, r * 0.045); c.fill();
      }
      var k = (Math.floor(t / 1.6) % 3);             // the little toggle underneath hops between three positions
      c.strokeStyle = C.line; rr(c, -r * 0.34, r * 0.42, r * 0.68, r * 0.2, r * 0.1); c.stroke();
      c.fillStyle = C.text; circle(c, -r * 0.24 + k * r * 0.24, r * 0.52, r * 0.075); c.fill();
    } });

  S.push({ title: 'A project that remembers itself',
    text: 'Every piece keeps its own notes on your computer, so each request starts with the right context.',
    draw: function (c, t, r) {                      // nodes lighting and linking
      var N = [[-.55, -.1], [-.3, -.5], [.1, -.55], [.5, -.3], [.62, .15], [.3, .5], [-.1, .55], [-.5, .35], [0, 0]];
      var E = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [8, 0], [8, 2], [8, 4], [8, 6]];
      var n = Math.min(E.length, Math.floor(t * 2.2) + 2);
      c.lineWidth = r * 0.03;
      for (var i = 0; i < E.length; i++) {
        var a = N[E[i][0]], b = N[E[i][1]];
        c.strokeStyle = i < n ? 'rgba(242,242,245,.55)' : C.line;
        c.beginPath(); c.moveTo(a[0] * r, a[1] * r); c.lineTo(b[0] * r, b[1] * r); c.stroke();
      }
      for (var j = 0; j < N.length; j++) {
        var lit = j === 8 || (t * 2.2) > j * 0.9;
        c.fillStyle = lit ? C.amber : C.faint; circle(c, N[j][0] * r, N[j][1] * r, r * (j === 8 ? 0.11 : 0.07)); c.fill();
      }
    } });

  S.push({ title: 'Nothing to set up',
    text: 'Playpen gets its own tools ready the first time you open it. You just start.',
    draw: function (c, t, r) {                      // a start orb with the parts already snapped around it
      var k = Math.min(1, t / 1.4);
      var spread = r * (0.95 - 0.37 * ease(k));
      for (var i = 0; i < 8; i++) {
        var a = i * TAU / 8 + 0.4;
        c.fillStyle = i % 2 ? C.soft : C.faint;
        rr(c, Math.cos(a) * spread - r * 0.07, Math.sin(a) * spread - r * 0.07, r * 0.14, r * 0.14, r * 0.04); c.fill();
      }
      c.strokeStyle = C.line; c.lineWidth = r * 0.03; circle(c, 0, 0, r * 0.58); c.stroke();
      c.fillStyle = C.green; circle(c, 0, 0, r * (0.3 + 0.03 * pulse(t, 1.6))); c.fill();
      c.fillStyle = '#08090c'; c.beginPath(); c.moveTo(-r * 0.07, -r * 0.13); c.lineTo(-r * 0.07, r * 0.13); c.lineTo(r * 0.15, 0); c.closePath(); c.fill();
    } });

  S.push({ title: 'Test it as it’s built',
    text: 'Press play and your game runs right inside Playpen. Plug in a controller and it just works.',
    draw: function (c, t, r) {                      // a game window waking up, a controller circling it
      var ph = Math.min(1, t / 0.8);
      var w = r * 1.0 * ease(ph), h = r * 0.72 * ease(ph);
      c.fillStyle = '#0a0b0f'; c.strokeStyle = C.text; c.lineWidth = r * 0.035; rr(c, -w / 2, -h / 2 - r * 0.05, w, h, r * 0.08); c.fill(); c.stroke();
      if (ph > 0.9) {
        c.fillStyle = C.amber; var px = Math.sin(t * 2.1) * r * 0.28; circle(c, px, -r * 0.05 + Math.cos(t * 3) * r * 0.06, r * 0.08); c.fill();
        c.fillStyle = C.coral; circle(c, -px * 0.8 + r * 0.05, -r * 0.1, r * 0.055); c.fill();
      }
      var a = t * 1.1, cx = Math.cos(a) * r * 0.78, cy = Math.sin(a) * r * 0.42 + r * 0.05;
      c.save(); c.translate(cx, cy);
      c.fillStyle = C.cyan; rr(c, -r * 0.16, -r * 0.075, r * 0.32, r * 0.15, r * 0.06); c.fill();
      c.fillStyle = '#08090c'; circle(c, -r * 0.075, 0, r * 0.03); c.fill(); circle(c, r * 0.075, 0, r * 0.03); c.fill();
      c.restore();
    } });

  S.push({ title: 'Send it to your phone',
    text: 'Scan a code and play on your phone. Your phone and PC just need to be on the same Wi‑Fi.',
    draw: function (c, t, r) {                      // a phone catching an arc of light
      var pw = r * 0.46, ph = r * 0.86;
      c.strokeStyle = C.text; c.lineWidth = r * 0.035; c.fillStyle = '#0a0b0f'; rr(c, r * 0.12, -ph / 2, pw, ph, r * 0.1); c.fill(); c.stroke();
      var lit = Math.min(1, Math.max(0, (t - 0.9) / 0.5));
      if (lit > 0) { c.fillStyle = 'rgba(63,198,255,' + (0.18 * lit) + ')'; rr(c, r * 0.17, -ph / 2 + r * 0.07, pw - r * 0.1, ph - r * 0.14, r * 0.06); c.fill(); }
      var sx = -r * 0.72, sy = r * 0.3, ex = r * 0.1, ey = -r * 0.05;
      c.fillStyle = C.soft; circle(c, sx, sy, r * 0.09); c.fill();
      c.strokeStyle = C.line; c.lineWidth = r * 0.025; c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(-r * 0.4, -r * 0.55, ex, ey); c.stroke();
      for (var i = 0; i < 5; i++) {
        var p = ((t * 0.6 + i / 5) % 1), q = 1 - p;
        var x = q * q * sx + 2 * q * p * (-r * 0.4) + p * p * ex, y = q * q * sy + 2 * q * p * (-r * 0.55) + p * p * ey;
        c.fillStyle = C.cyan; circle(c, x, y, r * 0.05); c.fill();
      }
    } });

  S.push({ title: 'Talk it into existence',
    text: 'Say what you want. Playpen listens, builds it, and talks back.',
    draw: function (c, t, r) {                      // the living voice orb
      for (var i = 0; i < 4; i++) {
        var p = ((t * 0.5 + i / 4) % 1);
        c.strokeStyle = 'rgba(224,168,82,' + (0.7 * (1 - p)) + ')'; c.lineWidth = r * 0.03;
        circle(c, 0, 0, r * (0.3 + 0.62 * p)); c.stroke();
      }
      var wob = 1 + 0.08 * Math.sin(t * 7) + 0.05 * Math.sin(t * 11.3);
      c.fillStyle = C.text; circle(c, 0, 0, r * 0.27 * wob); c.fill();
      c.fillStyle = '#0a0b0f';
      for (var k = -2; k <= 2; k++) { var hgt = r * (0.07 + 0.09 * Math.abs(Math.sin(t * 5 + k))); rr(c, k * r * 0.07 - r * 0.02, -hgt, r * 0.04, hgt * 2, r * 0.02); c.fill(); }
    } });

  S.push({ title: 'Build real games',
    text: 'Platformers, shooters, racing and more, with sound, music and a finished look.',
    draw: function (c, t, r) {                      // small cartridge-shaped planets in orbit (generic)
      c.strokeStyle = C.line; c.lineWidth = r * 0.02;
      c.beginPath(); c.ellipse(0, 0, r * 0.82, r * 0.4, 0, 0, TAU); c.stroke();
      c.beginPath(); c.ellipse(0, 0, r * 0.5, r * 0.24, 0, 0, TAU); c.stroke();
      var cols = [C.green, C.amber, C.coral];
      for (var i = 0; i < 3; i++) {
        var a = t * (0.7 - i * 0.12) + i * TAU / 3, big = i === 0 ? 0.82 : (i === 1 ? 0.5 : 0.66);
        var x = Math.cos(a) * r * big, y = Math.sin(a) * r * big * 0.48;
        var s = r * (0.16 + 0.04 * Math.sin(a));
        c.fillStyle = '#1a1c24'; c.strokeStyle = C.text; c.lineWidth = r * 0.025;
        c.beginPath(); c.moveTo(x - s, y - s * 1.1); c.lineTo(x + s, y - s * 1.1); c.lineTo(x + s, y + s * 0.7); c.lineTo(x + s * 0.35, y + s * 1.1);
        c.lineTo(x - s * 0.35, y + s * 1.1); c.lineTo(x - s, y + s * 0.7); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = cols[i]; rr(c, x - s * 0.62, y - s * 0.7, s * 1.24, s * 0.8, s * 0.12); c.fill();
      }
    } });

  S.push({ title: 'Plan ahead, any time',
    text: 'Plan with Claude or fully on your computer, then build. Out of Claude usage? Keep planning locally.',
    draw: function (c, t, r) {                      // module cards stacking up
      var n = Math.min(4, Math.floor(t * 1.5) + 1);
      for (var i = 0; i < 4; i++) {
        if (i >= n) break;
        var drop = Math.min(1, (t * 1.5 - i) * 1.4);
        var y = r * (0.42 - i * 0.26) - (1 - ease(Math.max(0, drop))) * r * 0.5;
        c.globalAlpha = Math.max(0, Math.min(1, drop * 2));
        c.fillStyle = '#14161c'; c.strokeStyle = i === n - 1 ? C.blue : C.line; c.lineWidth = r * 0.03;
        rr(c, -r * 0.62, y - r * 0.1, r * 1.24, r * 0.2, r * 0.07); c.fill(); c.stroke();
        c.fillStyle = C.soft; rr(c, -r * 0.5, y - r * 0.025, r * (0.5 + 0.18 * ((i * 7) % 3) / 2), r * 0.05, r * 0.02); c.fill();
      }
      c.globalAlpha = 1;
    } });

  S.push({ title: 'See your code, simply',
    text: 'Open one file at a time, read what it does in plain English, and change it with a sentence.',
    draw: function (c, t, r) {                      // a node opening into a file with a plain summary
      var k = ease(Math.min(1, t / 1.1));
      c.fillStyle = C.faint; circle(c, -r * 0.62 + r * 0.1 * k, 0, r * (0.1 - 0.03 * k)); c.fill();
      c.strokeStyle = C.line; c.lineWidth = r * 0.025; c.beginPath(); c.moveTo(-r * 0.5, 0); c.lineTo(-r * 0.3, 0); c.stroke();
      c.globalAlpha = k; c.fillStyle = '#0a0b0f'; c.strokeStyle = C.text; c.lineWidth = r * 0.035;
      rr(c, -r * 0.3, -r * 0.5, r * 0.88, r * 1.0, r * 0.08); c.fill(); c.stroke();
      for (var i = 0; i < 5; i++) { c.fillStyle = i === 2 ? C.amber : C.faint; rr(c, -r * 0.2, -r * 0.36 + i * r * 0.1, r * (0.3 + 0.28 * ((i * 5) % 3) / 2), r * 0.04, r * 0.02); c.fill(); }
      c.fillStyle = C.text; rr(c, -r * 0.2, r * 0.18, r * 0.68, r * 0.2, r * 0.1); c.fill();
      c.fillStyle = '#08090c'; rr(c, -r * 0.12, r * 0.265, r * 0.5, r * 0.03, r * 0.015); c.fill();
      c.globalAlpha = 1;
    } });

  S.push({ title: 'Built for kids, run by a parent',
    text: 'A PIN-protected Child Lock decides what can be made and when. It’s honest about its limits, too.',
    draw: function (c, t, r) {                      // a shield wrapped around a small play orb
      c.strokeStyle = C.text; c.lineWidth = r * 0.04; c.fillStyle = '#0a0b0f';
      c.beginPath(); c.moveTo(0, -r * 0.66); c.quadraticCurveTo(r * 0.5, -r * 0.55, r * 0.55, -r * 0.4);
      c.quadraticCurveTo(r * 0.55, r * 0.35, 0, r * 0.7); c.quadraticCurveTo(-r * 0.55, r * 0.35, -r * 0.55, -r * 0.4);
      c.quadraticCurveTo(-r * 0.5, -r * 0.55, 0, -r * 0.66); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(78,203,125,' + (0.25 + 0.5 * pulse(t, 2)) + ')'; c.lineWidth = r * 0.03; circle(c, 0, 0, r * (0.28 + 0.04 * pulse(t, 2))); c.stroke();
      c.fillStyle = C.green; circle(c, 0, 0, r * 0.15); c.fill();
      c.fillStyle = '#08090c'; c.beginPath(); c.moveTo(-r * 0.04, -r * 0.07); c.lineTo(-r * 0.04, r * 0.07); c.lineTo(r * 0.08, 0); c.closePath(); c.fill();
    } });

  /* ---- state */
  var N = S.length, step = TAU / N;
  var frontAbs = 0;                  // unbounded index of the station at the front
  var rot = Math.PI / 2;             // ring rotation (rad); front station sits at angle PI/2 (bottom, nearest)
  var tween = null, frontSince = performance.now();
  var drag = null, hoverPause = false, userTouched = false, lastAuto = performance.now();
  var W = 0, H = 0, dpr = 1, stars = null, hits = [];
  var AUTO_MS = 4800;

  function frontIdx() { return ((frontAbs % N) + N) % N; }
  function rotFor(abs) { return Math.PI / 2 - abs * step; }

  function setCaption(animate) {
    var i = frontIdx();
    var apply = function () {
      capNo.textContent = (i + 1) + ' / ' + N;
      capTitle.textContent = S[i].title;
      capText.textContent = S[i].text;
      capBox.classList.remove('swap');
    };
    if (animate && !reduce) { capBox.classList.add('swap'); setTimeout(apply, 220); } else apply();
    var bs = dotsHost.querySelectorAll('button');
    for (var b = 0; b < bs.length; b++) bs[b].setAttribute('aria-current', b === i ? 'true' : 'false');
  }

  function goTo(abs, instant) {
    if (abs === frontAbs && !tween) return;
    var from = rot, to = rotFor(abs);
    frontAbs = abs; frontSince = performance.now(); lastAuto = frontSince;
    setCaption(true);
    if (reduce || instant) { rot = to; tween = null; return; }
    tween = { from: from, to: to, t0: performance.now(), dur: 900 };
  }
  function stepBy(d) { userTouched = true; capBox.setAttribute('aria-live', 'polite'); goTo(frontAbs + d); }
  function jumpToIndex(i) {
    userTouched = true; capBox.setAttribute('aria-live', 'polite');
    var cur = frontIdx(), d = i - cur;
    if (d > N / 2) d -= N; if (d < -N / 2) d += N;
    goTo(frontAbs + d);
  }

  /* ---- layout + drawing */
  function resize() {
    var r = stage.getBoundingClientRect();
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    W = Math.max(280, Math.round(r.width)); H = Math.max(240, Math.round(r.height));
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    stars = null;
  }
  function makeStars() {
    stars = document.createElement('canvas'); stars.width = canvas.width; stars.height = canvas.height;
    var s = stars.getContext('2d'), seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < 90; i++) {
      var x = rnd() * stars.width, y = rnd() * stars.height, a = 0.12 + rnd() * 0.4, z = (rnd() < 0.12 ? 1.6 : 0.9) * dpr;
      s.fillStyle = 'rgba(242,242,245,' + a.toFixed(2) + ')'; s.fillRect(x, y, z, z);
    }
  }

  var lastPaint = 0, onScreen = true;
  function frame(now) {
    // ~30 frames a second is plenty for slow-turning bodies, and it keeps the main thread quiet; turning gets the full rate
    if (!drag && !tween && now - lastPaint < 28) { requestAnimationFrame(frame); return; }
    lastPaint = now;
    if (!onScreen) { idle = true; return; }
    if (tween) {
      var p = Math.min(1, (now - tween.t0) / tween.dur);
      rot = tween.from + (tween.to - tween.from) * ease(p);
      if (p >= 1) { rot = tween.to; tween = null; }
    }
    if (!reduce && !drag && !hoverPause && !document.hidden && !tween && now - lastAuto > AUTO_MS) { goTo(frontAbs + 1); }
    draw(now);
    if (!reduce || tween || drag) requestAnimationFrame(frame); else idle = true;
  }
  var idle = false;
  function kick() { if (idle) { idle = false; requestAnimationFrame(frame); } }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { onScreen = es[0].isIntersecting; if (onScreen) { lastAuto = performance.now(); kick(); } }, { threshold: 0.05 }).observe(stage);
  }

  function draw(now) {
    if (!stars) makeStars();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#08090c'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(stars, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var cx = W / 2, cy = H * 0.5, Rx = W * 0.37, Ry = H * 0.19;
    var base = Math.min(W, H) * 0.095;
    // the ring itself: two faint arcs (back and front), so it reads as a ring seen from slightly above
    ctx.strokeStyle = '#1d1f27'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(cx, cy, Rx, Ry, 0, 0, TAU); ctx.stroke();

    var list = [];
    for (var i = 0; i < N; i++) {
      // station i's index relative to the front (-N/2..N/2)
      var rel = i - frontIdx(); if (rel > N / 2) rel -= N; if (rel < -N / 2) rel += N;
      var ang = rot + (frontAbs + rel) * step;
      var depth = (Math.sin(ang) + 1) / 2;                   // 1 = nearest
      var prox = Math.max(0, 1 - Math.abs(((ang - Math.PI / 2 + Math.PI * 3) % TAU) - Math.PI) / step);
      var scale = 0.5 + 0.5 * Math.pow(depth, 1.3) + 0.95 * prox;
      list.push({ i: i, x: cx + Math.cos(ang) * Rx, y: cy + Math.sin(ang) * Ry, depth: depth, prox: prox, scale: scale });
    }
    list.sort(function (p, q) { return p.depth - q.depth; });
    hits = [];
    var tFront = (now - frontSince) / 1000;
    for (var k = 0; k < list.length; k++) {
      var b = list[k], r = base * b.scale;
      var isFront = b.i === frontIdx() && b.prox > 0.55;
      ctx.save(); ctx.translate(b.x, b.y);
      ctx.globalAlpha = 0.38 + 0.62 * b.depth;
      ctx.fillStyle = C.body; circle(ctx, 0, 0, r); ctx.fill();
      ctx.strokeStyle = isFront ? 'rgba(242,242,245,.75)' : C.bodyEdge; ctx.lineWidth = isFront ? 1.5 : 1; circle(ctx, 0, 0, r); ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r - 1, 0, TAU); ctx.clip();
      var tt = isFront ? tFront : (reduce ? 1.6 : 1.2);
      try { S[b.i].draw(ctx, tt, r * 0.8); } catch (e) { /* a drawing bug must never stop the ring */ }
      ctx.restore(); ctx.restore();
      hits.push({ i: b.i, x: b.x, y: b.y, r: r });
    }
    if (reduce) { /* static: one frame per change */ }
  }

  /* ---- input */
  function localPos(e) { var r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) }; }
  stage.addEventListener('pointerdown', function (e) {
    var p = localPos(e);
    drag = { x0: p.x, rot0: rot, moved: false, id: e.pointerId, p0: p, t0: performance.now() };
    tween = null;
    try { stage.setPointerCapture(e.pointerId); } catch (x) { /* older engines */ }
    kick();
  });
  stage.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var p = localPos(e), dx = p.x - drag.x0;
    if (Math.abs(dx) > 4) drag.moved = true;
    rot = drag.rot0 + dx / (W * 0.37) * 1.0;
    // keep the "front" in step with the drag so the caption follows
    var abs = Math.round((Math.PI / 2 - rot) / step);
    if (abs !== frontAbs) { frontAbs = abs; frontSince = performance.now(); setCaption(false); }
    draw(performance.now());
  });
  function endDrag(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    var d = drag; drag = null; userTouched = true; capBox.setAttribute('aria-live', 'polite');
    if (!d.moved) {                       // a tap: bring the tapped body to the front
      var p = d.p0, best = null;
      for (var i = hits.length - 1; i >= 0; i--) { var h = hits[i], dx = p.x - h.x, dy = p.y - h.y; if (dx * dx + dy * dy <= h.r * h.r) { best = h; break; } }
      if (best) { jumpToIndex(best.i); return; }
    }
    var abs = Math.round((Math.PI / 2 - rot) / step);
    var from = rot; frontAbs = abs; frontSince = performance.now(); lastAuto = frontSince; setCaption(false);
    if (reduce) { rot = rotFor(abs); draw(performance.now()); return; }
    tween = { from: from, to: rotFor(abs), t0: performance.now(), dur: 380 };
    kick();
  }
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('mouseenter', function () { hoverPause = true; });
  stage.addEventListener('mouseleave', function () { hoverPause = false; lastAuto = performance.now(); });
  stage.addEventListener('focusin', function () { hoverPause = true; });
  stage.addEventListener('focusout', function () { hoverPause = false; lastAuto = performance.now(); });
  stage.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); stepBy(1); kick(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); stepBy(-1); kick(); }
    else if (e.key === 'Home') { e.preventDefault(); jumpToIndex(0); kick(); }
    else if (e.key === 'End') { e.preventDefault(); jumpToIndex(N - 1); kick(); }
  });

  for (var n = 0; n < N; n++) {
    (function (i) {
      var li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button'; b.textContent = String(i + 1); b.setAttribute('aria-label', 'Show: ' + S[i].title);
      b.addEventListener('click', function () { jumpToIndex(i); kick(); });
      li.appendChild(b); dotsHost.appendChild(li);
    })(n);
  }

  window.addEventListener('resize', function () { resize(); draw(performance.now()); });
  document.addEventListener('visibilitychange', function () { lastAuto = performance.now(); });
  resize();
  rot = rotFor(0);
  setCaption(false);
  draw(performance.now());
  idle = false;
  requestAnimationFrame(frame);
  // expose the station list for tests / the no-JS fallback text
  window.__galaxy = { stations: S.map(function (s) { return { title: s.title, text: s.text }; }), goTo: function (i) { jumpToIndex(i); kick(); }, front: frontIdx };
})();
