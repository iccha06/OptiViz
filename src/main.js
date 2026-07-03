import { SURFACES, getSurface } from "./surfaces.js";
import { FUNCTIONS_1D, getFunction1D } from "./functions1d.js";
import { LP_PROBLEMS, getLPProblem } from "./lpProblems.js";
import { gradientDescent } from "./algorithms/gradientDescent.js";
import { newtonRaphson } from "./algorithms/newtonRaphson.js";
import { newtonMethod2D } from "./algorithms/newtonMethod2D.js";
import { simplex } from "./algorithms/simplex.js";
import { Engine } from "./engine.js";
import {
  renderFrame, invalidateContourCache,
  renderFrame1D, invalidateCurveCache,
  renderFrameLP,
  renderFrameCompare, renderFrameCompareConvergence,
} from "./render.js";


const ALGORITHMS = {
  gradientDescent: {
    label: "Gradient Descent",
    mode: "2d",
    makeGenerator: (surface, start, params) =>
      gradientDescent(surface, start, params.learningRate),
  },
  newtonMethod2D: {
    label: "Newton's Method (2D)",
    mode: "2d",
    makeGenerator: (surface, start) => newtonMethod2D(surface, start),
  },
  newtonRaphson: {
    label: "Newton-Raphson (1D root-finding)",
    mode: "1d",
    makeGenerator: (fn, start) => newtonRaphson(fn, start),
  },
  simplex: {
    label: "Simplex Method",
    mode: "lp",
    makeGenerator: (problem) => simplex(problem),
  },
};

/* ---- app state ---- */
let algorithmKey = "gradientDescent";

// 2D (gradient descent / newton 2D) state
let surfaceKey = "bowl";
let learningRate = 0.1;
let startPoint = SURFACES[surfaceKey].defaultStart;

// 1D (Newton-Raphson) state
let fnKey = "cubic";
let startX = FUNCTIONS_1D[fnKey].defaultStart;

// LP (Simplex) state
let lpKey = "classic";

// Compare mode state
let compareSurfaceKey = "bowl";
let compareStartPoint = SURFACES[compareSurfaceKey].defaultStart;
let compareAAlgo = "gradientDescent";
let compareBAlgo = "newtonMethod2D";
let compareALR = 0.1;
let compareBLR = 0.1;
let engineA = null, engineB = null;
let compareAReported = false, compareBReported = false;
let compareView = "trace"; // "trace" | "convergence"

let speed = 5;
let engine = null;
let playing = false;
let playTimer = null;

const canvas = document.getElementById("plot");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

