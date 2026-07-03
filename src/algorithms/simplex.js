export function* simplex(problem, maxSteps = 20) {
  const { objective, constraints } = problem;
  const m = constraints.length;
  const numVars = 2 + m; // x, y, s1..sm

  const rows = constraints.map((c, i) => {
    const row = new Array(numVars + 1).fill(0);
    row[0] = c.a;
    row[1] = c.b;
    row[2 + i] = 1; // this constraint's own slack variable
    row[numVars] = c.rhs;
    return row;
  });

  const objRow = new Array(numVars + 1).fill(0);
  objRow[0] = -objective.cx;
  objRow[1] = -objective.cy;
  // objRow[numVars] (z) starts at 0

  let basicVars = constraints.map((_, i) => 2 + i); // initial BFS: all slacks basic

  function varName(idx) {
    if (idx === 0) return "x";
    if (idx === 1) return "y";
    return `s${idx - 1}`;
  }

  function extractPoint() {
    let x = 0, y = 0;
    for (let i = 0; i < m; i++) {
      if (basicVars[i] === 0) x = rows[i][numVars];
      if (basicVars[i] === 1) y = rows[i][numVars];
    }
    return [x, y];
  }

  function pivot(pivotRowIdx, pivotColIdx) {
    const pivotRow = rows[pivotRowIdx];
    const pivotVal = pivotRow[pivotColIdx];
    for (let j = 0; j <= numVars; j++) pivotRow[j] /= pivotVal;

    for (let i = 0; i < rows.length; i++) {
      if (i === pivotRowIdx) continue;
      const factor = rows[i][pivotColIdx];
      if (factor === 0) continue;
      for (let j = 0; j <= numVars; j++) rows[i][j] -= factor * pivotRow[j];
    }

    const factor = objRow[pivotColIdx];
    if (factor !== 0) {
      for (let j = 0; j <= numVars; j++) objRow[j] -= factor * pivotRow[j];
    }
  }

  let [x, y] = extractPoint();
  let step = 0;
  yield {
    step, x, y,
    objectiveValue: objRow[numVars],
    basicVars: basicVars.slice(),
    enteringVar: null,
    leavingVar: null,
    status: "running",
  };

  for (step = 1; step <= maxSteps; step++) {
    // Dantzig's rule: entering variable is the most negative objective-row coefficient
    let entering = -1, mostNeg = -1e-9;
    for (let j = 0; j < numVars; j++) {
      if (objRow[j] < mostNeg) { mostNeg = objRow[j]; entering = j; }
    }

    if (entering === -1) {
      // no negative coefficients left: current vertex is optimal
      [x, y] = extractPoint();
      yield {
        step: step - 1, x, y,
        objectiveValue: objRow[numVars],
        basicVars: basicVars.slice(),
        enteringVar: null,
        leavingVar: null,
        status: "converged",
      };
      return;
    }

    // minimum ratio test picks the leaving variable (keeps all RHS values >= 0)
    let leaving = -1, minRatio = Infinity;
    for (let i = 0; i < m; i++) {
      if (rows[i][entering] > 1e-9) {
        const ratio = rows[i][numVars] / rows[i][entering];
        if (ratio < minRatio - 1e-9) { minRatio = ratio; leaving = i; }
      }
    }

    if (leaving === -1) {
      // entering variable can grow forever without violating any constraint
      yield {
        step, x, y,
        objectiveValue: objRow[numVars],
        basicVars: basicVars.slice(),
        enteringVar: varName(entering),
        leavingVar: null,
        status: "diverged",
      };
      return;
    }

    const enteringName = varName(entering);
    const leavingName = varName(basicVars[leaving]);
    pivot(leaving, entering);
    basicVars[leaving] = entering;

    [x, y] = extractPoint();
    yield {
      step, x, y,
      objectiveValue: objRow[numVars],
      basicVars: basicVars.slice(),
      enteringVar: enteringName,
      leavingVar: leavingName,
      status: "running",
    };
  }
}
