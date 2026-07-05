export function* newtonRaphson(fn, start, maxSteps = 40) {
  let x = start;

  for (let step = 0; step <= maxSteps; step++) {
    const fx = fn.f(x);
    const fpx = fn.fprime(x);

    let status = "running";
    if (Math.abs(fx) < 1e-6) status = "converged";
    else if (!isFinite(fx) || !isFinite(fpx) || Math.abs(fpx) < 1e-8 || Math.abs(x) > 1e6) status = "diverged";

    yield { step, x, fx, fpx, status };

    if (status !== "running") return;

    x = x - fx / fpx;
  }
}