/* ---- DOM refs ---- */
const el = {
  algoSelect: document.getElementById("algo-select"),
  readoutRow: document.getElementById("readout-row"),

  gdControls: document.getElementById("gd-controls"),
  fnSelect: document.getElementById("fn-select"),
  lrSlider: document.getElementById("lr-slider"),
  lrVal: document.getElementById("lr-val"),

  newtonControls: document.getElementById("newton-controls"),
  fn1dSelect: document.getElementById("fn1d-select"),

  lpControls: document.getElementById("lp-controls"),
  lpSelect: document.getElementById("lp-select"),

  compareControls: document.getElementById("compare-controls"),
  compareFnSelect: document.getElementById("compare-fn-select"),
  compareAAlgoSelect: document.getElementById("compare-a-algo"),
  compareALRGroup: document.getElementById("compare-a-lr-group"),
  compareALRSlider: document.getElementById("compare-a-lr-slider"),
  compareALRVal: document.getElementById("compare-a-lr-val"),
  compareBAlgoSelect: document.getElementById("compare-b-algo"),
  compareBLRGroup: document.getElementById("compare-b-lr-group"),
  compareBLRSlider: document.getElementById("compare-b-lr-slider"),
  compareBLRVal: document.getElementById("compare-b-lr-val"),

  viewTraceBtn: document.getElementById("view-trace-btn"),
  viewConvergenceBtn: document.getElementById("view-convergence-btn"),

  convergencePanel: document.getElementById("convergence-panel"),
  convALabel: document.getElementById("conv-a-label"),
  convAIters: document.getElementById("conv-a-iters"),
  convAFinal: document.getElementById("conv-a-final"),
  convAOrder: document.getElementById("conv-a-order"),
  convBLabel: document.getElementById("conv-b-label"),
  convBIters: document.getElementById("conv-b-iters"),
  convBFinal: document.getElementById("conv-b-final"),
  convBOrder: document.getElementById("conv-b-order"),

  compareStats: document.getElementById("compare-stats"),
  compareALabel: document.getElementById("compare-a-label"),
  compareAStep: document.getElementById("compare-a-step"),
  compareAVal: document.getElementById("compare-a-val"),
  compareAGrad: document.getElementById("compare-a-grad"),
  compareAStatus: document.getElementById("compare-a-status"),
  compareBLabel: document.getElementById("compare-b-label"),
  compareBStep: document.getElementById("compare-b-step"),
  compareBVal: document.getElementById("compare-b-val"),
  compareBGrad: document.getElementById("compare-b-grad"),
  compareBStatus: document.getElementById("compare-b-status"),

  raceResult: document.getElementById("race-result"),
  raceWinner: document.getElementById("race-winner"),
  raceGrid: document.getElementById("race-grid"),

  speedSlider: document.getElementById("speed-slider"),
  speedVal: document.getElementById("speed-val"),
  btnPlay: document.getElementById("btn-play"),
  btnStep: document.getElementById("btn-step"),
  btnBack: document.getElementById("btn-back"),
  btnReset: document.getElementById("btn-reset"),
  status: document.getElementById("status"),

  readoutValLabel: document.getElementById("readout-val-label"),
  step: document.getElementById("readout-step"),
  val: document.getElementById("readout-val"),
  grad: document.getElementById("readout-grad"),
  gradWrap: document.getElementById("readout-grad-wrap"),

  canvasCaption: document.getElementById("canvas-caption"),
};

function currentMode() {
  return algorithmKey === "compare" ? "compare" : ALGORITHMS[algorithmKey].mode;
}
function currentAlgo() { return ALGORITHMS[algorithmKey]; }
function currentSurface() { return getSurface(surfaceKey); }
function currentFn1D() { return getFunction1D(fnKey); }
function currentLPProblem() { return getLPProblem(lpKey); }
function currentCompareSurface() { return getSurface(compareSurfaceKey); }

const ALGO_LABELS = Object.fromEntries(Object.entries(ALGORITHMS).map(([k, v]) => [k, v.label]));

/* ---- single-engine modes (2d / 1d / lp) ---- */

function buildEngine() {
  const algo = currentAlgo();
  if (algo.mode === "2d") {
    return new Engine(() =>
      algo.makeGenerator(currentSurface(), startPoint, { learningRate })
    );
  }
  if (algo.mode === "1d") {
    return new Engine(() => algo.makeGenerator(currentFn1D(), startX));
  }
  return new Engine(() => algo.makeGenerator(currentLPProblem()));
}

function renderSingle() {
  const algo = currentAlgo();
  if (algo.mode === "2d") {
    renderFrame(ctx, currentSurface(), surfaceKey, W, H, {
      history: engine.history,
      cursor: engine.cursor,
      startPoint,
    });
  } else if (algo.mode === "1d") {
    renderFrame1D(ctx, currentFn1D(), fnKey, W, H, {
      history: engine.history,
      cursor: engine.cursor,
      startX,
    });
  } else {
    renderFrameLP(ctx, currentLPProblem(), W, H, {
      history: engine.history,
      cursor: engine.cursor,
    });
  }
}

