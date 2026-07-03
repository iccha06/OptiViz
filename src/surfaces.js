
export const SURFACES = {
  bowl: {
    label: "Bowl — x² + y²",
    domain: { xMin: -3, xMax: 3, yMin: -3, yMax: 3 },
    defaultStart: [2.2, 2.2],
    f: (x, y) => x * x + y * y,
    grad: (x, y) => [2 * x, 2 * y],
    hessian: (x, y) => [[2, 0], [0, 2]],
  },

  saddle: {
    label: "Saddle — x² − y²",
    domain: { xMin: -3, xMax: 3, yMin: -3, yMax: 3 },
    defaultStart: [2.2, 0.3],
    f: (x, y) => x * x - y * y,
    grad: (x, y) => [2 * x, -2 * y],
    hessian: (x, y) => [[2, 0], [0, -2]],
  },

  rosenbrock: {
    label: "Rosenbrock valley",
    domain: { xMin: -2, xMax: 2, yMin: -1, yMax: 3 },
    defaultStart: [-1.2, 1.5],
    f: (x, y) => (1 - x) ** 2 + 100 * (y - x * x) ** 2,
    grad: (x, y) => [
      -2 * (1 - x) - 400 * x * (y - x * x),
      200 * (y - x * x),
    ],
    // fx = -2 + 2x - 400xy + 400x^3
    // fxx = 2 - 400y + 1200x^2, fxy = -400x, fyy = 200
    hessian: (x, y) => [
      [2 - 400 * y + 1200 * x * x, -400 * x],
      [-400 * x, 200],
    ],
  },
};

export function getSurface(key) {
  return SURFACES[key];
}

