import re

with open('src/lib/dream-engine.ts', 'r') as f:
    content = f.read()

old_stats = '''const statsStore: Map<string, RollingStats> = new Map();

function updateStatsAndDetect(_: string, metrics: Record<string, number>): string[] {
  const anomalies: string[] = [];
  for (const [key, value] of Object.entries(metrics)) {
    if (!statsStore.has(key)) statsStore.set(key, new RollingStats());
    const stat = statsStore.get(key)!;
    stat.update(value);
    if (stat.size > 10) {
      const z = Math.abs((value - stat.average) / stat.stdDev);
      if (z > 2.5) anomalies.push(key);
    }
  }
  return anomalies;
}'''

new_stats = '''class EWMAMonitor {
  private alpha: number;
  private ewma: number | null = null;
  private ewmaVariance: number | null = null;

  constructor(alpha: number = 0.3) { this.alpha = alpha; }

  update(value: number) {
    if (this.ewma === null) {
      this.ewma = value;
      this.ewmaVariance = 0;
    } else {
      const diff = value - this.ewma;
      this.ewma = this.alpha * value + (1 - this.alpha) * this.ewma;
      this.ewmaVariance = (1 - this.alpha) * (this.ewmaVariance || 0) + this.alpha * diff * diff;
    }
    const stdDev = Math.sqrt(this.ewmaVariance || 0);
    return { ewma: this.ewma, upperBound: this.ewma + 3 * stdDev, lowerBound: this.ewma - 3 * stdDev };
  }

  isAnomalous(value: number): boolean {
    const bounds = this.update(value);
    // Ignore early checks before variance stabilizes
    if (this.ewmaVariance === 0) return false;
    return value > bounds.upperBound || value < bounds.lowerBound;
  }
}

const statsStore: Map<string, EWMAMonitor> = new Map();

function updateStatsAndDetect(_: string, metrics: Record<string, number>): string[] {
  const anomalies: string[] = [];
  for (const [key, value] of Object.entries(metrics)) {
    if (!statsStore.has(key)) statsStore.set(key, new EWMAMonitor(0.2));
    const monitor = statsStore.get(key)!;
    if (monitor.isAnomalous(value)) {
        anomalies.push(key);
    }
  }
  return anomalies;
}'''

content = content.replace(old_stats, new_stats)

with open('src/lib/dream-engine.ts', 'w') as f:
    f.write(content)

