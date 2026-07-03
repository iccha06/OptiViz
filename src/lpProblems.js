export const LP_PROBLEMS = {
  classic: {
    label: "max 3x + 5y",
    objective: { cx: 3, cy: 5 },
    constraints: [
      { a: 1, b: 0, rhs: 4, label: "x ≤ 4" },
      { a: 0, b: 2, rhs: 12, label: "2y ≤ 12" },
      { a: 3, b: 2, rhs: 18, label: "3x + 2y ≤ 18" },
    ],
    domain: { xMin: -0.5, xMax: 6.5, yMin: -0.5, yMax: 8 },
  },

  furniture: {
    label: "max 5x + 4y",
    objective: { cx: 5, cy: 4 },
    constraints: [
      { a: 6, b: 4, rhs: 24, label: "6x + 4y ≤ 24" },
      { a: 1, b: 2, rhs: 6, label: "x + 2y ≤ 6" },
    ],
    domain: { xMin: -0.5, xMax: 5, yMin: -0.5, yMax: 5 },
  },

  diet: {
    label: "max 2x + 3y",
    objective: { cx: 2, cy: 3 },
    constraints: [
      { a: 1, b: 1, rhs: 4, label: "x + y ≤ 4" },
      { a: 1, b: 2, rhs: 5, label: "x + 2y ≤ 5" },
      { a: 3, b: 1, rhs: 6, label: "3x + y ≤ 6" },
    ],
    domain: { xMin: -0.5, xMax: 5, yMin: -0.5, yMax: 5 },
  },
};

export function getLPProblem(key) {
  return LP_PROBLEMS[key];
}