function updateReadoutSingle() {
  const algo = currentAlgo();
  const s = engine.currentState;

  if (algo.mode === "2d") {
    el.readoutValLabel.textContent = "f(x, y) =";
    el.gradWrap.style.display = "";
    el.step.textContent = s ? s.step : "0";
    el.val.textContent = s ? s.z.toFixed(4) : "—";
    el.grad.textContent = s ? s.gradNorm.toFixed(4) : "—";
  } else if (algo.mode === "1d") {
    el.readoutValLabel.textContent = "f(x) =";
    el.gradWrap.style.display = "none";
    el.step.textContent = s ? s.step : "0";
    el.val.textContent = s ? s.fx.toFixed(6) : "—";
  } else {
    el.readoutValLabel.textContent = "z =";
    el.gradWrap.style.display = "none";
    el.step.textContent = s ? s.step : "0";
    el.val.textContent = s ? s.objectiveValue.toFixed(3) : "—";
  }
}

/* ---- compare mode ---- */

function buildCompareEngines() {
  engineA = new Engine(() =>
    ALGORITHMS[compareAAlgo].makeGenerator(currentCompareSurface(), compareStartPoint, { learningRate: compareALR })
  );
  engineB = new Engine(() =>
    ALGORITHMS[compareBAlgo].makeGenerator(currentCompareSurface(), compareStartPoint, { learningRate: compareBLR })
  );
  compareAReported = false;
  compareBReported = false;
  el.raceResult.style.display = "none";
}

function renderCompare() {
  if (compareView === "convergence") {
    renderFrameCompareConvergence(ctx, W, H, {
      historyA: engineA.history, cursorA: engineA.cursor,
      historyB: engineB.history, cursorB: engineB.cursor,
      labelA: ALGO_LABELS[compareAAlgo], labelB: ALGO_LABELS[compareBAlgo],
    });
    updateConvergencePanel();
    return;
  }
  renderFrameCompare(ctx, currentCompareSurface(), compareSurfaceKey, W, H, {
    historyA: engineA.history, cursorA: engineA.cursor,
    historyB: engineB.history, cursorB: engineB.cursor,
    startPoint: compareStartPoint,
  });
}

function setCompareView(view) {
  compareView = view;
  el.viewTraceBtn.classList.toggle("active", view === "trace");
  el.viewConvergenceBtn.classList.toggle("active", view === "convergence");
  el.convergencePanel.style.display = view === "convergence" ? "flex" : "none";
  el.canvasCaption.textContent = view === "convergence"
    ? "‖∇f‖ vs iteration, log scale · a straight line = linear convergence, a cliff = quadratic"
    : "click surface to place shared start · orange = Run A, violet = Run B";
  render();
}


function formatMetric(v) {
  if (v === undefined || v === null || Number.isNaN(v)) return "—";
  if (v === 0) return "0";
  const abs = Math.abs(v);
  if (abs < 1e-6) return v.toExponential(2);
  if (abs < 1) return v.toFixed(9).replace(/0+$/, "").replace(/\.$/, "");
  if (abs < 1000) return v.toFixed(4);
  return v.toExponential(3);
}


function estimateConvergenceOrder(errors) {
  const tail = errors.filter((e) => e > 1e-14);
  if (tail.length < 4) return null;
  const [e0, e1, e2] = tail.slice(-3);
  if (!(e0 > e1 && e1 > e2)) return null;
  const p = Math.log(e2 / e1) / Math.log(e1 / e0);
  if (!isFinite(p) || p <= 0) return null;
  return p;
}

function convergenceOrderLabel(p) {
  if (p === null) return "—";
  if (p < 1.2) return "Linear";
  if (p < 1.8) return "Superlinear";
  return "Quadratic";
}

