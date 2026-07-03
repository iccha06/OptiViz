export function* gradientDescent(surface, start, learningRate, maxSteps = 500) {
  let [x, y] = start;

  for (let step = 0; step <= maxSteps; step++) {
    const z = surface.f(x, y);
    const [gx, gy] = surface.grad(x, y);
    const gradNorm = Math.hypot(gx, gy);

    yield { step, x, y, z, gx, gy, gradNorm };

    if (gradNorm < 1e-4) return; // converged
    if (!isFinite(z) || Math.abs(x) > 1e6 || Math.abs(y) > 1e6) return; // diverged

    x = x - learningRate * gx;
    y = y - learningRate * gy;
  }
}
