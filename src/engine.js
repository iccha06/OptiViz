
export class Engine {
  /**
   * @param {Function} generatorFactory - () => Generator, called fresh on reset
   */
  constructor(generatorFactory) {
    this.generatorFactory = generatorFactory;
    this.history = [];
    this.cursor = -1;
    this.gen = null;
    this.finished = false;
    this.finishReason = null; // "converged" | "diverged" | null
    this._reset();
  }

  _reset() {
    this.history = [];
    this.cursor = -1;
    this.gen = this.generatorFactory();
    this.finished = false;
    this.finishReason = null;
  }

  reset(newGeneratorFactory) {
    if (newGeneratorFactory) this.generatorFactory = newGeneratorFactory;
    this._reset();
  }

  get currentState() {
    return this.cursor >= 0 ? this.history[this.cursor] : null;
  }

  /** Advance one step. Returns true if a new/buffered state was shown, false if already finished. */
  advance() {
    if (this.cursor < this.history.length - 1) {
      // replaying buffered steps (e.g. after stepping back) — no need to call gen again
      this.cursor++;
      return true;
    }
    if (this.finished) return false;

    const { value, done } = this.gen.next();
    if (done) {
      this.finished = true;
      const last = this.history[this.history.length - 1];
      this.finishReason = last && last.gradNorm < 1e-4 ? "converged" : "diverged";
      return false;
    }
    this.history.push(value);
    this.cursor++;
    return true;
  }

  stepBack() {
    if (this.cursor > 0) {
      this.cursor--;
      return true;
    }
    return false;
  }
}