/** Fills in the "underneath the graph" metrics panel shown in Convergence Rate view. */
function updateConvergencePanel() {
  const seriesA = engineA.cursor >= 0 ? engineA.history.slice(0, engineA.cursor + 1).map((s) => s.gradNorm) : [];
  const seriesB = engineB.cursor >= 0 ? engineB.history.slice(0, engineB.cursor + 1).map((s) => s.gradNorm) : [];

  el.convALabel.textContent = ALGO_LABELS[compareAAlgo];
  el.convBLabel.textContent = ALGO_LABELS[compareBAlgo];

  el.convAIters.textContent = engineA.cursor >= 0 ? engineA.cursor : "0";
  el.convBIters.textContent = engineB.cursor >= 0 ? engineB.cursor : "0";

  el.convAFinal.textContent = seriesA.length ? formatMetric(seriesA[seriesA.length - 1]) : "—";
  el.convBFinal.textContent = seriesB.length ? formatMetric(seriesB[seriesB.length - 1]) : "—";

  el.convAOrder.textContent = convergenceOrderLabel(estimateConvergenceOrder(seriesA));
  el.convBOrder.textContent = convergenceOrderLabel(estimateConvergenceOrder(seriesB));
}

/** Human-readable status text for one side of a compare run (used in the metrics table). */
function compareStatusText(engineRef) {
  if (!engineRef.finished) return "Running";
  if (engineRef.finishReason === "converged") {
    const last = engineRef.history[engineRef.history.length - 1];
    const note = last.criticalPointType && last.criticalPointType !== "minimum"
      ? ` (${last.criticalPointType})`
      : "";
    return `Converged${note}`;
  }
  return "Diverged";
}

function updateCompareStats() {
  const sA = engineA.currentState, sB = engineB.currentState;
  el.compareALabel.textContent = ALGO_LABELS[compareAAlgo];
  el.compareBLabel.textContent = ALGO_LABELS[compareBAlgo];

  el.compareAStep.textContent = sA ? sA.step : "0";
  el.compareBStep.textContent = sB ? sB.step : "0";

  el.compareAVal.textContent = sA ? formatMetric(sA.z) : "—";
  el.compareBVal.textContent = sB ? formatMetric(sB.z) : "—";

  el.compareAGrad.textContent = sA ? formatMetric(sA.gradNorm) : "—";
  el.compareBGrad.textContent = sB ? formatMetric(sB.gradNorm) : "—";

  el.compareAStatus.textContent = compareStatusText(engineA);
  el.compareBStatus.textContent = compareStatusText(engineB);
  el.compareAStatus.className = "metric-status" +
    (engineA.finished ? (engineA.finishReason === "converged" ? " ok" : " bad") : "");
  el.compareBStatus.className = "metric-status" +
    (engineB.finished ? (engineB.finishReason === "converged" ? " ok" : " bad") : "");
}

/** Shows the 🏁 Race Finished banner once both runs have stopped. */
function renderRaceResult() {
  const stepsA = engineA.history.length - 1;
  const stepsB = engineB.history.length - 1;
  const aOk = engineA.finishReason === "converged";
  const bOk = engineB.finishReason === "converged";
  const labelA = ALGO_LABELS[compareAAlgo];
  const labelB = ALGO_LABELS[compareBAlgo];

  let winner; // "A" | "B" | "tie" | "none"
  if (aOk && bOk) winner = stepsA < stepsB ? "A" : stepsB < stepsA ? "B" : "tie";
  else if (aOk && !bOk) winner = "A";
  else if (bOk && !aOk) winner = "B";
  else winner = "none";

  if (winner === "A") el.raceWinner.textContent = `Winner: ${labelA}`;
  else if (winner === "B") el.raceWinner.textContent = `Winner: ${labelB}`;
  else if (winner === "tie") el.raceWinner.textContent = `Tie — both converged in ${stepsA} steps`;
  else el.raceWinner.textContent = "No winner — neither run converged";

  let speedupHtml = "";
  if (winner === "A" || winner === "B") {
    const winnerSteps = winner === "A" ? stepsA : stepsB;
    const loserSteps = winner === "A" ? stepsB : stepsA;
    if (winnerSteps > 0 && loserSteps > 0) {
      const speedup = loserSteps / winnerSteps;
      const speedupStr = speedup >= 10 ? Math.round(speedup) : speedup.toFixed(1);
      speedupHtml = `<div class="race-speedup">Speedup : ${speedupStr}×</div>`;
    }
  }

  el.raceGrid.innerHTML = `
    <div class="race-col">
      <div class="race-col-label"><span class="dot orange"></span>${labelA}</div>
      <div class="race-col-stat">Iterations : <b>${stepsA}</b></div>
    </div>
    <div class="race-col">
      <div class="race-col-label"><span class="dot violet"></span>${labelB}</div>
      <div class="race-col-stat">Iterations : <b>${stepsB}</b></div>
    </div>
    ${speedupHtml}
  `;
  el.raceResult.style.display = "";
}

