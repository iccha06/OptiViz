let contourCache = null; // { surfaceKey, res, vals, min, max }

export function invalidateContourCache() {
  contourCache = null;
}

export function toScreen(surface, W, H, x, y) {
  const d = surface.domain;
  const sx = ((x - d.xMin) / (d.xMax - d.xMin)) * W;
  const sy = H - ((y - d.yMin) / (d.yMax - d.yMin)) * H;
  return [sx, sy];
}

export function toMath(surface, W, H, sx, sy) {
  const d = surface.domain;
  const x = d.xMin + (sx / W) * (d.xMax - d.xMin);
  const y = d.yMin + ((H - sy) / H) * (d.yMax - d.yMin);
  return [x, y];
}

function buildContour(surface, surfaceKey, W, H) {
  const res = 140;
  const vals = new Float32Array(res * res);
  let min = Infinity, max = -Infinity;
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const [x, y] = toMath(surface, W, H, (i / res) * W, (j / res) * H);
      const z = Math.log10(1 + Math.abs(surface.f(x, y))); // log scale keeps steep surfaces readable
      vals[j * res + i] = z;
      if (z < min) min = z;
      if (z > max) max = z;
    }
  }
  contourCache = { surfaceKey, res, vals, min, max };
}

export function drawContour(ctx, surface, surfaceKey, W, H) {
  if (!contourCache || contourCache.surfaceKey !== surfaceKey) {
    buildContour(surface, surfaceKey, W, H);
  }
  const { res, vals, min, max } = contourCache;
  const cellW = W / res, cellH = H / res;
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const t = (vals[j * res + i] - min) / (max - min || 1);
      const band = Math.floor(t * 14) % 2 === 0 ? 0.05 : 0.0;
      const lightness = 6 + t * 10 + band * 6;
      ctx.fillStyle = `hsl(190, 35%, ${lightness}%)`;
      ctx.fillRect(i * cellW, j * cellH, cellW + 1, cellH + 1);
    }
  }
}

export function drawAxes(ctx, surface, W, H) {
  const [ox, oy] = toScreen(surface, W, H, 0, 0);
  ctx.strokeStyle = "#1f2b3580";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, oy); ctx.lineTo(W, oy);
  ctx.moveTo(ox, 0); ctx.lineTo(ox, H);
  ctx.stroke();
}

export function drawStartMarker(ctx, surface, W, H, startPoint) {
  const [sx, sy] = toScreen(surface, W, H, startPoint[0], startPoint[1]);
  ctx.strokeStyle = "#4fd1c5";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx - 6, sy); ctx.lineTo(sx + 6, sy);
  ctx.moveTo(sx, sy - 6); ctx.lineTo(sx, sy + 6);
  ctx.stroke();
}

export const PALETTES = {
  orange: { line: "#ff8a3d88", dot: "#ff8a3d", dotFaint: "#ff8a3d55", glow: "#ff8a3d55", glowEnd: "#ff8a3d00" },
  violet: { line: "#a78bfa88", dot: "#a78bfa", dotFaint: "#a78bfa55", glow: "#a78bfa55", glowEnd: "#a78bfa00" },
};

/** Draws the trace path + current point glow for any algorithm whose state has {x, y}. */
export function drawPath(ctx, surface, W, H, history, cursor, palette = PALETTES.orange) {
  if (cursor < 0) return;

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = palette.line;
  ctx.beginPath();
  for (let i = 0; i <= cursor; i++) {
    const [sx, sy] = toScreen(surface, W, H, history[i].x, history[i].y);
    if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  for (let i = 0; i <= cursor; i++) {
    const [sx, sy] = toScreen(surface, W, H, history[i].x, history[i].y);
    ctx.beginPath();
    ctx.arc(sx, sy, i === cursor ? 5 : 2, 0, Math.PI * 2);
    ctx.fillStyle = i === cursor ? palette.dot : palette.dotFaint;
    ctx.fill();
  }

  const [sx, sy] = toScreen(surface, W, H, history[cursor].x, history[cursor].y);
  const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 18);
  glow.addColorStop(0, palette.glow);
  glow.addColorStop(1, palette.glowEnd);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(sx, sy, 18, 0, Math.PI * 2);
  ctx.fill();
}

