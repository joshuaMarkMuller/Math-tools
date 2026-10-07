'use strict';
/* Quadratic Plotter — place three points, see y = ax² + bx + c, explore gradient. */
(() => {
  const $ = (id) => document.getElementById(id);
  const canvas = $('plot');
  const ctx = canvas.getContext('2d');
  const wrap = $('plotWrap');

  const LABELS = ['A', 'B', 'C'];
  const COLORS = ['#e4572e', '#2e86de', '#17a589'];
  const CURVE = '#7b3fe4';
  const RUN_C = '#e67e22';
  const RISE_C = '#16a34a';
  const MINUS = '−';

  const state = {
    points: [],          // [{x, y}]
    snap: 0.5,           // 0 = off
    showCoords: true,
    showVertex: false,
    showIntercepts: false,
    fractions: true,
    gradient: false,
    gradX: null,
    run: 1,
  };
  const view = { cx: 0, cy: 0, scale: 30 }; // scale = pixels per unit
  let W = 0, H = 0, dpr = 1, firstFit = true;

  /* ---------------- Number helpers ---------------- */
  const clean = (v) => (Math.abs(v) < 1e-10 ? 0 : Math.round(v * 1e9) / 1e9);

  function toFraction(v, maxDen = 100) {
    for (let d = 1; d <= maxDen; d++) {
      const n = Math.round(v * d);
      if (Math.abs(n / d - v) < 1e-9) return [n, d];
    }
    return null;
  }

  // Plain-text number for the canvas (decimals, max 2 dp)
  function fmtText(v) {
    const r = Math.round(v * 100) / 100;
    const s = String(Math.abs(r) < 1e-12 ? 0 : r);
    return s.replace('-', MINUS);
  }

  // HTML number for the side panel (fraction or decimal, unsigned if abs=true)
  function fmtHTML(v, abs = false) {
    const neg = v < 0;
    const a = Math.abs(v);
    let body;
    const f = state.fractions ? toFraction(a) : null;
    if (f && f[1] !== 1) {
      body = `<span class="frac"><span>${f[0]}</span><span>${f[1]}</span></span>`;
    } else {
      body = String(Math.round(a * 1000) / 1000);
    }
    return (neg && !abs ? MINUS : '') + body;
  }

  function snapV(v) {
    if (state.snap) return clean(Math.round(v / state.snap) * state.snap);
    return clean(Math.round(v * 100) / 100);
  }

  /* ---------------- Maths ---------------- */
  function getQuadratic() {
    const p = state.points;
    if (p.length < 3) return { status: 'need' };
    const [p1, p2, p3] = p;
    const e = 1e-9;
    if (Math.abs(p1.x - p2.x) < e || Math.abs(p1.x - p3.x) < e || Math.abs(p2.x - p3.x) < e) {
      return { status: 'samex' };
    }
    const s12 = (p2.y - p1.y) / (p2.x - p1.x);
    const s13 = (p3.y - p1.y) / (p3.x - p1.x);
    const a = clean((s13 - s12) / (p3.x - p2.x));
    const b = clean(s12 - a * (p1.x + p2.x));
    const c = clean(p1.y - a * p1.x * p1.x - b * p1.x);
    return { status: a === 0 ? 'linear' : 'ok', a, b, c };
  }
  const hasCurve = (q) => q.status === 'ok' || q.status === 'linear';
  const evalQ = (q, x) => q.a * x * x + q.b * x + q.c;

  /* ---------------- View transforms ---------------- */
  const toPx = (x) => W / 2 + (x - view.cx) * view.scale;
  const toPy = (y) => H / 2 - (y - view.cy) * view.scale;
  const fromPx = (px) => view.cx + (px - W / 2) / view.scale;
  const fromPy = (py) => view.cy - (py - H / 2) / view.scale;

  function fitView() {
    view.cx = 0; view.cy = 0;
    view.scale = Math.max(8, Math.min(W, H) / 22); // shows roughly −10 … 10
  }

  function resize() {
    const r = wrap.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    if (firstFit && W > 0) { fitView(); firstFit = false; }
    draw();
  }

  /* ---------------- Drawing ---------------- */
  function gridSteps() {
    const steps = [0.25, 0.5, 1, 2, 5, 10, 20, 50, 100];
    let major = 100;
    for (const s of steps) if (s * view.scale >= 28) { major = s; break; }
    const minor = (major === 5 || major === 50) ? major / 5 : major / 2;
    return { major, minor };
  }

  function line(x1, y1, x2, y2) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  function drawGrid() {
    const { major, minor } = gridSteps();
    const xmin = fromPx(0), xmax = fromPx(W), ymin = fromPy(H), ymax = fromPy(0);
    const isMajor = (v) => Math.abs(v / major - Math.round(v / major)) < 1e-6;

    ctx.lineWidth = 1;
    const drawLines = (step, colour, onlyMajor) => {
      if (step * view.scale < 7) return;
      ctx.strokeStyle = colour;
      for (let i = Math.ceil(xmin / step); i <= Math.floor(xmax / step); i++) {
        const x = i * step; if (!onlyMajor && isMajor(x)) continue;
        const px = Math.round(toPx(x)) + 0.5; line(px, 0, px, H);
      }
      for (let i = Math.ceil(ymin / step); i <= Math.floor(ymax / step); i++) {
        const y = i * step; if (!onlyMajor && isMajor(y)) continue;
        const py = Math.round(toPy(y)) + 0.5; line(0, py, W, py);
      }
    };
    drawLines(minor, '#eef1f6', false);
    drawLines(major, '#d3dae5', true);

    // Axes
    const ax = Math.round(toPx(0)) + 0.5, ay = Math.round(toPy(0)) + 0.5;
    ctx.strokeStyle = '#2b3445'; ctx.lineWidth = 1.6;
    if (ax >= 0 && ax <= W) line(ax, 0, ax, H);
    if (ay >= 0 && ay <= H) line(0, ay, W, ay);

    // Axis numbers
    ctx.fillStyle = '#4a5568';
    ctx.font = '12px "Segoe UI", system-ui, sans-serif';
    const labelY = Math.min(Math.max(ay + 4, 4), H - 18);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let i = Math.ceil(xmin / major); i <= Math.floor(xmax / major); i++) {
      const x = i * major; if (Math.abs(x) < 1e-9) continue;
      ctx.fillText(fmtText(x), toPx(x), labelY);
    }
    const leftSide = ax > 30;
    const labelX = Math.min(Math.max(ax - 6, 30), W - 6);
    ctx.textAlign = leftSide ? 'right' : 'left'; ctx.textBaseline = 'middle';
    for (let i = Math.ceil(ymin / major); i <= Math.floor(ymax / major); i++) {
      const y = i * major; if (Math.abs(y) < 1e-9) continue;
      ctx.fillText(fmtText(y), leftSide ? labelX : Math.max(ax + 6, 6), toPy(y));
    }
    if (ax >= 0 && ay >= 0 && ax <= W && ay <= H) {
      ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText('0', ax - 4, ay + 4);
    }
    // Axis names
    ctx.font = 'italic 600 15px "Cambria Math", Georgia, serif';
    ctx.fillStyle = '#2b3445';
    if (ay >= 0 && ay <= H) { ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText('x', W - 8, ay - 4); }
    if (ax >= 0 && ax <= W) { ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('y', ax + 8, 8); }
  }

  function drawCurve(q) {
    ctx.strokeStyle = CURVE; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let px = -2; px <= W + 2; px += 1) {
      const py = Math.max(-5000, Math.min(H + 5000, toPy(evalQ(q, fromPx(px)))));
      px === -2 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // Label with a white pill behind it. (dx, dy) offsets from anchor; kept on-screen.
  function label(text, px, py, colour, dx = 12, dy = -14, bold = true) {
    ctx.font = `${bold ? '600 ' : ''}14px "Segoe UI", system-ui, sans-serif`;
    const w = ctx.measureText(text).width + 12, h = 22;
    let x = dx >= 0 ? px + dx : px + dx - w;
    if (dx === 0) x = px - w / 2;
    let y = py + dy - h / 2;
    x = Math.max(4, Math.min(W - w - 4, x));
    y = Math.max(4, Math.min(H - h - 4, y));
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    roundRect(x, y, w, h, 6); ctx.fill();
    ctx.strokeStyle = colour; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = colour; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 6, y + h / 2 + 0.5);
  }

  function dot(px, py, r, fill, stroke = '#fff', lw = 2.5) {
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }

  const coordText = (x, y) => `(${fmtText(x)}, ${fmtText(y)})`;

  function drawFeatures(q) {
    if (q.status !== 'ok' && !(q.status === 'linear' && state.showIntercepts)) return;
    const grey = '#5f6b7d';
    if (state.showVertex && q.status === 'ok') {
      const h = -q.b / (2 * q.a), k = evalQ(q, h);
      const px = toPx(h);
      ctx.save(); ctx.setLineDash([7, 6]); ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 2;
      line(px, 0, px, H); ctx.restore();
      dot(px, toPy(k), 6, '#7b3fe4');
      label(`Turning point ${coordText(h, k)}`, px, toPy(k), CURVE, 12, q.a > 0 ? 20 : -20);
      label(`x = ${fmtText(h)}`, px, 16, '#7b3fe4', 8, 4, false);
    }
    if (state.showIntercepts) {
      // y-intercept
      dot(toPx(0), toPy(q.c), 5.5, grey);
      label(`(0, ${fmtText(q.c)})`, toPx(0), toPy(q.c), grey, -10, -14, false);
      // x-intercepts
      xIntercepts(q).forEach((x) => {
        dot(toPx(x), toPy(0), 5.5, grey);
        label(`(${fmtText(x)}, 0)`, toPx(x), toPy(0), grey, 0, 20, false);
      });
    }
  }

  function xIntercepts(q) {
    if (q.status === 'linear') return q.b === 0 ? [] : [-q.c / q.b];
    const D = q.b * q.b - 4 * q.a * q.c;
    if (D < -1e-12) return [];
    if (Math.abs(D) < 1e-12) return [-q.b / (2 * q.a)];
    const s = Math.sqrt(D);
    return [(-q.b - s) / (2 * q.a), (-q.b + s) / (2 * q.a)].sort((m, n) => m - n);
  }

  function drawGradient(q) {
    if (!state.gradient || !hasCurve(q) || state.gradX === null) return;
    const x0 = state.gradX, y0 = evalQ(q, x0);
    const m = clean(2 * q.a * x0 + q.b);
    const r = state.run, rise = clean(m * r);

    // Tangent line across the screen
    const xl = fromPx(0), xr = fromPx(W);
    ctx.save();
    ctx.setLineDash([10, 7]); ctx.strokeStyle = '#334155'; ctx.lineWidth = 2;
    line(0, toPy(y0 + m * (xl - x0)), W, toPy(y0 + m * (xr - x0)));
    ctx.restore();

    const P = [toPx(x0), toPy(y0)];
    const Q = [toPx(x0 + r), toPy(y0)];
    const R = [toPx(x0 + r), toPy(y0 + rise)];

    // Shaded triangle
    ctx.fillStyle = 'rgba(22,163,74,0.08)';
    ctx.beginPath(); ctx.moveTo(...P); ctx.lineTo(...Q); ctx.lineTo(...R); ctx.closePath(); ctx.fill();

    ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.strokeStyle = RUN_C; line(...P, ...Q);
    ctx.strokeStyle = RISE_C; line(...Q, ...R);
    ctx.lineCap = 'butt';

    // Arrowhead on the rise
    if (Math.abs(R[1] - Q[1]) > 12) {
      const dir = R[1] < Q[1] ? -1 : 1;
      ctx.fillStyle = RISE_C; ctx.beginPath();
      ctx.moveTo(R[0], R[1]); ctx.lineTo(R[0] - 6, R[1] - dir * 11); ctx.lineTo(R[0] + 6, R[1] - dir * 11);
      ctx.closePath(); ctx.fill();
    }

    label(`run = ${fmtText(r)}`, (P[0] + Q[0]) / 2, P[1], RUN_C, 0, rise >= 0 ? 20 : -20);
    label(`rise = ${fmtText(rise)}`, Q[0], (Q[1] + R[1]) / 2, RISE_C, 12, 0);

    dot(P[0], P[1], 8, '#111827');
    label(`P ${coordText(x0, y0)}`, P[0], P[1], '#111827', -12, rise >= 0 ? 18 : -18);
  }

  function drawPoints() {
    state.points.forEach((p, i) => {
      const px = toPx(p.x), py = toPy(p.y);
      dot(px, py, 9, COLORS[i]);
      const text = state.showCoords ? `${LABELS[i]} ${coordText(p.x, p.y)}` : LABELS[i];
      label(text, px, py, COLORS[i], 12, -16);
    });
  }

  function draw() {
    if (!W || !H) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    drawGrid();
    const q = getQuadratic();
    if (hasCurve(q)) {
      drawCurve(q);
      drawFeatures(q);
      drawGradient(q);
    }
    drawPoints();
  }

  /* ---------------- Side panel ---------------- */
  function equationHTML(q) {
    const terms = [[q.a, 'x²'], [q.b, 'x'], [q.c, '']];
    let out = '', first = true;
    for (const [coef, v] of terms) {
      if (coef === 0) continue;
      const showNum = !(v && Math.abs(coef) === 1);
      const num = showNum ? fmtHTML(coef, true) : '';
      const sign = coef < 0 ? (first ? MINUS : `&nbsp;${MINUS}&nbsp;`) : (first ? '' : '&nbsp;+&nbsp;');
      out += `${sign}${num}${v ? `<i>${v}</i>` : ''}`;
      first = false;
    }
    if (first) out = '0';
    return `<i>y</i>&nbsp;=&nbsp;${out}`;
  }

  function updatePanel() {
    const q = getQuadratic();
    const eq = $('equation'), notice = $('eqNotice'), facts = $('facts');
    notice.innerHTML = ''; facts.innerHTML = '';

    if (q.status === 'need') {
      eq.className = 'equation empty';
      eq.textContent = `Place 3 points to draw a quadratic (${state.points.length} of 3 placed).`;
    } else if (q.status === 'samex') {
      eq.className = 'equation empty';
      eq.textContent = 'No graph';
      notice.innerHTML = '<div class="notice">Two points have the same <i>x</i>-value. A quadratic can only have one <i>y</i>-value for each <i>x</i>, so move one of the points.</div>';
    } else {
      eq.className = 'equation';
      eq.innerHTML = equationHTML(q);
      if (q.status === 'linear') {
        notice.innerHTML = '<div class="notice">The three points lie on a straight line, so <i>a</i> = 0 and the graph is linear, not a parabola.</div>';
      } else {
        const li = (k, v) => `<li><b>${k}:</b> ${v}</li>`;
        let html = li('a', fmtHTML(q.a)) + li('b', fmtHTML(q.b)) + li('c', fmtHTML(q.c));
        html += li('Shape', q.a > 0 ? 'opens upward (∪), minimum turning point' : 'opens downward (∩), maximum turning point');
        if (state.showVertex) {
          const h = -q.b / (2 * q.a), k = evalQ(q, h);
          html += li('Turning point', `(${fmtHTML(h)}, ${fmtHTML(k)})`);
          html += li('Axis of symmetry', `<i>x</i> = ${fmtHTML(h)}`);
        }
        if (state.showIntercepts) {
          html += li('y-intercept', `(0, ${fmtHTML(q.c)})`);
          const xs = xIntercepts(q);
          html += li('x-intercepts', xs.length ? xs.map((x) => `(${toFraction(x) ? fmtHTML(x) : fmtText(x)}, 0)`).join(', ') : 'none (the graph does not cross the x-axis)');
        }
        facts.innerHTML = html;
      }
    }
    updateGradPanel(q);
  }

  function updateGradPanel(q) {
    $('gradPanel').hidden = !state.gradient;
    if (!state.gradient) return;
    const box = $('gradInfo');
    if (!hasCurve(q)) { box.innerHTML = '<p class="hint" style="margin:0">Place three points first to draw the curve.</p>'; return; }
    if (state.gradX === null) state.gradX = defaultGradX(q);
    const x0 = state.gradX, y0 = evalQ(q, x0);
    const m = clean(2 * q.a * x0 + q.b), r = state.run, rise = clean(m * r);
    box.innerHTML = `
      <div style="margin-bottom:6px">P = (${fmtHTML(x0)}, ${fmtHTML(y0)})</div>
      <div class="grad-big">gradient =
        <span class="frac" style="font-size:.8em"><span class="rise">rise</span><span class="run">run</span></span> =
        <span class="frac" style="font-size:.8em"><span class="rise">${fmtText(rise)}</span><span class="run">${fmtText(r)}</span></span> =
        <span>${fmtHTML(m)}</span>
      </div>
      <p class="hint">The gradient of a curve at a point is the gradient of its <b>tangent</b> (the dashed line that just touches the curve at P).</p>`;
  }

  function defaultGradX(q) {
    if (q.status === 'ok') return snapV(-q.b / (2 * q.a) + 1);
    return snapV(view.cx);
  }

  function renderPointList() {
    const list = $('pointList');
    list.innerHTML = '';
    const step = state.snap || 0.01;
    for (let i = 0; i < 3; i++) {
      const p = state.points[i];
      const row = document.createElement('div');
      row.className = 'pt-row';
      const dotEl = `<span class="pt-dot" style="background:${p ? COLORS[i] : '#c3cad6'}">${LABELS[i]}</span>`;
      if (p) {
        row.innerHTML = `${dotEl}
          <label>x <input type="number" step="${step}" data-i="${i}" data-k="x" value="${p.x}"></label>
          <label>y <input type="number" step="${step}" data-i="${i}" data-k="y" value="${p.y}"></label>
          <button class="rm" title="Remove point ${LABELS[i]}" data-rm="${i}">×</button>`;
      } else {
        row.innerHTML = `${dotEl}<span class="pt-empty">${i === state.points.length ? 'Click the grid to place this point' : '—'}</span>`;
      }
      list.appendChild(row);
    }
  }

  function syncInputs() {
    document.querySelectorAll('#pointList input').forEach((inp) => {
      if (document.activeElement === inp) return;
      const p = state.points[+inp.dataset.i];
      if (p) inp.value = p[inp.dataset.k];
    });
  }

  $('pointList').addEventListener('change', (e) => {
    const inp = e.target.closest('input'); if (!inp) return;
    const v = parseFloat(inp.value);
    const p = state.points[+inp.dataset.i];
    if (!p || !isFinite(v)) { syncInputs(); return; }
    p[inp.dataset.k] = clean(Math.round(v * 1000) / 1000);
    refresh();
  });
  $('pointList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rm]'); if (!b) return;
    removePoint(+b.dataset.rm);
  });

  function refresh(rebuildList = false) {
    if (rebuildList) renderPointList(); else syncInputs();
    updatePanel();
    draw();
  }

  function removePoint(i) {
    state.points.splice(i, 1);
    refresh(true);
  }

  /* ---------------- Toast ---------------- */
  let toastTimer;
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---------------- Pointer interaction ---------------- */
  let drag = null;
  const evPos = (e) => { const r = canvas.getBoundingClientRect(); return { px: e.clientX - r.left, py: e.clientY - r.top }; };

  function hitPoint(px, py, rad) {
    let best = -1, bd = rad;
    state.points.forEach((p, i) => {
      const d = Math.hypot(toPx(p.x) - px, toPy(p.y) - py);
      if (d <= bd) { bd = d; best = i; }
    });
    return best;
  }

  function nearGradPoint(q, px, py, rad) {
    if (!state.gradient || !hasCurve(q) || state.gradX === null) return false;
    return Math.hypot(toPx(state.gradX) - px, toPy(evalQ(q, state.gradX)) - py) <= rad;
  }

  function nearCurve(q, px, py, rad) {
    if (!hasCurve(q)) return false;
    // Check vertical distance and a few neighbouring pixels (handles steep parts)
    for (let dx = -rad; dx <= rad; dx += 2) {
      const y = toPy(evalQ(q, fromPx(px + dx)));
      if (Math.hypot(dx, y - py) <= rad) return true;
    }
    return false;
  }

  function setGradX(x) {
    state.gradX = snapV(x);
    updatePanel(); draw();
  }

  function updateReadout(px, py) {
    const x = snapV(fromPx(px)), y = snapV(fromPy(py));
    $('readout').textContent = `Cursor: (${fmtText(x)}, ${fmtText(y)})`;
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const { px, py } = evPos(e);
    const rad = e.pointerType === 'touch' ? 24 : 14;
    const q = getQuadratic();
    canvas.setPointerCapture(e.pointerId);

    if (nearGradPoint(q, px, py, rad)) { drag = { type: 'grad' }; return; }
    const i = hitPoint(px, py, rad);
    if (i >= 0) { drag = { type: 'point', i }; canvas.style.cursor = 'grabbing'; return; }
    if (state.gradient && nearCurve(q, px, py, rad)) { drag = { type: 'grad' }; setGradX(fromPx(px)); return; }
    drag = { type: 'pan', sx: px, sy: py, cx: view.cx, cy: view.cy, moved: false };
  });

  canvas.addEventListener('pointermove', (e) => {
    const { px, py } = evPos(e);
    updateReadout(px, py);
    if (!drag) {
      const q = getQuadratic();
      const rad = 14;
      if (nearGradPoint(q, px, py, rad) || hitPoint(px, py, rad) >= 0) canvas.style.cursor = 'grab';
      else if (state.gradient && nearCurve(q, px, py, rad)) canvas.style.cursor = 'pointer';
      else canvas.style.cursor = 'crosshair';
      return;
    }
    if (drag.type === 'point') {
      const p = state.points[drag.i];
      const nx = snapV(fromPx(px)), ny = snapV(fromPy(py));
      if (nx !== p.x || ny !== p.y) { p.x = nx; p.y = ny; refresh(); }
    } else if (drag.type === 'grad') {
      const x = snapV(fromPx(px));
      if (x !== state.gradX) setGradX(x);
    } else if (drag.type === 'pan') {
      if (!drag.moved && Math.hypot(px - drag.sx, py - drag.sy) > 5) { drag.moved = true; canvas.style.cursor = 'move'; }
      if (drag.moved) {
        view.cx = drag.cx - (px - drag.sx) / view.scale;
        view.cy = drag.cy + (py - drag.sy) / view.scale;
        draw();
      }
    }
  });

  function endDrag(e) {
    if (!drag) return;
    if (drag.type === 'pan' && !drag.moved && e.type === 'pointerup') {
      const { px, py } = evPos(e);
      if (state.points.length < 3) {
        state.points.push({ x: snapV(fromPx(px)), y: snapV(fromPy(py)) });
        if (state.points.length === 3 && state.gradient) state.gradX = null;
        refresh(true);
      } else {
        toast('All three points are placed. Drag a point to move it, or double‑click it to remove it.');
      }
    }
    drag = null;
    canvas.style.cursor = 'crosshair';
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => { if (!drag) $('readout').textContent = 'Click the grid to place a point'; });

  function removeAt(e) {
    const { px, py } = evPos(e);
    const i = hitPoint(px, py, 16);
    if (i >= 0) { e.preventDefault(); removePoint(i); }
  }
  canvas.addEventListener('dblclick', removeAt);
  canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); removeAt(e); });

  function zoomAt(px, py, factor) {
    const x = fromPx(px), y = fromPy(py);
    view.scale = Math.max(4, Math.min(400, view.scale * factor));
    view.cx = x - (px - W / 2) / view.scale;
    view.cy = y + (py - H / 2) / view.scale;
    draw();
  }
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const { px, py } = evPos(e);
    zoomAt(px, py, Math.exp(-e.deltaY * 0.0015));
  }, { passive: false });

  $('zoomIn').onclick = () => zoomAt(W / 2, H / 2, 1.25);
  $('zoomOut').onclick = () => zoomAt(W / 2, H / 2, 0.8);
  $('zoomReset').onclick = () => { fitView(); draw(); };

  /* ---------------- Controls ---------------- */
  function segmented(id, onPick) {
    const seg = $(id);
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      onPick(b.dataset.v);
    });
  }
  segmented('snapSeg', (v) => {
    state.snap = parseFloat(v);
    if (state.snap) state.points.forEach((p) => { p.x = snapV(p.x); p.y = snapV(p.y); });
    if (state.gradX !== null) state.gradX = snapV(state.gradX);
    refresh(true);
  });
  segmented('numFormat', (v) => { state.fractions = v === 'frac'; updatePanel(); });
  segmented('runSeg', (v) => { state.run = parseFloat(v); updatePanel(); draw(); });

  $('optCoords').onchange = (e) => { state.showCoords = e.target.checked; draw(); };
  $('optVertex').onchange = (e) => { state.showVertex = e.target.checked; refresh(); };
  $('optIntercepts').onchange = (e) => { state.showIntercepts = e.target.checked; refresh(); };
  $('optGradient').onchange = (e) => {
    state.gradient = e.target.checked;
    if (state.gradient) state.gradX = null;
    refresh();
  };

  $('btnClear').onclick = () => { state.points = []; state.gradX = null; refresh(true); };

  $('btnRandom').onclick = () => {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const aChoices = state.snap === 1 ? [-2, -1, 1, 2] : [-2, -1, -0.5, 0.5, 1, 2];
    for (let tries = 0; tries < 50; tries++) {
      const a = pick(aChoices), h = pick([-3, -2, -1, 0, 1, 2, 3]), k = pick([-4, -3, -2, -1, 0, 1, 2, 3, 4]);
      const xs = pick([[-2, 0, 1], [-1, 0, 2], [-2, 1, 2], [-3, -1, 1]]).map((d) => h + d);
      const pts = xs.map((x) => ({ x, y: a * (x - h) ** 2 + k }));
      if (pts.every((p) => Math.abs(p.y) <= 9 && Math.abs(p.x) <= 9)) {
        state.points = pts; state.gradX = null;
        refresh(true); return;
      }
    }
  };

  /* ---------------- Start ---------------- */
  new ResizeObserver(resize).observe(wrap);
  renderPointList();
  updatePanel();
  resize();
})();