/** Advances both engines one tick each. Returns true if either is still running. */
function advanceCompare() {
  if (!engineA.finished) engineA.advance();
  if (!engineB.finished) engineB.advance();

  renderCompare();
  updateCompareStats();

  if (engineA.finished && !compareAReported) compareAReported = true;
  if (engineB.finished && !compareBReported) compareBReported = true;

  const bothDone = engineA.finished && engineB.finished;
  if (bothDone) {
    const stepsA = engineA.history.length - 1;
    const stepsB = engineB.history.length - 1;
    const aOk = engineA.finishReason === "converged";
    const bOk = engineB.finishReason === "converged";

    if (aOk && bOk) {
      if (stepsA < stepsB) setStatus(`Run A (${ALGO_LABELS[compareAAlgo]}) converged first — ${stepsA} steps vs ${stepsB}.`, "converged");
      else if (stepsB < stepsA) setStatus(`Run B (${ALGO_LABELS[compareBAlgo]}) converged first — ${stepsB} steps vs ${stepsA}.`, "converged");
      else setStatus(`Both runs converged in ${stepsA} steps — a tie.`, "converged");
    } else if (aOk && !bOk) {
      setStatus(`Run A converged in ${stepsA} steps; Run B diverged.`, "converged");
    } else if (bOk && !aOk) {
      setStatus(`Run B converged in ${stepsB} steps; Run A diverged.`, "converged");
    } else {
      setStatus("Neither run converged — try a smaller learning rate or a different surface.", "diverged");
    }
    renderRaceResult();
    stopPlaying();
  }
  return !bothDone;
}

function stepBackCompare() {
  const movedA = engineA.stepBack();
  const movedB = engineB.stepBack();
  renderCompare();
  updateCompareStats();
  el.raceResult.style.display = "none";
  if (movedA || movedB) setStatus("Stepped back.");
}

/* ---- shared dispatch ---- */

function render() {
  if (algorithmKey === "compare") {
    renderCompare();
    updateCompareStats();
  } else {
    renderSingle();
    updateReadoutSingle();
  }
}

function setStatus(text, cls = "") {
  el.status.textContent = text;
  el.status.className = "status-line" + (cls ? " " + cls : "");
}

function syncControlVisibility() {
  const mode = currentMode();
  el.gdControls.style.display = mode === "2d" ? "" : "none";
  el.newtonControls.style.display = mode === "1d" ? "" : "none";
  el.lpControls.style.display = mode === "lp" ? "" : "none";
  el.compareControls.style.display = mode === "compare" ? "" : "none";
  el.compareStats.style.display = mode === "compare" ? "" : "none";
  el.readoutRow.style.display = mode === "compare" ? "none" : "";
  el.convergencePanel.style.display = (mode === "compare" && compareView === "convergence") ? "flex" : "none";

  if (mode === "2d") {
    el.canvasCaption.textContent = "click surface to place start · contour lines = equal elevation";
  } else if (mode === "1d") {
    el.canvasCaption.textContent = "click curve to set starting guess x₀ · dashed line = current tangent";
  } else if (mode === "lp") {
    el.canvasCaption.textContent = "shaded region = feasible set · arrow = direction that increases z";
  } else {
    el.canvasCaption.textContent = compareView === "convergence"
      ? "‖∇f‖ vs iteration, log scale · a straight line = linear convergence, a cliff = quadratic"
      : "click surface to place shared start · orange = Run A, violet = Run B";
  }
}