/** Composable full-frame render for point-trace algorithms (gradient descent today). */
export function renderFrame(ctx, surface, surfaceKey, W, H, { history, cursor, startPoint }) {
  ctx.clearRect(0, 0, W, H);
  drawContour(ctx, surface, surfaceKey, W, H);
  drawAxes(ctx, surface, W, H);
  if (cursor < 0) drawStartMarker(ctx, surface, W, H, startPoint);
  drawPath(ctx, surface, W, H, history, cursor);
}


export function renderFrameCompare(ctx, surface, surfaceKey, W, H, { historyA, cursorA, historyB, cursorB, startPoint }) {
  ctx.clearRect(0, 0, W, H);
  drawContour(ctx, surface, surfaceKey, W, H);
  drawAxes(ctx, surface, W, H);
  if (cursorA < 0 && cursorB < 0) drawStartMarker(ctx, surface, W, H, startPoint);
  drawPath(ctx, surface, W, H, historyA, cursorA, PALETTES.orange);
  drawPath(ctx, surface, W, H, historyB, cursorB, PALETTES.violet);
}


export function renderFrameCompareConvergence(ctx, W, H, { historyA, cursorA, historyB, cursorB, labelA, labelB }) {
  ctx.clearRect(0, 0, W, H);

  const margin = { left: 56, right: 18, top: 18, bottom: 32 };
  const plotW = W - margin.left - margin.right;
  const plotH = H - margin.top - margin.bottom;
  const FLOOR = 1e-12; // clamp so log10(0) doesn't blow up

  const seriesA = cursorA >= 0 ? historyA.slice(0, cursorA + 1).map(s => Math.max(s.gradNorm ?? FLOOR, FLOOR)) : [];
  const seriesB = cursorB >= 0 ? historyB.slice(0, cursorB + 1).map(s => Math.max(s.gradNorm ?? FLOOR, FLOOR)) : [];
  const maxStep = Math.max(historyA.length - 1, historyB.length - 1, 1);

  const allVals = [...seriesA, ...seriesB];
  let logMax = -Infinity, logMin = Infinity;
  for (const v of allVals) {
    const l = Math.log10(v);
    if (l > logMax) logMax = l;
    if (l < logMin) logMin = l;
  }
  if (!isFinite(logMax)) { logMax = 1; logMin = -6; }
  logMax = Math.ceil(logMax + 0.2);
  logMin = Math.floor(Math.min(logMin - 0.2, logMax - 3));

  const xPos = (step) => margin.left + (step / maxStep) * plotW;
  const yPos = (val) => {
    const t = (Math.log10(Math.max(val, FLOOR)) - logMin) / (logMax - logMin || 1);
    return margin.top + (1 - t) * plotH;
  };

  // horizontal gridlines at each power of ten, labeled on the left
  ctx.font = "10px 'JetBrains Mono', monospace";
  ctx.textBaseline = "middle";
  for (let p = Math.floor(logMin); p <= Math.ceil(logMax); p++) {
    const y = yPos(Math.pow(10, p));
    if (y < margin.top - 1 || y > H - margin.bottom + 1) continue;
    ctx.strokeStyle = "#1f2b3560";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(W - margin.right, y);
    ctx.stroke();
    ctx.fillStyle = "#4a5a66";
    ctx.fillText(`1e${p}`, 6, y);
  }

  // axes
  ctx.strokeStyle = "#7c8d9a80";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, H - margin.bottom);
  ctx.lineTo(W - margin.right, H - margin.bottom);
  ctx.stroke();

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#4a5a66";
  ctx.font = "11px 'Inter', sans-serif";
  ctx.fillText("iteration →", margin.left, H - 10);
  ctx.save();
  ctx.translate(14, margin.top + plotH / 2 + 30);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("‖∇f‖ (log scale)", 0, 0);
  ctx.restore();

  function drawSeries(series, color) {
    if (series.length === 0) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    series.forEach((v, i) => {
      const x = xPos(i), y = yPos(v);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    series.forEach((v, i) => {
      const x = xPos(i), y = yPos(v);
      ctx.beginPath();
      ctx.arc(x, y, i === series.length - 1 ? 4 : 2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });
  }
  drawSeries(seriesA, "#ff8a3d");
  drawSeries(seriesB, "#a78bfa");

  // legend, top-right of the plot area
  const legendItems = [
    { label: labelA, color: "#ff8a3d" },
    { label: labelB, color: "#a78bfa" },
  ];
  ctx.font = "11px 'Inter', sans-serif";
  let ly = margin.top + 14;
  for (const item of legendItems) {
    const textW = ctx.measureText(item.label).width;
    const lx = W - margin.right - textW - 18;
    ctx.beginPath();
    ctx.arc(lx, ly - 3, 4, 0, Math.PI * 2);
    ctx.fillStyle = item.color;
    ctx.fill();
    ctx.fillStyle = "#e8edf1";
    ctx.fillText(item.label, lx + 10, ly);
    ly += 16;
  }
}

import { computeFeasibleRegion } from "./lpGeometry.js";

function drawFeasibleRegion(ctx, problem, W, H) {
  const vertices = computeFeasibleRegion(problem.constraints);
  if (vertices.length < 3) return;

  ctx.beginPath();
  vertices.forEach(([x, y], i) => {
    const [sx, sy] = toScreen(problem, W, H, x, y);
    if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
  });
  ctx.closePath();

  ctx.fillStyle = "#4fd1c51a";
  ctx.fill();
  ctx.strokeStyle = "#4fd1c599";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // mark every candidate vertex faintly, so the ones simplex *didn't* visit are visible too
  for (const [x, y] of vertices) {
    const [sx, sy] = toScreen(problem, W, H, x, y);
    ctx.beginPath();
    ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "#4fd1c555";
    ctx.fill();
  }
}

/** Small arrow from the region's centroid pointing in the objective's gradient direction. */
function drawObjectiveArrow(ctx, problem, W, H) {
  const vertices = computeFeasibleRegion(problem.constraints);
  if (vertices.length < 3) return;
  const cx = vertices.reduce((s, p) => s + p[0], 0) / vertices.length;
  const cy = vertices.reduce((s, p) => s + p[1], 0) / vertices.length;

  const { cx: ocx, cy: ocy } = problem.objective;
  const norm = Math.hypot(ocx, ocy) || 1;
  const { xMax, xMin } = problem.domain;
  const arrowLen = (xMax - xMin) * 0.12;
  const tipX = cx + (ocx / norm) * arrowLen;
  const tipY = cy + (ocy / norm) * arrowLen;

  const [sx1, sy1] = toScreen(problem, W, H, cx, cy);
  const [sx2, sy2] = toScreen(problem, W, H, tipX, tipY);

  ctx.strokeStyle = "#7c8d9a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(sx1, sy1);
  ctx.lineTo(sx2, sy2);
  ctx.stroke();

  const angle = Math.atan2(sy2 - sy1, sx2 - sx1);
  ctx.beginPath();
  ctx.moveTo(sx2, sy2);
  ctx.lineTo(sx2 - 7 * Math.cos(angle - 0.4), sy2 - 7 * Math.sin(angle - 0.4));
  ctx.lineTo(sx2 - 7 * Math.cos(angle + 0.4), sy2 - 7 * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fillStyle = "#7c8d9a";
  ctx.fill();
}

/** Full-frame render for the Simplex method: feasible region + vertex-walk path. */
export function renderFrameLP(ctx, problem, W, H, { history, cursor }) {
  ctx.clearRect(0, 0, W, H);
  drawFeasibleRegion(ctx, problem, W, H);
  drawAxes(ctx, problem, W, H);
  drawObjectiveArrow(ctx, problem, W, H);
  drawPath(ctx, problem, W, H, history, cursor);
}

let curveCache = null; // { fnKey, res, xs, ys, yMin, yMax }

export function invalidateCurveCache() {
  curveCache = null;
}

function buildCurve(fn, fnKey) {
  const res = 400;
  const { xMin, xMax } = fn.domain;
  const xs = new Float32Array(res);
  const ys = new Float32Array(res);
  let yMin = Infinity, yMax = -Infinity;
  for (let i = 0; i < res; i++) {
    const x = xMin + (i / (res - 1)) * (xMax - xMin);
    const y = fn.f(x);
    xs[i] = x;
    ys[i] = y;
    if (isFinite(y)) {
      if (y < yMin) yMin = y;
      if (y > yMax) yMax = y;
    }
  }
  // pad the y-range a bit so the curve isn't flush against the canvas edge
  const pad = (yMax - yMin) * 0.15 || 1;
  curveCache = { fnKey, res, xs, ys, yMin: yMin - pad, yMax: yMax + pad };
}

function ensureCurve(fn, fnKey) {
  if (!curveCache || curveCache.fnKey !== fnKey) buildCurve(fn, fnKey);
  return curveCache;
}

export function toScreen1D(fn, fnKey, W, H, x, y) {
  const { xMin, xMax } = fn.domain;
  const { yMin, yMax } = ensureCurve(fn, fnKey);
  const sx = ((x - xMin) / (xMax - xMin)) * W;
  const sy = H - ((y - yMin) / (yMax - yMin)) * H;
  return [sx, sy];
}

export function toMathX1D(fn, W, sx) {
  const { xMin, xMax } = fn.domain;
  return xMin + (sx / W) * (xMax - xMin);
}

function drawCurve(ctx, fn, fnKey, W, H) {
  const { res, xs, ys } = ensureCurve(fn, fnKey);
  ctx.strokeStyle = "#4fd1c5aa";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < res; i++) {
    const [sx, sy] = toScreen1D(fn, fnKey, W, H, xs[i], ys[i]);
    if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
  }
  ctx.stroke();
}

function drawAxes1D(ctx, fn, fnKey, W, H) {
  const [ox, oy] = toScreen1D(fn, fnKey, W, H, 0, 0);
  ctx.strokeStyle = "#1f2b3580";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, oy); ctx.lineTo(W, oy); // y = 0 (root line)
  ctx.moveTo(ox, 0); ctx.lineTo(ox, H); // x = 0
  ctx.stroke();
}

/** Draws the tangent line at a given state, plus the vertical drop to the x-axis. */
function drawTangent(ctx, fn, fnKey, W, H, state, isCurrent) {
  const { x, fx, fpx } = state;
  const { xMin, xMax } = fn.domain;
  const span = xMax - xMin;

  // tangent line: y - fx = fpx * (x - x0), drawn across a chunk of the domain
  const x1 = x - span * 0.35, x2 = x + span * 0.35;
  const y1 = fx + fpx * (x1 - x);
  const y2 = fx + fpx * (x2 - x);
  const [sx1, sy1] = toScreen1D(fn, fnKey, W, H, x1, y1);
  const [sx2, sy2] = toScreen1D(fn, fnKey, W, H, x2, y2);

  ctx.strokeStyle = isCurrent ? "#ff8a3d" : "#ff8a3d40";
  ctx.lineWidth = isCurrent ? 1.5 : 1;
  ctx.beginPath();
  ctx.moveTo(sx1, sy1);
  ctx.lineTo(sx2, sy2);
  ctx.stroke();

  // vertical dashed guide from the x-axis up to the curve point
  const [sx, sy] = toScreen1D(fn, fnKey, W, H, x, fx);
  const [, syAxis] = toScreen1D(fn, fnKey, W, H, x, 0);
  if (isCurrent) {
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = "#7c8d9a80";
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx, syAxis);
    ctx.stroke();
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(sx, sy, isCurrent ? 5 : 2.5, 0, Math.PI * 2);
  ctx.fillStyle = isCurrent ? "#ff8a3d" : "#ff8a3d55";
  ctx.fill();

  // where the tangent crosses y=0 becomes the next iterate — mark it on the axis
  if (isCurrent && Math.abs(fpx) > 1e-8) {
    const xIntercept = x - fx / fpx;
    const [sxi] = toScreen1D(fn, fnKey, W, H, xIntercept, 0);
    ctx.beginPath();
    ctx.arc(sxi, syAxis, 4, 0, Math.PI * 2);
    ctx.strokeStyle = "#4fd1c5";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawStartMarker1D(ctx, fn, fnKey, W, H, startX) {
  const y = fn.f(startX);
  const [sx, sy] = toScreen1D(fn, fnKey, W, H, startX, y);
  ctx.strokeStyle = "#4fd1c5";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx - 6, sy); ctx.lineTo(sx + 6, sy);
  ctx.moveTo(sx, sy - 6); ctx.lineTo(sx, sy + 6);
  ctx.stroke();
}

/** Full-frame render for Newton-Raphson: curve + tangent-line history. */
export function renderFrame1D(ctx, fn, fnKey, W, H, { history, cursor, startX }) {
  ctx.clearRect(0, 0, W, H);
  drawCurve(ctx, fn, fnKey, W, H);
  drawAxes1D(ctx, fn, fnKey, W, H);

  if (cursor < 0) {
    drawStartMarker1D(ctx, fn, fnKey, W, H, startX);
    return;
  }

  // faded tangents for past steps, bright one for the current step
  for (let i = 0; i <= cursor; i++) {
    drawTangent(ctx, fn, fnKey, W, H, history[i], i === cursor);
  }
}

