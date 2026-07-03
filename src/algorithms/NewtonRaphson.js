export function* newtonRaphson(fn, start, maxSteps = 40) {
  let x = start;

  for (let step = 0; step <= maxSteps; step++) {
    const fx = fn.f(x);
    const fpx = fn.fprime(x);

    yield { step, x, fx, fpx };

    if (Math.abs(fx) < 1e-6) return; // converged: found a root
    if (Math.abs(fpx) < 1e-8) return; // diverged: tangent went flat, division blows up

    const xNext = x - fx / fpx;
    if (!isFinite(xNext) || Math.abs(xNext) > 1e6) return; // diverged: shot off to infinity

    x = xNext;
  }
}
