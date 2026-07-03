export function* newtonMethod2D(surface, start, maxSteps = 100) {
  let [x, y] = start;

  for (let step = 0; step <= maxSteps; step++) {
    const z = surface.f(x, y);
    const [gx, gy] = surface.grad(x, y);
    const gradNorm = Math.hypot(gx, gy);
    const [[a, b], [, d]] = surface.hessian(x, y); // Hessian is symmetric: H[0][1] === H[1][0]
    const det = a * d - b * b;

    let status = "running";
    let criticalPointType = null;

    if (gradNorm < 1e-4) {
      status = "converged";
      if (Math.abs(det) < 1e-8) criticalPointType = "degenerate";
      else if (det > 0) criticalPointType = a > 0 ? "minimum" : "maximum";
      else criticalPointType = "saddle";
    } else if (!isFinite(z) || Math.abs(x) > 1e6 || Math.abs(y) > 1e6 || Math.abs(det) < 1e-8) {
      status = "diverged";
    }

    yield { step, x, y, z, gx, gy, gradNorm, status, criticalPointType };

    if (status !== "running") return;

    // Newton step: solve H * delta = grad, i.e. delta = H^-1 * grad
    const invDet = 1 / det;
    const dx = invDet * (d * gx - b * gy);
    const dy = invDet * (-b * gx + a * gy);
    x = x - dx;
    y = y - dy;
  }
}