function resetRun() {
  const mode = currentMode();
  if (mode === "compare") {
    buildCompareEngines();
    setStatus("Ready. Both runs start from the same point — press Step or Run to race them.");
    render();
    return;
  }
  engine = buildEngine();
  if (mode === "2d") {
    setStatus("Ready. Press Step or Run.");
  } else if (mode === "1d") {
    setStatus("Ready. Press Step or Run — watch the tangent line walk toward a root.");
  } else {
    setStatus("Ready. Simplex always starts at the origin — press Step or Run to pivot toward the optimum.");
  }
  render();
}

function advance() {
  const ok = engine.advance();
  const algo = currentAlgo();

  if (ok && algo.mode === "lp") {
    const s = engine.currentState;
    if (s.enteringVar && s.leavingVar) {
      setStatus(`Pivot ${s.step}: ${s.enteringVar} enters, ${s.leavingVar} leaves the basis. z = ${s.objectiveValue.toFixed(3)}`);
    }
  }

  if (!ok && engine.finished) {
    const last = engine.history[engine.history.length - 1];
    if (engine.finishReason === "converged") {
      const msg = algo.mode === "2d"
        ? `Converged at step ${last.step} — ‖∇f‖ ≈ 0${last.criticalPointType && last.criticalPointType !== "minimum" ? ` (this is a ${last.criticalPointType}, not a minimum!)` : ""}`
        : algo.mode === "1d"
        ? `Converged at step ${last.step} — found a root near x ≈ ${last.x.toFixed(6)}`
        : `Optimal reached — z = ${last.objectiveValue.toFixed(3)} at (${last.x.toFixed(3)}, ${last.y.toFixed(3)})`;
      setStatus(msg, "converged");
    } else {
      const msg = algo.mode === "2d"
        ? `Diverged — values blew up after step ${last ? last.step : 0}`
        : algo.mode === "1d"
        ? `Diverged — tangent went flat or shot off to infinity after step ${last ? last.step : 0}`
        : `Unbounded — ${last.enteringVar} can grow forever without leaving the feasible region`;
      setStatus(msg, "diverged");
    }
    stopPlaying();
  }
  render();
  return ok;
}

function stepForward() {
  return algorithmKey === "compare" ? advanceCompare() : advance();
}

function stopPlaying() {
  playing = false;
  clearInterval(playTimer);
  el.btnPlay.textContent = "Run";
}

function startPlaying() {
  playing = true;
  el.btnPlay.textContent = "Pause";
  playTimer = setInterval(() => {
    const ok = stepForward();
    if (!ok) stopPlaying();
  }, Math.max(15, 220 - speed * 10));
}

/* ---- wiring: algorithm switch ---- */
el.algoSelect.addEventListener("change", (e) => {
  algorithmKey = e.target.value;
  stopPlaying();
  syncControlVisibility();
  resetRun();
});

/* ---- wiring: gradient descent / newton 2D controls ---- */
el.fnSelect.addEventListener("change", (e) => {
  surfaceKey = e.target.value;
  invalidateContourCache();
  stopPlaying();
  startPoint = currentSurface().defaultStart;
  resetRun();
});

el.lrSlider.addEventListener("input", (e) => {
  learningRate = parseFloat(e.target.value);
  el.lrVal.textContent = learningRate.toFixed(3);
  stopPlaying();
  resetRun();
});

/* ---- wiring: newton-raphson controls ---- */
el.fn1dSelect.addEventListener("change", (e) => {
  fnKey = e.target.value;
  invalidateCurveCache();
  stopPlaying();
  startX = currentFn1D().defaultStart;
  resetRun();
});

/* ---- wiring: simplex controls ---- */
el.lpSelect.addEventListener("change", (e) => {
  lpKey = e.target.value;
  stopPlaying();
  resetRun();
});

/* ---- wiring: compare controls ---- */
el.compareFnSelect.addEventListener("change", (e) => {
  compareSurfaceKey = e.target.value;
  invalidateContourCache();
  stopPlaying();
  compareStartPoint = currentCompareSurface().defaultStart;
  resetRun();
});

