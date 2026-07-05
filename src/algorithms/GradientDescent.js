export function* gradientDescent(surface, start, learningRate, maxSteps = 500) {
  let [x, y] = start;

  for (let step = 0; step <= maxSteps; step++) {
    const z = surface.f(x, y);
    const [gx, gy] = surface.grad(x, y);
    const gradNorm = Math.hypot(gx, gy);

    let status = "running";
    if (gradNorm < 1e-4) status = "converged";
    else if (!isFinite(z) || Math.abs(x) > 1e6 || Math.abs(y) > 1e6) status = "diverged";

    yield { step, x, y, z, gx, gy, gradNorm, status };

    if (status !== "running") return;

    x = x - learningRate * gx;
    y = y - learningRate * gy;
  }
}