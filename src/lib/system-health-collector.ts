import os from 'os';
import { SystemHealthVector } from '../types.js';

export class SystemHealthCollector {
  private static firestoreReadErrors = 0;
  private static firestoreWriteErrors = 0;
  private static geminiLatencyMs: number[] = [];
  private static unhandledErrors = 0;
  private static dreamCycleFailures: boolean[] = [];

  public static recordFirestoreError(type: 'read' | 'write') {
    if (type === 'read') this.firestoreReadErrors++;
    else this.firestoreWriteErrors++;
  }

  public static recordGeminiLatency(ms: number) {
    this.geminiLatencyMs.push(ms);
    if (this.geminiLatencyMs.length > 20) this.geminiLatencyMs.shift();
  }

  public static recordUnhandledError() {
    this.unhandledErrors++;
  }

  public static recordDreamCycle(success: boolean) {
    this.dreamCycleFailures.push(!success);
    if (this.dreamCycleFailures.length > 5) this.dreamCycleFailures.shift();
  }

  public static getMetrics(): SystemHealthVector {
    const isNode = typeof process !== 'undefined' && process.memoryUsage;
    const memory = isNode ? process.memoryUsage() : { heapUsed: 0, heapTotal: 1 };
    
    // Real OS memory ratio
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const osMemoryRatio = (totalMem - freeMem) / totalMem;
    
    // CPU Load (1 min average)
    const load = os.loadavg()[0];
    const cpuCount = os.cpus().length;
    const normalizedCpuLoad = Math.min(load / cpuCount, 1.0);
    
    // Average gemini latency
    const avgGeminiLatency = this.geminiLatencyMs.length > 0 
      ? this.geminiLatencyMs.reduce((a, b) => a + b, 0) / this.geminiLatencyMs.length 
      : 0;

    const failureRate = this.dreamCycleFailures.length > 0
      ? this.dreamCycleFailures.filter(f => f).length / this.dreamCycleFailures.length
      : 0;

    const metrics: SystemHealthVector = {
      memoryUsageRatio: osMemoryRatio || (memory.heapUsed / memory.heapTotal),
      cpuLoad: normalizedCpuLoad,
      activeWorkerCount: 1, // Main thread
      pendingTaskQueueSize: 0, // Placeholder
      firestoreReadErrors: this.firestoreReadErrors,
      firestoreWriteErrors: this.firestoreWriteErrors,
      geminiLatencyMs: avgGeminiLatency,
      unhandledErrors: this.unhandledErrors,
      dreamCycleFailureRate: failureRate,
      timestamp: Date.now()
    };

    // Reset counters after sampling
    this.firestoreReadErrors = 0;
    this.firestoreWriteErrors = 0;
    this.unhandledErrors = 0;

    return metrics;
  }
}