function syncCompareLRVisibility() {
  el.compareALRGroup.style.display = compareAAlgo === "gradientDescent" ? "" : "none";
  el.compareBLRGroup.style.display = compareBAlgo === "gradientDescent" ? "" : "none";
}

el.compareAAlgoSelect.addEventListener("change", (e) => {
  compareAAlgo = e.target.value;
  syncCompareLRVisibility();
  stopPlaying();
  resetRun();
});

el.compareBAlgoSelect.addEventListener("change", (e) => {
  compareBAlgo = e.target.value;
  syncCompareLRVisibility();
  stopPlaying();
  resetRun();
});

el.compareALRSlider.addEventListener("input", (e) => {
  compareALR = parseFloat(e.target.value);
  el.compareALRVal.textContent = compareALR.toFixed(3);
  stopPlaying();
  resetRun();
});

el.compareBLRSlider.addEventListener("input", (e) => {
  compareBLR = parseFloat(e.target.value);
  el.compareBLRVal.textContent = compareBLR.toFixed(3);
  stopPlaying();
  resetRun();
});

el.viewTraceBtn.addEventListener("click", () => setCompareView("trace"));
el.viewConvergenceBtn.addEventListener("click", () => setCompareView("convergence"));

/* ---- wiring: shared controls ---- */
el.speedSlider.addEventListener("input", (e) => {
  speed = parseInt(e.target.value, 10);
  el.speedVal.textContent = speed;
  if (playing) { stopPlaying(); startPlaying(); }
});

el.btnPlay.addEventListener("click", () => {
  if (playing) stopPlaying(); else startPlaying();
});

el.btnStep.addEventListener("click", () => {
  stopPlaying();
  stepForward();
  if (algorithmKey !== "compare") {
    const s = engine.currentState;
    if (s) setStatus(`Stepped to iteration ${s.step}.`);
  }
});

el.btnBack.addEventListener("click", () => {
  stopPlaying();
  if (algorithmKey === "compare") {
    stepBackCompare();
  } else if (engine.stepBack()) {
    render();
    setStatus(`Stepped back to iteration ${engine.currentState.step}.`);
  }
});

el.btnReset.addEventListener("click", () => {
  stopPlaying();
  resetRun();
});

canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const sx = (e.clientX - rect.left) * (W / rect.width);
  const sy = (e.clientY - rect.top) * (H / rect.height);

  stopPlaying();
  const mode = currentMode();

  if (mode === "2d") {
    const surface = currentSurface();
    const d = surface.domain;
    const x = d.xMin + (sx / W) * (d.xMax - d.xMin);
    const y = d.yMin + ((H - sy) / H) * (d.yMax - d.yMin);
    startPoint = [x, y];
    resetRun();
    setStatus(`Start point set to (${x.toFixed(2)}, ${y.toFixed(2)}).`);
  } else if (mode === "1d") {
    const fn = currentFn1D();
    const d = fn.domain;
    const x = d.xMin + (sx / W) * (d.xMax - d.xMin);
    startX = x;
    resetRun();
    setStatus(`Starting guess set to x₀ = ${x.toFixed(3)}.`);
  } else if (mode === "lp") {
    setStatus("Simplex always starts at the origin — it's the initial basic feasible solution.");
  } else if (compareView === "convergence") {
    setStatus("Switch to the Trace view to set a starting point by clicking.");
  } else {
    const surface = currentCompareSurface();
    const d = surface.domain;
    const x = d.xMin + (sx / W) * (d.xMax - d.xMin);
    const y = d.yMin + ((H - sy) / H) * (d.yMax - d.yMin);
    compareStartPoint = [x, y];
    resetRun();
    setStatus(`Shared start point set to (${x.toFixed(2)}, ${y.toFixed(2)}).`);
  }
});

/* ---- init ---- */
syncControlVisibility();
syncCompareLRVisibility();
resetRun();
