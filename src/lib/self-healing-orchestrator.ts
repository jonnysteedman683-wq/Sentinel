import { SystemHealthCollector } from './system-health-collector.js';
import { SystemHealthModel } from './system-health-model.js';
import { MaintenanceActionType, SystemHealthVector } from '../types.js';

export class SelfHealingOrchestrator {
  private healthModel: SystemHealthModel;
  private userId: string;
  private db: any;
  private interval: any;
  private history: { state: number[], action: number, nextState: number[] }[] = [];

  constructor(userId: string, db: any) {
    this.userId = userId;
    this.db = db;
    this.healthModel = new SystemHealthModel();
    this.init();
  }

  private async init() {
    if (this.db) {
      try {
        const doc = await this.db.collection('system_meta').doc('health_model').get();
        if (doc.exists) {
          await this.healthModel.load(doc.data());
        }
      } catch (e: any) {
        if (e.message?.includes("PERMISSION_DENIED")) {
          console.warn("[SelfHealing] Skipping weights load due to permissions. Disabling DB logging.");
          this.db = null;
        } else {
          console.error("[SelfHealing] Failed to load model weights:", e);
        }
      }
    }
  }

  public start(ms: number = 60000) {
    this.interval = setInterval(() => this.runCycle(), ms);
  }

  public stop() {
    clearInterval(this.interval);
  }

  private async runCycle() {
    console.log(`[SelfHealing] Starting cycle for ${this.userId}`);
    const currentMetrics = SystemHealthCollector.getMetrics();
    const state = this.vectorToArray(currentMetrics);

    // 1. Select Action (Simplified Planner for now)
    const actionIdx = this.selectBestAction(state);
    const actionType = Object.values(MaintenanceActionType)[actionIdx];

    // 2. Execute Action
    await this.executeAction(actionType);

    // 3. Log results and update history
    if (this.history.length > 0) {
      const last = this.history[this.history.length - 1];
      last.nextState = state;
    }
    
    this.history.push({ state, action: actionIdx, nextState: [] });
    if (this.history.length > 500) this.history.shift();

    // 4. Train model occasionally
    if (this.history.length % 5 === 0) {
      const trainingData = this.history.filter(h => h.nextState.length > 0);
      await this.healthModel.train(trainingData);
      
      // Save weights
      if (this.db) {
        const serialized = await this.healthModel.serialize();
        await this.db.collection('system_meta').doc('health_model').set(serialized);
      }
    }

    // 5. Persist log to Firestore
    await this.logToFirestore(currentMetrics, actionType);
  }

  private vectorToArray(v: SystemHealthVector): number[] {
    return [
      v.memoryUsageRatio,
      v.cpuLoad,
      v.activeWorkerCount,
      v.pendingTaskQueueSize,
      v.firestoreReadErrors,
      v.firestoreWriteErrors,
      v.geminiLatencyMs / 1000, // Normalized
      v.unhandledErrors,
      v.dreamCycleFailureRate
    ];
  }

  private selectBestAction(state: number[]): number {
    const actions = Object.values(MaintenanceActionType);
    let bestActionIdx = 0;
    let minPredictedAnomalies = Infinity;

    // Simple 1-step lookahead
    for (let i = 0; i < actions.length; i++) {
      const nextState = this.healthModel.predictNext(state, i);
      // Heuristic: Anomaly is combination of Memory, CPU, Errors and Failures
      const anomalyScore = nextState[0] + nextState[1] + nextState[7] + nextState[8]; 
      if (anomalyScore < minPredictedAnomalies) {
        minPredictedAnomalies = anomalyScore;
        bestActionIdx = i;
      }
    }

    return bestActionIdx;
  }

  public async executeAction(type: MaintenanceActionType) {
    console.log(`[SelfHealing] Executing action: ${type}`);
    if (!this.db) return;

    try {
      switch (type) {
        case MaintenanceActionType.TRIGGER_GARBAGE_COLLECTION:
          if (global.gc) {
            console.log("[SelfHealing] Forcing GC...");
            global.gc();
          }
          break;
        case MaintenanceActionType.REDUCE_BATCH_SIZE:
          console.log("[SelfHealing] Reducing system batch sizes...");
          await this.db.collection('system_meta').doc('config').set({
            dreamRollouts: 5, // Reduced from 15
            updatedAt: Date.now()
          }, { merge: true });
          break;
        case MaintenanceActionType.INCREASE_RETRY_DELAY:
          console.log("[SelfHealing] Increasing retry delays...");
          await this.db.collection('system_meta').doc('config').set({
            baseRetryDelay: 5000,
            updatedAt: Date.now()
          }, { merge: true });
          break;
        case MaintenanceActionType.FLUSH_LOGS:
          console.log("[SelfHealing] Requesting log flush...");
          // This would be handled by a listener or by reducing local buffer sizes
          break;
        case MaintenanceActionType.RUN_DIAGNOSTIC:
          console.log("[SelfHealing] Running diagnostics...");
          // Simulate diagnostic
          break;
        default:
          break;
      }
    } catch (e) {
      console.error("[SelfHealing] Action execution failed:", e);
    }
  }

  private async logToFirestore(metrics: SystemHealthVector, action: MaintenanceActionType) {
    if (!this.db) return;
    try {
      await this.db.collection('system_health').add({
        userId: this.userId,
        ...metrics,
        actionTaken: action,
        timestamp: Date.now()
      });
    } catch (e: any) {
      if (e.message?.includes('PERMISSION_DENIED') || e.message?.includes('NOT_FOUND') || e.code === 7 || e.code === 5) {
        console.warn(`[SelfHealing] Firestore API issues detected. Disabling background logging for this session. Error: ${e.message}`);
        this.db = null; // Disable further attempts
      } else {
        console.error(`[SelfHealing] Firestore logging failed: ${e.message}`);
      }
    }
  }
}
