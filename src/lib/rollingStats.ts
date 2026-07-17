export class RollingStats {
  private mean = 0;
  private variance = 0;
  private count = 0;

  update(value: number) {
    this.count++;
    const delta = value - this.mean;
    this.mean += delta / this.count;
    const delta2 = value - this.mean;
    this.variance += delta * delta2;
  }

  get stdDev() {
    return this.count > 1 ? Math.sqrt(this.variance / (this.count - 1)) : 0;
  }

  get average() { return this.mean; }
  get size() { return this.count; }
}
