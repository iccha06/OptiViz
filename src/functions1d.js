export const FUNCTIONS_1D = {
  cubic: {
    label: "x³ − x − 2",
    domain: { xMin: -3, xMax: 3 },
    defaultStart: 2.5,
    f: (x) => x ** 3 - x - 2,
    fprime: (x) => 3 * x * x - 1,
  },

  cosMinusX: {
    label: "cos(x) − x",
    domain: { xMin: -2, xMax: 2 },
    defaultStart: 1,
    f: (x) => Math.cos(x) - x,
    fprime: (x) => -Math.sin(x) - 1,
  },

  quintic: {
    label: "x⁵ − 3x + 1  (flat-tangent trap)",
    domain: { xMin: -2, xMax: 2 },
    defaultStart: -1.3,
    f: (x) => x ** 5 - 3 * x + 1,
    fprime: (x) => 5 * x ** 4 - 3,
  },
};

export function getFunction1D(key) {
  return FUNCTIONS_1D[key];
}

