export function withNonNegativity(constraints) {
  return [
    ...constraints,
    { a: -1, b: 0, rhs: 0, label: "x ≥ 0" },
    { a: 0, b: -1, rhs: 0, label: "y ≥ 0" },
  ];
}

/** Computes feasible-region polygon vertices, ordered for drawing (angle around centroid). */
export function computeFeasibleRegion(structuralConstraints) {
  const constraints = withNonNegativity(structuralConstraints);
  const eps = 1e-6;
  const candidates = [];

  for (let i = 0; i < constraints.length; i++) {
    for (let j = i + 1; j < constraints.length; j++) {
      const c1 = constraints[i], c2 = constraints[j];
      const det = c1.a * c2.b - c2.a * c1.b;
      if (Math.abs(det) < 1e-9) continue; // parallel boundary lines, no intersection

      const x = (c1.rhs * c2.b - c2.rhs * c1.b) / det;
      const y = (c1.a * c2.rhs - c2.a * c1.rhs) / det;

      const feasible = constraints.every((c) => c.a * x + c.b * y <= c.rhs + eps);
      if (feasible) candidates.push([x, y]);
    }
  }

  // dedupe near-identical points (multiple constraint pairs can hit the same vertex)
  const vertices = [];
  for (const p of candidates) {
    const dup = vertices.some((q) => Math.abs(q[0] - p[0]) < 1e-6 && Math.abs(q[1] - p[1]) < 1e-6);
    if (!dup) vertices.push(p);
  }

  // order around the centroid so the polygon draws correctly (not self-intersecting)
  const cx = vertices.reduce((s, p) => s + p[0], 0) / vertices.length;
  const cy = vertices.reduce((s, p) => s + p[1], 0) / vertices.length;
  vertices.sort((p, q) => Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(q[1] - cy, q[0] - cx));

  return vertices;
}
