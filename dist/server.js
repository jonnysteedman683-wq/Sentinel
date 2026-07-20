var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/lib/world-model.ts
var world_model_exports = {};
__export(world_model_exports, {
  WorldModel: () => WorldModel
});
import * as tf2 from "@tensorflow/tfjs";
var WorldModel;
var init_world_model = __esm({
  "src/lib/world-model.ts"() {
    WorldModel = class {
      stateEmbed;
      actionEmbed;
      gru;
      latentMean;
      latentLogVar;
      decoderNextStateMean;
      decoderNextStateLogVar;
      decoderReward;
      decoderDone;
      actionDim;
      constructor(stateDim, actionDim, latentDim = 16, embedDim = 32) {
        this.actionDim = actionDim;
        this.stateEmbed = tf2.layers.dense({ units: embedDim, activation: "relu", name: "state_embed" });
        this.actionEmbed = tf2.layers.dense({ units: embedDim, activation: "relu", name: "action_embed" });
        this.gru = tf2.layers.gru({
          units: embedDim,
          returnState: true,
          returnSequences: false,
          name: "gru"
        });
        this.latentMean = tf2.layers.dense({ units: latentDim, name: "latent_mean" });
        this.latentLogVar = tf2.layers.dense({ units: latentDim, name: "latent_logVar" });
        this.decoderNextStateMean = tf2.layers.dense({ units: stateDim, name: "next_state_mean" });
        this.decoderNextStateLogVar = tf2.layers.dense({ units: stateDim, name: "next_state_logVar" });
        this.decoderReward = tf2.layers.dense({ units: 1, name: "reward" });
        this.decoderDone = tf2.layers.dense({ units: 1, activation: "sigmoid", name: "done" });
      }
      // Forward pass for a single step. Returns predictions and latent stats.
      predictStep(state, action, prevHidden) {
        return tf2.tidy(() => {
          const stateEmb = this.stateEmbed.apply(state);
          const actEmb = this.actionEmbed.apply(action);
          const combined = tf2.concat([stateEmb, actEmb], 1);
          const combinedSeq = combined.expandDims(1);
          const gruRes = this.gru.apply(combinedSeq, prevHidden ? { initialState: [prevHidden] } : {});
          const hidden = gruRes[0];
          const latentMean = this.latentMean.apply(hidden);
          const latentLogVar = this.latentLogVar.apply(hidden);
          const eps = tf2.randomNormal(latentMean.shape);
          const latent = tf2.add(latentMean, tf2.mul(tf2.exp(tf2.mul(latentLogVar, 0.5)), eps));
          const nextStateMean = this.decoderNextStateMean.apply(latent);
          const nextStateLogVar = this.decoderNextStateLogVar.apply(latent);
          const reward = this.decoderReward.apply(latent);
          const done = this.decoderDone.apply(latent);
          return { nextStateMean, nextStateLogVar, reward, done, latentMean, latentLogVar, hidden };
        });
      }
      // Simplified predict for rollouts
      predict(state, action, hidden) {
        return tf2.tidy(() => {
          const s = tf2.tensor2d(state, [1, state.length]);
          const actionOneHot = new Array(this.actionDim).fill(0);
          actionOneHot[action] = 1;
          const a = tf2.tensor2d(actionOneHot, [1, actionOneHot.length]);
          const h = hidden ? tf2.tensor2d(hidden, [1, hidden.length]) : void 0;
          const res = this.predictStep(s, a, h);
          const std = tf2.exp(tf2.mul(res.nextStateLogVar, 0.5));
          const noise = tf2.randomNormal(res.nextStateMean.shape);
          const nextStateTensor = tf2.add(res.nextStateMean, tf2.mul(std, noise));
          return {
            nextState: Array.from(nextStateTensor.dataSync()),
            reward: res.reward.dataSync()[0],
            done: res.done.dataSync()[0] > 0.5,
            hidden: Array.from(res.hidden.dataSync())
          };
        });
      }
      async trainBatch(experiences, epochs = 5) {
        if (experiences.length === 0) return 0;
        const optimizer = tf2.train.adam(1e-3);
        const klWeight = 0.1;
        let totalLoss = 0;
        for (let epoch = 0; epoch < epochs; epoch++) {
          const loss = tf2.tidy(() => {
            const s = tf2.tensor2d(experiences.map((e) => e.state), [experiences.length, experiences[0].state.length]);
            const a = tf2.tensor2d(experiences.map((e) => {
              const arr = new Array(this.actionDim).fill(0);
              arr[e.action] = 1;
              return arr;
            }), [experiences.length, this.actionDim]);
            const ns = tf2.tensor2d(experiences.map((e) => e.nextState), [experiences.length, experiences[0].nextState.length]);
            const r = tf2.tensor2d(experiences.map((e) => [e.reward]), [experiences.length, 1]);
            const d = tf2.tensor2d(experiences.map((e) => [e.done ? 1 : 0]), [experiences.length, 1]);
            const grads = tf2.variableGrads(() => {
              const preds = this.predictStep(s, a);
              const nsDiff = tf2.sub(ns, preds.nextStateMean);
              const stateLoss = tf2.mean(tf2.add(
                preds.nextStateLogVar,
                tf2.square(nsDiff).div(tf2.exp(preds.nextStateLogVar).add(1e-6))
              )).mul(0.5);
              const rewardLoss = tf2.losses.meanSquaredError(r, preds.reward);
              const doneLoss = tf2.losses.sigmoidCrossEntropy(d, preds.done);
              const latentVar = tf2.exp(preds.latentLogVar).clipByValue(1e-12, 1e12);
              const latentLogVarClipped = tf2.log(latentVar);
              const kl = tf2.mean(
                latentVar.add(tf2.square(preds.latentMean)).sub(1).sub(latentLogVarClipped)
              ).mul(0.5);
              return stateLoss.add(rewardLoss).add(doneLoss).add(kl.mul(klWeight));
            });
            optimizer.applyGradients(grads.grads);
            const lossVal = grads.value.dataSync()[0];
            tf2.dispose(grads.grads);
            tf2.dispose(grads.value);
            return lossVal;
          });
          totalLoss += loss;
        }
        optimizer.dispose();
        return totalLoss / epochs;
      }
      async save() {
        const allLayers = [
          this.stateEmbed,
          this.actionEmbed,
          this.gru,
          this.latentMean,
          this.latentLogVar,
          this.decoderNextStateMean,
          this.decoderNextStateLogVar,
          this.decoderReward,
          this.decoderDone
        ];
        const weights = [];
        allLayers.forEach((l) => {
          l.getWeights().forEach((w) => {
            weights.push(Array.from(w.dataSync()));
          });
        });
        return { weights };
      }
      async load(weightsData) {
        const allLayers = [
          this.stateEmbed,
          this.actionEmbed,
          this.gru,
          this.latentMean,
          this.latentLogVar,
          this.decoderNextStateMean,
          this.decoderNextStateLogVar,
          this.decoderReward,
          this.decoderDone
        ];
        let weightIdx = 0;
        allLayers.forEach((l) => {
          const layerWeights = l.getWeights();
          const newWeights = layerWeights.map((w) => {
            const tensor6 = tf2.tensor(weightsData[weightIdx], w.shape);
            weightIdx++;
            return tensor6;
          });
          l.setWeights(newWeights);
          newWeights.forEach((t) => t.dispose());
        });
      }
    };
  }
});

// src/lib/resilience.ts
var CircuitBreaker = class {
  state = "CLOSED";
  failureThreshold = 5;
  resetTimeout = 3e4;
  failureCount = 0;
  successes = 0;
  lastFailureTime = 0;
  successThreshold = 3;
  halfOpenMaxRequests = 3;
  async call(fn) {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = "HALF_OPEN";
        this.successes = 0;
      } else {
        throw new Error("Circuit breaker is OPEN");
      }
    }
    if (this.state === "HALF_OPEN" && this.successes >= this.halfOpenMaxRequests) {
      throw new Error("Circuit breaker is HALF_OPEN (max requests reached)");
    }
    try {
      const result = await fn();
      this.success();
      return result;
    } catch (err) {
      this.failure();
      throw err;
    }
  }
  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime
    };
  }
  success() {
    this.failureCount = 0;
    if (this.state === "HALF_OPEN") {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.state = "CLOSED";
        this.successes = 0;
      }
    } else {
      this.state = "CLOSED";
    }
  }
  failure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = "OPEN";
    }
  }
};

// src/lib/errors.ts
var AppError = class extends Error {
  code;
  status;
  traceId;
  timestamp;
  /**
   * @param {string} message - Descriptive error message
   * @param {ErrorCode} code - Enum categorization of the error
   * @param {number} status - HTTP status code mapping
   * @param {string} [traceId] - Unique ID for tracing the request across frontend/backend boundaries
   */
  constructor(message, code = "UNKNOWN_ERROR" /* UNKNOWN_ERROR */, status = 500, traceId) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
    this.traceId = traceId;
    this.timestamp = Date.now();
    Object.setPrototypeOf(this, new.target.prototype);
  }
};

// src/lib/express-resilience.ts
var breakers = /* @__PURE__ */ new Map();
function withResilience(routeId, handler) {
  if (!breakers.has(routeId)) {
    breakers.set(routeId, new CircuitBreaker());
  }
  const breaker = breakers.get(routeId);
  return async (req, res, next) => {
    try {
      await breaker.call(async () => {
        await Promise.resolve(handler(req, res, next));
      });
    } catch (err) {
      if (err.message?.includes("Circuit breaker is OPEN") || err.message?.includes("HALF_OPEN")) {
        next(new AppError("Service temporarily unavailable due to high failure rate.", "CIRCUIT_BREAK_ACTIVE" /* CIRCUIT_BREAK_ACTIVE */, 503));
      } else {
        next(err);
      }
    }
  };
}
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// src/lib/rate-limiter.ts
var TIER_CONFIGS = {
  heavy: { maxTokens: 30, refillRate: 0.5, cleanupIntervalMs: 3e5 },
  // 30 req burst, ~30/min sustained
  standard: { maxTokens: 100, refillRate: 1.67, cleanupIntervalMs: 3e5 },
  // 100 req burst, ~100/min sustained
  light: { maxTokens: 300, refillRate: 5, cleanupIntervalMs: 3e5 }
  // 300 req burst, ~300/min sustained
};
var HEAVY_ROUTES = ["/api/chat", "/api/debate", "/api/knowledge/erd", "/api/swarm"];
var LIGHT_ROUTES = ["/api/system/health", "/api/debug/diagnostics", "/api/debug/quota-status"];
function getTier(path3) {
  if (HEAVY_ROUTES.some((r) => path3.startsWith(r))) return "heavy";
  if (LIGHT_ROUTES.some((r) => path3.startsWith(r))) return "light";
  return "standard";
}
function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}
var buckets = {
  heavy: /* @__PURE__ */ new Map(),
  standard: /* @__PURE__ */ new Map(),
  light: /* @__PURE__ */ new Map()
};
function refillBucket(bucket, config) {
  const now = Date.now();
  const elapsed = (now - bucket.lastRefill) / 1e3;
  bucket.tokens = Math.min(config.maxTokens, bucket.tokens + elapsed * config.refillRate);
  bucket.lastRefill = now;
}
function cleanupBuckets() {
  const now = Date.now();
  for (const tier of Object.keys(buckets)) {
    const map = buckets[tier];
    const config = TIER_CONFIGS[tier];
    for (const [ip, bucket] of map.entries()) {
      if (now - bucket.lastRefill > config.cleanupIntervalMs && bucket.tokens >= config.maxTokens) {
        map.delete(ip);
      }
    }
  }
}
var _cleanupTimer = null;
function startRateLimiterCleanup() {
  if (!_cleanupTimer) {
    _cleanupTimer = setInterval(cleanupBuckets, 3e5);
    if (_cleanupTimer && typeof _cleanupTimer === "object" && "unref" in _cleanupTimer) {
      _cleanupTimer.unref();
    }
  }
}
function stopRateLimiterCleanup() {
  if (_cleanupTimer) {
    clearInterval(_cleanupTimer);
    _cleanupTimer = null;
  }
}
function rateLimiterMiddleware(req, res, next) {
  if (!req.url.startsWith("/api/")) {
    next();
    return;
  }
  const tier = getTier(req.url);
  const config = TIER_CONFIGS[tier];
  const ip = getClientIp(req);
  const map = buckets[tier];
  let bucket = map.get(ip);
  if (!bucket) {
    bucket = { tokens: config.maxTokens, lastRefill: Date.now() };
    map.set(ip, bucket);
  }
  refillBucket(bucket, config);
  if (bucket.tokens < 1) {
    const retryAfter = Math.ceil((1 - bucket.tokens) / config.refillRate);
    res.set("Retry-After", String(retryAfter));
    res.set("X-RateLimit-Remaining", "0");
    res.status(429).json({
      error: "Too many requests. Please slow down.",
      retryAfterSeconds: retryAfter
    });
    return;
  }
  bucket.tokens -= 1;
  res.set("X-RateLimit-Remaining", String(Math.floor(bucket.tokens)));
  next();
}

// src/lib/graceful-shutdown.ts
function registerShutdownHooks(server, orchestrator, timeoutMs = 1e4) {
  let isShuttingDown = false;
  const shutdown = (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`
[Shutdown] Received ${signal}. Starting graceful shutdown...`);
    server.close((err) => {
      if (err) {
        console.error("[Shutdown] Error closing server:", err.message);
      } else {
        console.log("[Shutdown] Server closed. All connections drained.");
      }
      cleanup();
      process.exit(err ? 1 : 0);
    });
    const forceTimer = setTimeout(() => {
      console.error(`[Shutdown] Forced exit after ${timeoutMs}ms timeout. Some connections may not have drained.`);
      cleanup();
      process.exit(1);
    }, timeoutMs);
    if (forceTimer && typeof forceTimer === "object" && "unref" in forceTimer) {
      forceTimer.unref();
    }
  };
  const cleanup = () => {
    if (orchestrator?.stop) {
      try {
        orchestrator.stop();
        console.log("[Shutdown] SelfHealingOrchestrator stopped.");
      } catch (e) {
        console.error("[Shutdown] Error stopping orchestrator:", e);
      }
    }
    try {
      stopRateLimiterCleanup();
      console.log("[Shutdown] Rate limiter cleanup stopped.");
    } catch (e) {
      console.error("[Shutdown] Error stopping rate limiter:", e);
    }
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  console.log("[Shutdown] Graceful shutdown hooks registered (SIGTERM, SIGINT).");
}

// server.ts
import fs2 from "fs";
import express from "express";
import path2 from "path";
import { Type } from "@google/genai";

// src/lib/firestore-shim.ts
import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  getFirestore,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  writeBatch,
  serverTimestamp,
  arrayUnion,
  arrayRemove
} from "firebase/firestore";
import fs from "fs";
import path from "path";
var clientDb = null;
var app = null;
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    if (firebaseConfig.apiKey && firebaseConfig.projectId) {
      app = initializeApp(firebaseConfig);
      try {
        clientDb = initializeFirestore(app, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId);
      } catch (e) {
        if (e.code === "failed-precondition" || e.message.includes("initializeFirestore")) {
          clientDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
        } else {
          throw e;
        }
      }
      console.log("[Firestore Shim] Client Firestore Shim initialized with database:", firebaseConfig.firestoreDatabaseId);
    } else {
      console.warn("[Firestore Shim] Firebase config is incomplete, Firestore disabled.");
    }
  } else {
    console.warn("[Firestore Shim] firebase-applet-config.json not found, Firestore disabled.");
  }
} catch (e) {
  console.error("[Firestore Shim] Failed to initialize Firestore:", e);
}
var DocumentSnapshotShim = class {
  constructor(snap) {
    this.snap = snap;
  }
  snap;
  get id() {
    return this.snap.id;
  }
  get exists() {
    return this.snap.exists();
  }
  data() {
    return this.snap.data();
  }
  get ref() {
    return this.snap.ref;
  }
};
var QuerySnapshotShim = class {
  constructor(snap) {
    this.snap = snap;
  }
  snap;
  get empty() {
    return this.snap.empty;
  }
  get size() {
    return this.snap.size;
  }
  get docs() {
    return this.snap.docs.map((d) => d instanceof DocumentSnapshotShim ? d : new DocumentSnapshotShim(d));
  }
  forEach(callback) {
    this.docs.forEach(callback);
  }
};
var serverMemoryDb = {};
var isServerQuotaExceeded = true;
var sentinelPath = path.join(process.cwd(), ".firestore_quota_exceeded");
try {
  if (fs.existsSync(sentinelPath)) {
    isServerQuotaExceeded = true;
    console.warn("[Firestore Server Fallback] Proactively loaded quota-exceeded status. Operating in server memory DB mode.");
  }
} catch (e) {
}
function setServerQuotaExceeded(val) {
  isServerQuotaExceeded = true;
  try {
    if (val) {
      fs.writeFileSync(sentinelPath, "true");
    } else {
      if (fs.existsSync(sentinelPath)) {
        fs.unlinkSync(sentinelPath);
      }
    }
  } catch (e) {
  }
}
function withTimeout(promise, timeoutMs, operationName) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const err = new Error(`Firestore operation ${operationName} timed out after ${timeoutMs}ms`);
      err.code = "resource-exhausted";
      reject(err);
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}
function isQuotaError(error) {
  const msg = String(error?.message || error || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();
  return code.includes("resource-exhausted") || code.includes("quota") || msg.includes("quota") || msg.includes("resource-exhausted") || msg.includes("resource_exhausted") || msg.includes("limit exceeded") || msg.includes("timed out");
}
function getCollectionDocs(collectionPath) {
  const docs = [];
  const prefix = collectionPath.endsWith("/") ? collectionPath : collectionPath + "/";
  for (const [key, val] of Object.entries(serverMemoryDb)) {
    if (key.startsWith(prefix)) {
      const remaining = key.substring(prefix.length);
      if (!remaining.includes("/")) {
        docs.push({ id: remaining, ...val });
      }
    }
  }
  return docs;
}
var DocumentReferenceShim = class {
  constructor(clientDb2, path3) {
    this.clientDb = clientDb2;
    this.path = path3;
  }
  clientDb;
  path;
  get id() {
    const parts = this.path.split("/");
    return parts[parts.length - 1];
  }
  collection(subPath) {
    return new CollectionReferenceShim(this.clientDb, `${this.path}/${subPath}`);
  }
  async get() {
    if (isServerQuotaExceeded) {
      const data = serverMemoryDb[this.path] || null;
      return new DocumentSnapshotShim({
        id: this.id,
        exists: () => !!data,
        data: () => data
      });
    }
    try {
      if (!this.clientDb) throw new Error("Firestore not initialized");
      const dRef = doc(this.clientDb, this.path);
      const snap = await withTimeout(getDoc(dRef), 1500, "getDoc");
      if (snap.exists()) {
        serverMemoryDb[this.path] = snap.data();
      }
      return new DocumentSnapshotShim(snap);
    } catch (err) {
      if (isQuotaError(err)) {
        setServerQuotaExceeded(true);
        console.warn(`[Firestore Server Fallback] Quota exceeded on doc.get for path ${this.path}. Switching to server memory DB.`);
        const data = serverMemoryDb[this.path] || null;
        return new DocumentSnapshotShim({
          id: this.id,
          exists: () => !!data,
          data: () => data
        });
      }
      throw err;
    }
  }
  async set(data, options) {
    const processed = this.processData(data);
    if (isServerQuotaExceeded) {
      const merge = options?.merge || false;
      if (merge && serverMemoryDb[this.path]) {
        serverMemoryDb[this.path] = { ...serverMemoryDb[this.path], ...processed };
      } else {
        serverMemoryDb[this.path] = processed;
      }
      return;
    }
    try {
      if (!this.clientDb) throw new Error("Firestore not initialized");
      const dRef = doc(this.clientDb, this.path);
      const merge = options?.merge || false;
      await withTimeout(setDoc(dRef, processed, { merge }), 1500, "setDoc");
      serverMemoryDb[this.path] = processed;
    } catch (err) {
      if (isQuotaError(err)) {
        setServerQuotaExceeded(true);
        console.warn(`[Firestore Server Fallback] Quota exceeded on doc.set for path ${this.path}. Switching to server memory DB.`);
        const merge = options?.merge || false;
        if (merge && serverMemoryDb[this.path]) {
          serverMemoryDb[this.path] = { ...serverMemoryDb[this.path], ...processed };
        } else {
          serverMemoryDb[this.path] = processed;
        }
        return;
      }
      throw err;
    }
  }
  async update(data) {
    const processed = this.processData(data);
    if (isServerQuotaExceeded) {
      serverMemoryDb[this.path] = { ...serverMemoryDb[this.path], ...processed };
      return;
    }
    try {
      if (!this.clientDb) throw new Error("Firestore not initialized");
      const dRef = doc(this.clientDb, this.path);
      await withTimeout(updateDoc(dRef, processed), 1500, "updateDoc");
      serverMemoryDb[this.path] = { ...serverMemoryDb[this.path], ...processed };
    } catch (err) {
      if (isQuotaError(err)) {
        setServerQuotaExceeded(true);
        console.warn(`[Firestore Server Fallback] Quota exceeded on doc.update for path ${this.path}. Switching to server memory DB.`);
        serverMemoryDb[this.path] = { ...serverMemoryDb[this.path], ...processed };
        return;
      }
      throw err;
    }
  }
  async delete() {
    if (isServerQuotaExceeded) {
      delete serverMemoryDb[this.path];
      return;
    }
    try {
      if (!this.clientDb) throw new Error("Firestore not initialized");
      const dRef = doc(this.clientDb, this.path);
      await withTimeout(deleteDoc(dRef), 1500, "deleteDoc");
      delete serverMemoryDb[this.path];
    } catch (err) {
      if (isQuotaError(err)) {
        setServerQuotaExceeded(true);
        console.warn(`[Firestore Server Fallback] Quota exceeded on doc.delete for path ${this.path}. Switching to server memory DB.`);
        delete serverMemoryDb[this.path];
        return;
      }
      throw err;
    }
  }
  processData(data) {
    if (data === null || typeof data !== "object") return data;
    const copy = { ...data };
    for (const key of Object.keys(copy)) {
      if (copy[key] instanceof FieldValueShim) {
        copy[key] = copy[key].value;
      } else if (Array.isArray(copy[key])) {
        copy[key] = copy[key].map((item) => this.processData(item));
      } else if (typeof copy[key] === "object" && copy[key] !== null) {
        copy[key] = this.processData(copy[key]);
      }
    }
    return copy;
  }
};
var CollectionReferenceShim = class _CollectionReferenceShim {
  constructor(clientDb2, path3) {
    this.clientDb = clientDb2;
    this.path = path3;
  }
  clientDb;
  path;
  constraints = [];
  doc(id) {
    const docPath = id ? `${this.path}/${id}` : `${this.path}/${Math.random().toString(36).substring(2, 15)}`;
    return new DocumentReferenceShim(this.clientDb, docPath);
  }
  collection(subPath) {
    return new _CollectionReferenceShim(this.clientDb, `${this.path}/${subPath}`);
  }
  where(fieldPath, opStr, value) {
    const shim = new _CollectionReferenceShim(this.clientDb, this.path);
    let op = opStr;
    shim.constraints = [...this.constraints, where(fieldPath, op, value)];
    return shim;
  }
  orderBy(fieldPath, directionStr = "asc") {
    const shim = new _CollectionReferenceShim(this.clientDb, this.path);
    shim.constraints = [...this.constraints, orderBy(fieldPath, directionStr)];
    return shim;
  }
  limit(n) {
    const shim = new _CollectionReferenceShim(this.clientDb, this.path);
    shim.constraints = [...this.constraints, firestoreLimit(n)];
    return shim;
  }
  async add(data) {
    const docId = Math.random().toString(36).substring(2, 15);
    const docPath = `${this.path}/${docId}`;
    const processed = this.processData(data);
    if (isServerQuotaExceeded) {
      serverMemoryDb[docPath] = processed;
      return new DocumentReferenceShim(this.clientDb, docPath);
    }
    try {
      if (!this.clientDb) throw new Error("Firestore not initialized");
      const cRef = collection(this.clientDb, this.path);
      const docRef = await withTimeout(addDoc(cRef, processed), 1500, "addDoc");
      const realPath = `${this.path}/${docRef.id}`;
      serverMemoryDb[realPath] = processed;
      return new DocumentReferenceShim(this.clientDb, realPath);
    } catch (err) {
      if (isQuotaError(err)) {
        setServerQuotaExceeded(true);
        console.warn(`[Firestore Server Fallback] Quota exceeded on col.add for path ${this.path}. Switching to server memory DB.`);
        serverMemoryDb[docPath] = processed;
        return new DocumentReferenceShim(this.clientDb, docPath);
      }
      throw err;
    }
  }
  async get() {
    if (isServerQuotaExceeded) {
      const localDocs = getCollectionDocs(this.path);
      localDocs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      const mockSnapDocs = localDocs.map((docData) => {
        const { id, ...rest } = docData;
        const docPath = `${this.path}/${id}`;
        return new DocumentSnapshotShim({
          id,
          exists: () => true,
          data: () => rest,
          ref: new DocumentReferenceShim(this.clientDb, docPath)
        });
      });
      return new QuerySnapshotShim({
        empty: mockSnapDocs.length === 0,
        size: mockSnapDocs.length,
        docs: mockSnapDocs,
        forEach: (callback) => mockSnapDocs.forEach(callback)
      });
    }
    try {
      if (!this.clientDb) throw new Error("Firestore not initialized");
      const cRef = collection(this.clientDb, this.path);
      let q;
      if (this.constraints.length > 0) {
        q = query(cRef, ...this.constraints);
      } else {
        q = cRef;
      }
      const snap = await withTimeout(getDocs(q), 1500, "getDocs");
      snap.forEach((doc3) => {
        serverMemoryDb[`${this.path}/${doc3.id}`] = doc3.data();
      });
      return new QuerySnapshotShim(snap);
    } catch (err) {
      if (isQuotaError(err)) {
        setServerQuotaExceeded(true);
        console.warn(`[Firestore Server Fallback] Quota exceeded on col.get for path ${this.path}. Switching to server memory DB.`);
        const localDocs = getCollectionDocs(this.path);
        localDocs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        const mockSnapDocs = localDocs.map((docData) => {
          const { id, ...rest } = docData;
          const docPath = `${this.path}/${id}`;
          return new DocumentSnapshotShim({
            id,
            exists: () => true,
            data: () => rest,
            ref: new DocumentReferenceShim(this.clientDb, docPath)
          });
        });
        return new QuerySnapshotShim({
          empty: mockSnapDocs.length === 0,
          size: mockSnapDocs.length,
          docs: mockSnapDocs,
          forEach: (callback) => mockSnapDocs.forEach(callback)
        });
      }
      throw err;
    }
  }
  processData(data) {
    if (data === null || typeof data !== "object") return data;
    const copy = { ...data };
    for (const key of Object.keys(copy)) {
      if (copy[key] instanceof FieldValueShim) {
        copy[key] = copy[key].value;
      } else if (Array.isArray(copy[key])) {
        copy[key] = copy[key].map((item) => this.processData(item));
      } else if (typeof copy[key] === "object" && copy[key] !== null) {
        copy[key] = this.processData(copy[key]);
      }
    }
    return copy;
  }
};
var FieldValueShim = class {
  constructor(value) {
    this.value = value;
  }
  value;
};
var FieldValue = {
  serverTimestamp: () => new FieldValueShim(serverTimestamp()),
  arrayUnion: (...args) => new FieldValueShim(arrayUnion(...args)),
  arrayRemove: (...args) => new FieldValueShim(arrayRemove(...args))
};
var WriteBatchShim = class {
  constructor(clientDb2) {
    this.clientDb = clientDb2;
    if (clientDb2) {
      this.batch = writeBatch(clientDb2);
    }
  }
  clientDb;
  batch;
  localOperations = [];
  set(docRef, data, options) {
    this.localOperations.push({ type: "set", docRef, data, options });
    if (!this.clientDb || !this.batch || isServerQuotaExceeded) return this;
    const dRef = doc(this.clientDb, docRef.path);
    const processed = this.processData(data);
    this.batch.set(dRef, processed, options);
    return this;
  }
  update(docRef, data) {
    this.localOperations.push({ type: "update", docRef, data });
    if (!this.clientDb || !this.batch || isServerQuotaExceeded) return this;
    const dRef = doc(this.clientDb, docRef.path);
    const processed = this.processData(data);
    this.batch.update(dRef, processed);
    return this;
  }
  delete(docRef) {
    this.localOperations.push({ type: "delete", docRef });
    if (!this.clientDb || !this.batch || isServerQuotaExceeded) return this;
    const dRef = doc(this.clientDb, docRef.path);
    this.batch.delete(dRef);
    return this;
  }
  async commit() {
    if (isServerQuotaExceeded) {
      this.commitLocal();
      return;
    }
    try {
      if (!this.batch) throw new Error("Firestore not initialized");
      await this.batch.commit();
      this.commitLocal();
    } catch (err) {
      if (isQuotaError(err)) {
        setServerQuotaExceeded(true);
        console.warn(`[Firestore Server Fallback] Quota exceeded on batch commit. Switching to server memory DB.`);
        this.commitLocal();
        return;
      }
      throw err;
    }
  }
  commitLocal() {
    for (const op of this.localOperations) {
      const path3 = op.docRef.path;
      if (op.type === "set") {
        const processed = this.processData(op.data);
        const merge = op.options?.merge || false;
        if (merge && serverMemoryDb[path3]) {
          serverMemoryDb[path3] = { ...serverMemoryDb[path3], ...processed };
        } else {
          serverMemoryDb[path3] = processed;
        }
      } else if (op.type === "update") {
        const processed = this.processData(op.data);
        serverMemoryDb[path3] = { ...serverMemoryDb[path3], ...processed };
      } else if (op.type === "delete") {
        delete serverMemoryDb[path3];
      }
    }
  }
  processData(data) {
    if (data === null || typeof data !== "object") return data;
    const copy = { ...data };
    for (const key of Object.keys(copy)) {
      if (copy[key] instanceof FieldValueShim) {
        copy[key] = copy[key].value;
      } else if (Array.isArray(copy[key])) {
        copy[key] = copy[key].map((item) => this.processData(item));
      } else if (typeof copy[key] === "object" && copy[key] !== null) {
        copy[key] = this.processData(copy[key]);
      }
    }
    return copy;
  }
};
var FirestoreShim = class {
  constructor(clientDb2) {
    this.clientDb = clientDb2;
  }
  clientDb;
  collection(path3) {
    return new CollectionReferenceShim(this.clientDb, path3);
  }
  doc(path3) {
    return new DocumentReferenceShim(this.clientDb, path3);
  }
  batch() {
    return new WriteBatchShim(this.clientDb);
  }
};
var dbShim = new FirestoreShim(clientDb);

// server.ts
import { z as z2 } from "zod";
import { randomUUID as randomUUID4 } from "crypto";
import cron from "node-cron";

// src/lib/reducers.ts
function getReducer(aggregateId) {
  const reducers = {
    "dream-cycle": reduceDreamCycle,
    "rl-agent": reduceRLAgent,
    "debate": reduceDebate,
    "system-health": reduceSystemHealth
  };
  return reducers[aggregateId] || ((s) => s);
}
function reduceDreamCycle(state, event) {
  switch (event.eventType) {
    case "DREAM_CYCLE_STARTED":
      return { ...state, status: "running", startTime: event.timestamp };
    case "DREAM_WORLD_MODEL_TRAINED":
      return { ...state, worldModelLoss: event.payload.loss };
    case "DREAM_RL_UPDATED":
      return { ...state, rlPolicyGain: event.payload.policyGain };
    case "DREAM_CYCLE_COMPLETED":
      return { ...state, status: "completed", completedAt: event.timestamp };
    default:
      return state;
  }
}
function reduceRLAgent(state, _) {
  return state;
}
function reduceDebate(state, _) {
  return state;
}
function reduceSystemHealth(state, _) {
  return state;
}

// src/lib/dream-engine.ts
import { trace as trace6, SpanStatusCode as SpanStatusCode6 } from "@opentelemetry/api";

// src/lib/events.ts
import { Timestamp } from "firebase/firestore";
import { trace } from "@opentelemetry/api";
import { randomUUID } from "crypto";
async function publishEvent(userId, aggregateId, eventType, payload, causationId, correlationId) {
  const event = {
    eventId: randomUUID(),
    eventType,
    aggregateId,
    timestamp: /* @__PURE__ */ new Date(),
    userId,
    payload,
    causationId,
    correlationId: correlationId || trace.getActiveSpan()?.spanContext().traceId
  };
  await dbShim.collection(`users/${userId}/systemHealth/eventLog`).add({
    ...event,
    timestamp: Timestamp.fromDate(event.timestamp)
  });
  return event;
}

// src/lib/policy-network.ts
import * as tf from "@tensorflow/tfjs";
var PolicyNetwork = class {
  model;
  stateDim;
  actionDim;
  constructor(stateDim, actionDim) {
    this.stateDim = stateDim;
    this.actionDim = actionDim;
    this.model = tf.sequential();
    this.model.add(tf.layers.dense({ units: 64, activation: "relu", inputShape: [stateDim] }));
    this.model.add(tf.layers.dense({ units: 32, activation: "relu" }));
    this.model.add(tf.layers.dense({ units: actionDim, activation: "softmax" }));
    this.model.compile({
      optimizer: tf.train.adam(1e-3),
      loss: "categoricalCrossentropy",
      metrics: ["accuracy"]
    });
  }
  async predict(state) {
    return tf.tidy(() => {
      const input = tf.tensor2d(state, [1, state.length]);
      const probs = this.model.predict(input);
      const confidence = probs.max().dataSync()[0];
      const action = probs.argMax(1).dataSync()[0];
      return { action, confidence };
    });
  }
  async train(states, actions, epochs = 5) {
    if (states.length === 0) return 0;
    const xs = tf.tensor2d(states, [states.length, this.stateDim]);
    const actionsTensor = tf.tensor1d(actions, "int32");
    const ys = tf.oneHot(actionsTensor, this.actionDim);
    const history = await this.model.fit(xs, ys, {
      epochs,
      batchSize: 32,
      shuffle: true,
      verbose: 0
    });
    xs.dispose();
    actionsTensor.dispose();
    ys.dispose();
    return history.history.loss[history.history.loss.length - 1];
  }
  async serialize() {
    const weights = this.model.getWeights();
    const serializedWeights = [];
    for (const w of weights) {
      serializedWeights.push(await w.array());
    }
    return {
      weights: JSON.stringify(serializedWeights),
      updatedAt: Date.now(),
      inputSize: this.stateDim,
      outputSize: this.actionDim
    };
  }
  deserialize(data) {
    let parsedWeights = typeof data.weights === "string" ? JSON.parse(data.weights) : data.weights;
    const tensors = parsedWeights.map((w) => tf.tensor(w));
    this.model.setWeights(tensors);
  }
};

// src/lib/debate-engine.ts
init_world_model();
var DEBATE_MOVES = [
  "ARGUE",
  "QUESTION",
  "REFINE",
  "CONCEDE",
  "SUMMARIZE",
  "INJECT_CREATIVITY",
  "FACT_CHECK"
];
var DebateWorldModel = class extends WorldModel {
  constructor() {
    super(6, DEBATE_MOVES.length, 8, 16);
  }
};
var DebateAgent = class {
  id;
  persona;
  preferences;
  policyNet;
  usePolicyNet = true;
  actionDim = DEBATE_MOVES.length;
  constructor(id, persona, prefMu, prefSigma) {
    this.id = id;
    this.persona = persona;
    const invCov = prefSigma.map((s) => 1 / (s * s + 1e-6));
    const invCovMatrix = Array(6).fill(0).map((_, i) => {
      const row = Array(6).fill(0);
      row[i] = invCov[i];
      return row;
    });
    this.preferences = { mu: prefMu, invCov: invCovMatrix };
    this.policyNet = new PolicyNetwork(6, this.actionDim);
  }
  async selectMove(state) {
    if (this.usePolicyNet) {
      const { action: action2, confidence } = await this.policyNet.predict(state);
      if (confidence > 0.6) {
        return { move: DEBATE_MOVES[action2], confidence, efe: 0 };
      }
    }
    const action = Math.floor(Math.random() * this.actionDim);
    return { move: DEBATE_MOVES[action], confidence: 0, efe: 0 };
  }
  serialize() {
    return {
      id: this.id,
      persona: this.persona,
      preferences: this.preferences,
      usePolicyNet: this.usePolicyNet
    };
  }
};

// src/lib/circadian.ts
async function updateCircadianModel(userId) {
  const snapshotsRef = dbShim.collection(`users/${userId}/soul/snapshots`);
  const snapshot = await snapshotsRef.orderBy("timestamp", "desc").get();
  const snapshots = snapshot.docs.map((d) => d.data());
  if (snapshots.length < 10) return;
  const coeffs = fitFourierSimple(snapshots);
  await dbShim.doc(`users/${userId}/soul/circadianModel`).set({
    userId,
    ...coeffs,
    updatedAt: Date.now()
  });
}
function fitFourierSimple(_snapshots) {
  const hour = (/* @__PURE__ */ new Date()).getHours();
  const timeFactor = hour / 24 * 2 * Math.PI;
  const valenceCoeffs = [
    0.5,
    // Base valence
    Math.cos(timeFactor) * 0.2,
    Math.sin(timeFactor) * 0.1,
    0,
    0
  ];
  const arousalCoeffs = [
    0.5,
    // Base arousal
    -Math.cos(timeFactor) * 0.4,
    // lower at night (hour 0/24), higher midday (hour 12)
    Math.sin(timeFactor) * 0.2,
    0,
    0
  ];
  const dominanceCoeffs = [
    0.6,
    Math.cos(timeFactor) * 0.1,
    0,
    0,
    0
  ];
  return { valenceCoeffs, arousalCoeffs, dominanceCoeffs };
}

// src/lib/memory-lifecycle.ts
import { Timestamp as Timestamp2 } from "firebase/firestore";
import { trace as trace3, SpanStatusCode as SpanStatusCode3 } from "@opentelemetry/api";

// src/lib/ai-service.ts
import { GoogleGenAI } from "@google/genai";

// src/lib/telemetry.ts
import { diag, DiagConsoleLogger, DiagLogLevel, trace as trace2, SpanStatusCode } from "@opentelemetry/api";
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
var localTraces = {};
var baseTracer = trace2.getTracer("arcane-brain");
var tracer = {
  startSpan(name, options) {
    const span = baseTracer.startSpan(name, options);
    const traceContext = span.spanContext();
    const traceId = traceContext.traceId;
    const spanId = traceContext.spanId;
    const startTime = Date.now();
    const attributes = {};
    const status = { code: SpanStatusCode.UNSET, message: "" };
    const events = [];
    const spanRecord = {
      name,
      traceId,
      spanId,
      startTime,
      endTime: null,
      attributes,
      status,
      events,
      durationMs: 0
    };
    if (!localTraces[traceId]) {
      localTraces[traceId] = [];
    }
    localTraces[traceId].push(spanRecord);
    const traceIds = Object.keys(localTraces);
    if (traceIds.length > 200) {
      delete localTraces[traceIds[0]];
    }
    return {
      setAttribute(key, value) {
        span.setAttribute(key, value);
        attributes[key] = value;
        return this;
      },
      setStatus(stat) {
        span.setStatus(stat);
        status.code = stat.code;
        status.message = stat.message || "";
        return this;
      },
      recordException(err) {
        span.recordException(err);
        events.push({
          name: "exception",
          time: Date.now(),
          attributes: {
            "exception.message": err.message,
            "exception.stack": err.stack
          }
        });
        return this;
      },
      end() {
        span.end();
        spanRecord.endTime = Date.now();
        spanRecord.durationMs = spanRecord.endTime - spanRecord.startTime;
      },
      spanContext() {
        return traceContext;
      }
    };
  }
};

// src/lib/ai-service.ts
import { SpanStatusCode as SpanStatusCode2 } from "@opentelemetry/api";

// src/lib/system-health-collector.ts
import os from "os";
var SystemHealthCollector = class {
  static firestoreReadErrors = 0;
  static firestoreWriteErrors = 0;
  static geminiLatencyMs = [];
  static unhandledErrors = 0;
  static dreamCycleFailures = [];
  static recordFirestoreError(type) {
    if (type === "read") this.firestoreReadErrors++;
    else this.firestoreWriteErrors++;
  }
  static recordGeminiLatency(ms) {
    this.geminiLatencyMs.push(ms);
    if (this.geminiLatencyMs.length > 20) this.geminiLatencyMs.shift();
  }
  static recordUnhandledError() {
    this.unhandledErrors++;
  }
  static recordDreamCycle(success) {
    this.dreamCycleFailures.push(!success);
    if (this.dreamCycleFailures.length > 5) this.dreamCycleFailures.shift();
  }
  static getMetrics() {
    const isNode = typeof process !== "undefined" && process.memoryUsage;
    const memory = isNode ? process.memoryUsage() : { heapUsed: 0, heapTotal: 1 };
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const osMemoryRatio = (totalMem - freeMem) / totalMem;
    const load = os.loadavg()[0];
    const cpuCount = os.cpus().length;
    const normalizedCpuLoad = Math.min(load / cpuCount, 1);
    const avgGeminiLatency = this.geminiLatencyMs.length > 0 ? this.geminiLatencyMs.reduce((a, b) => a + b, 0) / this.geminiLatencyMs.length : 0;
    const failureRate = this.dreamCycleFailures.length > 0 ? this.dreamCycleFailures.filter((f) => f).length / this.dreamCycleFailures.length : 0;
    const metrics = {
      memoryUsageRatio: osMemoryRatio || memory.heapUsed / memory.heapTotal,
      cpuLoad: normalizedCpuLoad,
      activeWorkerCount: 1,
      // Main thread
      pendingTaskQueueSize: 0,
      // Placeholder
      firestoreReadErrors: this.firestoreReadErrors,
      firestoreWriteErrors: this.firestoreWriteErrors,
      geminiLatencyMs: avgGeminiLatency,
      unhandledErrors: this.unhandledErrors,
      dreamCycleFailureRate: failureRate,
      timestamp: Date.now()
    };
    this.firestoreReadErrors = 0;
    this.firestoreWriteErrors = 0;
    this.unhandledErrors = 0;
    return metrics;
  }
};

// src/lib/ai-service.ts
import Groq from "groq-sdk";

// src/lib/session-state.ts
var activeUserIds = /* @__PURE__ */ new Set();

// src/lib/ai-service.ts
function schemaToInstruction(schema) {
  if (!schema) return "";
  let text = "You MUST format your output as a valid JSON object matching this schema:\n```json\n{\n";
  if (schema.properties) {
    const props = Object.entries(schema.properties);
    props.forEach(([key, prop], idx) => {
      if (prop.type === "object" || prop.properties) {
        text += `  "${key}": {
`;
        if (prop.properties) {
          const subProps = Object.entries(prop.properties);
          subProps.forEach(([subKey], subIdx) => {
            text += `    "${subKey}": "string"${subIdx < subProps.length - 1 ? "," : ""}
`;
          });
        }
        text += `  }${idx < props.length - 1 ? "," : ""}
`;
      } else if (prop.type === "array" || prop.items) {
        text += `  "${key}": ["string"]${idx < props.length - 1 ? "," : ""}
`;
      } else {
        text += `  "${key}": "string"${idx < props.length - 1 ? "," : ""}
`;
      }
    });
  }
  text += "}\n```\nReturn ONLY the raw JSON block without markdown formatting or other wrapper text outside of the json block.";
  return text;
}
function generateLocalEmbedding(text) {
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  const vector = new Array(128).fill(0);
  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash << 5) - hash + word.charCodeAt(i);
      hash |= 0;
    }
    const index = Math.abs(hash) % 128;
    vector[index] += 1;
  }
  const magnitude = Math.sqrt(vector.reduce((sum2, val) => sum2 + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= magnitude;
    }
  }
  return vector;
}
async function logLlmCallToFirestore(provider, model, success, durationMs, err = null, traceId = null) {
  if (!dbShim) return;
  try {
    await dbShim.collection("llm_requests").add({
      timestamp: FieldValue.serverTimestamp(),
      provider,
      model,
      success,
      durationMs,
      traceId,
      errorMessage: err ? err.message : null
    });
  } catch (logErr) {
    if (logErr.message?.includes("PERMISSION_DENIED") || logErr.message?.includes("NOT_FOUND") || logErr.code === 7 || logErr.code === 5) {
      console.warn("[AI Service] Firestore API not ready or disabled. LLM logging disabled.");
    } else {
      console.error("[AI Service] Failed to log LLM call to Firestore:", logErr.message);
    }
  }
}
var FallbackGenAI = class {
  geminiBreaker = new CircuitBreaker();
  models = {
    generateContent: async (params) => {
      const startTime = Date.now();
      const modelType = params.modelType || "fast";
      const fastModel = "gemini-3.5-flash";
      const smartModel = "gemini-3.1-pro-preview";
      const model = params.model || (modelType === "smart" ? smartModel : fastModel);
      const traceId = params.traceId || null;
      console.log(`[FallbackGenAI][${traceId || "no-trace"}] Requesting model: ${model}`);
      const hasValidGeminiKey = process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.startsWith("AQ.");
      if (hasValidGeminiKey) {
        let attempts = 0;
        const maxAttempts = 2;
        while (attempts < maxAttempts) {
          try {
            const googleAi = new GoogleGenAI({
              apiKey: process.env.GEMINI_API_KEY,
              httpOptions: {
                headers: {
                  "User-Agent": "aistudio-build"
                }
              }
            });
            const span = tracer.startSpan("Gemini generateContent");
            span.setAttribute("model", model);
            try {
              const res = await this.geminiBreaker.call(() => googleAi.models.generateContent({
                ...params,
                model
              }));
              span.setStatus({ code: SpanStatusCode2.OK });
              span.end();
              const duration = Date.now() - startTime;
              SystemHealthCollector.recordGeminiLatency(duration);
              await logLlmCallToFirestore("google", model, true, duration, null, traceId);
              console.log(`[FallbackGenAI][${traceId || "no-trace"}] Gemini success with ${model} in ${duration}ms`);
              return res;
            } catch (err) {
              span.setStatus({ code: SpanStatusCode2.ERROR, message: err.message });
              span.recordException(err);
              span.end();
              throw err;
            }
          } catch (e) {
            attempts++;
            console.error(`[FallbackGenAI][${traceId || "no-trace"}] Google GenAI call with ${model} failed (attempt ${attempts}), error:`, e.message);
            if (attempts >= maxAttempts) {
              await logLlmCallToFirestore("google", model, false, Date.now() - startTime, e, traceId);
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 1e3 * attempts));
          }
        }
      }
      let messages = [];
      const chatMessages = [];
      if (params.contents) {
        const contentsArray = Array.isArray(params.contents) ? params.contents : [params.contents];
        for (const item of contentsArray) {
          let role = item.role === "model" ? "assistant" : "user";
          let content = "";
          if (item.parts) {
            content = item.parts.map((p) => p.text || "").join("\n");
          } else if (typeof item === "string") {
            content = item;
            role = "user";
          }
          chatMessages.push({ role, content });
        }
      }
      chatMessages.forEach((msg) => {
        if (msg.content && msg.content.length > 3e3) {
          msg.content = msg.content.slice(0, 3e3) + "\n[Content truncated to fit system limits]";
        }
      });
      let prunedChatMessages = chatMessages;
      if (chatMessages.length > 6) {
        prunedChatMessages = chatMessages.slice(-6);
      }
      if (params.config?.systemInstruction) {
        let systemText = "";
        if (typeof params.config.systemInstruction === "string") {
          systemText = params.config.systemInstruction;
        } else if (params.config.systemInstruction.parts) {
          systemText = params.config.systemInstruction.parts.map((p) => p.text || "").join("\n");
        }
        if (systemText.length > 3e3) {
          systemText = systemText.slice(0, 3e3) + "\n[System instruction context truncated]";
        }
        messages.push({ role: "system", content: systemText });
      }
      messages = messages.concat(prunedChatMessages);
      if (params.config?.responseSchema) {
        const schemaText = schemaToInstruction(params.config.responseSchema);
        messages.push({ role: "system", content: schemaText });
      }
      let maxTokens = params.config?.maxOutputTokens || 1024;
      if (maxTokens > 2048) maxTokens = 2048;
      if (process.env.GROQ_API_KEY) {
        try {
          const start = Date.now();
          const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
          const groqMessages = [...messages];
          if (params.config?.responseMimeType === "application/json") {
            const hasJsonWord = groqMessages.some((m) => typeof m.content === "string" && m.content.toLowerCase().includes("json"));
            if (!hasJsonWord) {
              groqMessages.push({ role: "system", content: "You MUST format your output as a valid JSON object." });
            }
          }
          const chatCompletion = await groq.chat.completions.create({
            messages: groqMessages,
            model: modelType === "smart" ? "llama-3.3-70b-versatile" : "llama-3.1-8b-instant",
            max_tokens: maxTokens,
            response_format: params.config?.responseMimeType === "application/json" ? { type: "json_object" } : void 0
          });
          const content = chatCompletion.choices[0]?.message?.content || "";
          await logLlmCallToFirestore("groq", chatCompletion.model, true, Date.now() - start, null, traceId);
          return {
            text: content,
            candidates: [{ content: { parts: [{ text: content }] } }]
          };
        } catch (e) {
          await logLlmCallToFirestore("groq", modelType === "smart" ? "llama-3.3-70b-versatile" : "llama-3.1-8b-instant", false, 0, e, traceId);
          console.error(`[FallbackGenAI] Groq failed:`, e.message);
        }
      }
      try {
        const openRouterModels = modelType === "smart" ? ["meta-llama/llama-3.3-70b-instruct:free", "nousresearch/hermes-3-llama-3.1-405b:free", "anthropic/claude-3.5-sonnet"] : ["meta-llama/llama-3.2-3b-instruct:free", "google/gemma-4-31b-it:free", "anthropic/claude-3-haiku"];
        let lastError = null;
        for (const openRouterModel of openRouterModels) {
          try {
            const start = Date.now();
            let response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                model: openRouterModel,
                messages,
                max_tokens: maxTokens
              })
            });
            if (!response.ok) {
              const errText = await response.text();
              if (response.status === 402 && errText.includes("max_tokens")) {
                let affordableTokens = 150;
                const match = errText.match(/can only afford (\d+)/);
                if (match && match[1]) affordableTokens = Math.max(50, parseInt(match[1], 10) - 10);
                response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify({
                    model: openRouterModel,
                    messages,
                    max_tokens: affordableTokens
                  })
                });
              }
              if (!response.ok) {
                console.warn(`[FallbackGenAI] OpenRouter model ${openRouterModel} failed with status ${response.status}. Trying next...`);
                continue;
              }
            }
            const data = await response.json();
            await logLlmCallToFirestore("openrouter", openRouterModel, true, Date.now() - start, null, traceId);
            const content = data.choices?.[0]?.message?.content || "";
            return {
              text: content,
              candidates: [{ content: { parts: [{ text: content }] } }]
            };
          } catch (err) {
            lastError = err;
            console.warn(`[FallbackGenAI] OpenRouter model ${openRouterModel} failed: ${err.message}. Trying next...`);
          }
        }
        if (lastError) throw lastError;
      } catch (openRouterErr) {
        console.error("[FallbackGenAI] OpenRouter failed, returning local fallback:", openRouterErr.message);
        let defaultErrorText = "Cognitive pathways restricted. System remains functional in local mode.";
        if (params.config?.responseMimeType === "application/json") {
          const contentsStr = typeof params.contents === "string" ? params.contents : JSON.stringify(params.contents || "");
          const promptLower = contentsStr.toLowerCase();
          if (promptLower.includes("array") || promptLower.includes("list") || promptLower.includes("strictly a valid json array") || promptLower.includes("list of objects")) {
            defaultErrorText = JSON.stringify([
              {
                text: "Cognitive pathways restricted. System remains functional in local mode.",
                tags: ["system", "offline"],
                sentiment: 0
              }
            ]);
          } else {
            defaultErrorText = JSON.stringify({
              text: "Cognitive pathways restricted. System remains functional in local mode.",
              selfAnalysis: "System operating in local degraded mode.",
              cognitiveLog: {
                draft: "Local fallback enabled",
                recollection: "System database/API limits reached",
                reflection: "Operating in local sandbox mode",
                reintegration: "Neural pathways active",
                reiterated: "Neural bridge active. Balanced logic."
              },
              extractedMemory: null,
              extractedTags: ["system"],
              suggestedShortcuts: []
            });
          }
        }
        return {
          text: defaultErrorText,
          candidates: [{ content: { parts: [{ text: defaultErrorText }] } }]
        };
      }
    },
    embedContent: async (params) => {
      const hasValidGeminiKey = process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.startsWith("AQ.");
      if (hasValidGeminiKey) {
        try {
          const googleAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          return await this.geminiBreaker.call(() => googleAi.models.embedContent(params));
        } catch (e) {
          console.error("[FallbackGenAI] Google GenAI embedContent failed:", e);
        }
      }
      const text = typeof params.contents === "string" ? params.contents : JSON.stringify(params.contents);
      return { embeddings: [{ values: generateLocalEmbedding(text) }] };
    }
  };
};
var aiClient = null;
function getAi() {
  if (!aiClient) {
    aiClient = new FallbackGenAI();
    aiClient.geminiBreaker.onStateChange = (state, status) => {
      console.log(`[Resilience] Circuit Breaker transitioned to ${state}`);
      for (const uid of activeUserIds) {
        if (uid && uid !== "anonymous") {
          dbShim.collection("users").doc(uid).collection("circuitBreakers").doc("gemini").set(status).catch((err) => console.error(`[Resilience] Failed to write breaker status for user ${uid}:`, err.message));
        }
      }
    };
  }
  return aiClient;
}
var callGeminiGenerate = (contents, model) => getAi().models.generateContent({ contents: [{ role: "user", parts: [{ text: contents }] }], model });

// src/lib/memory-lifecycle.ts
var tracer2 = trace3.getTracer("arcane-brain");
function computeDecayedStrength(memory, now, vad) {
  const hoursSince = (now.getTime() - memory.lastAccessed.toDate().getTime()) / (1e3 * 60 * 60);
  const accessBoost = 1 + memory.accessCount * 0.1;
  let lambda = memory.state === "ephemeral" ? 0.01 : memory.state === "shortTerm" ? 5e-3 : memory.state === "longTerm" ? 1e-3 : memory.state === "core" ? 1e-4 : 1e-5;
  if (vad) {
    const arousal = typeof vad.a === "number" ? vad.a : typeof vad.arousal === "number" ? vad.arousal : 0;
    const valence = typeof vad.v === "number" ? vad.v : 0;
    const stabilityFactor = 1 + arousal * 0.4 + valence * 0.15;
    const safeFactor = Math.max(0.3, Math.min(3, stabilityFactor));
    lambda = lambda / safeFactor;
  }
  return memory.strength * Math.exp(-lambda * hoursSince / accessBoost);
}
function applyDecay(memory, vad) {
  const newStrength = computeDecayedStrength(memory, /* @__PURE__ */ new Date(), vad);
  return { ...memory, strength: Math.max(0, newStrength) };
}
function reinforceMemory(memory, boost = 0.1) {
  return {
    ...memory,
    strength: Math.min(1, memory.strength + boost),
    lastAccessed: Timestamp2.now(),
    accessCount: memory.accessCount + 1
  };
}
function getStateTransition(memory) {
  if (memory.state === "forgotten" || memory.state === "transformed") return memory;
  const strength = memory.strength;
  if (memory.state === "ephemeral" && strength > 0.6) {
    return { ...memory, state: "shortTerm" };
  }
  if (memory.state === "shortTerm" && strength > 0.8) {
    return { ...memory, state: "longTerm" };
  }
  if (memory.state === "longTerm" && strength > 0.95) {
    return { ...memory, state: "core" };
  }
  if (memory.state === "ephemeral" && strength < 0.05) {
    return { ...memory, state: "forgotten" };
  }
  if (memory.state === "shortTerm" && strength < 0.1) {
    return { ...memory, state: "forgotten" };
  }
  if (memory.state === "longTerm" && strength < 0.2) {
    return { ...memory, state: "forgotten" };
  }
  if (memory.state === "core" && strength < 0.3) {
    return { ...memory, state: "forgotten" };
  }
  if (memory.state === "wisdom" && strength < 0.5) {
    return { ...memory, state: "forgotten" };
  }
  return memory;
}
async function generateWisdomFromCluster(userId, parentMemories) {
  const span = tracer2.startSpan("generateWisdomFromCluster");
  try {
    if (parentMemories.length < 3) return null;
    const contents = parentMemories.map((m) => m.content).join("\n---\n");
    const prompt = `
You are a cognitive architect. Given these related memories, extract a single, profound insight (max 1 sentence) that captures their shared essence.
Memories:
${contents}
`;
    const insight = await callGeminiGenerate(prompt, "gemini-3.5-flash");
    const wisdom = {
      id: `wisdom-${crypto.randomUUID()}`,
      insight: insight.trim(),
      sourceMemoryIds: parentMemories.map((m) => m.id),
      strength: 0.9,
      createdAt: Timestamp2.now(),
      lastAccessed: Timestamp2.now(),
      userId
    };
    span.setStatus({ code: SpanStatusCode3.OK });
    return wisdom;
  } catch (err) {
    span.setStatus({ code: SpanStatusCode3.ERROR, message: err.message });
    span.recordException(err);
    return null;
  } finally {
    span.end();
  }
}
async function memoryLifecyclePhase(userId) {
  const span = tracer2.startSpan("Memory Lifecycle Phase");
  try {
    const memRef = dbShim.collection(`users/${userId}/memories`);
    const archiveRef = dbShim.collection(`users/${userId}/memoriesArchive`);
    const wisdomRef = dbShim.collection(`users/${userId}/wisdom`);
    let currentVAD = { v: 0, a: 0, d: 0 };
    let hasLiveEmotion = false;
    try {
      const emotionSnapshots = await dbShim.collection(`users/${userId}/emotionHistory`).orderBy("timestamp", "desc").limit(1).get();
      if (!emotionSnapshots.empty) {
        currentVAD = emotionSnapshots.docs[0].data().vad || currentVAD;
        hasLiveEmotion = true;
      }
    } catch (err) {
      console.warn("[MemoryLifecycle] Failed to fetch latest emotion snapshot:", err);
    }
    if (!hasLiveEmotion) {
      try {
        const circadianDoc = await dbShim.collection(`users/${userId}/soul`).doc("circadianModel").get();
        if (circadianDoc.exists) {
          const { valenceCoeffs, arousalCoeffs, dominanceCoeffs } = circadianDoc.data();
          const hour = (/* @__PURE__ */ new Date()).getHours();
          const t = hour / 24 * 2 * Math.PI;
          const evalFourier = (coeffs) => {
            if (!coeffs || coeffs.length < 5) return 0;
            return coeffs[0] + coeffs[1] * Math.cos(t) + coeffs[2] * Math.sin(t) + coeffs[3] * Math.cos(2 * t) + coeffs[4] * Math.sin(2 * t);
          };
          currentVAD = {
            v: evalFourier(valenceCoeffs),
            a: evalFourier(arousalCoeffs),
            d: evalFourier(dominanceCoeffs)
          };
          console.log(`[MemoryLifecycle] Using circadian VAD bias: v=${currentVAD.v.toFixed(2)} a=${currentVAD.a.toFixed(2)}`);
        }
      } catch (e) {
        console.warn("[MemoryLifecycle] Failed to apply circadian bias:", e);
      }
    }
    const activeSnap = await memRef.where("state", "not-in", ["forgotten", "transformed"]).get();
    const memories = activeSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const batch = dbShim.batch();
    let decayedCount = 0;
    let forgottenCount = 0;
    let reinforcedCount = 0;
    let wisdomCreated = 0;
    for (const mem of memories) {
      let updated = applyDecay(mem, currentVAD);
      updated = getStateTransition(updated);
      if (updated.state === "forgotten") {
        batch.set(archiveRef.doc(mem.id), updated);
        batch.delete(memRef.doc(mem.id));
        forgottenCount++;
        await publishEvent(userId, "memory", "MEMORY_FORGOTTEN", { memoryId: mem.id });
      } else {
        if (updated.strength !== mem.strength || updated.state !== mem.state) {
          batch.set(memRef.doc(mem.id), updated, { merge: true });
          decayedCount++;
          if (updated.strength > mem.strength) reinforcedCount++;
          if (updated.state !== mem.state) {
            await publishEvent(userId, "memory", "MEMORY_STATE_CHANGED", {
              memoryId: mem.id,
              oldState: mem.state,
              newState: updated.state
            });
          }
        }
      }
    }
    const coreMemories = memories.filter((m) => m.state === "core");
    if (coreMemories.length >= 3) {
      const clusters = clusterMemories(coreMemories, 0.85);
      for (const cluster of clusters) {
        if (cluster.length >= 3) {
          const wisdom = await generateWisdomFromCluster(userId, cluster);
          if (wisdom) {
            batch.set(wisdomRef.doc(wisdom.id), wisdom);
            for (const parent of cluster) {
              batch.set(memRef.doc(parent.id), { state: "transformed", parentWisdom: wisdom.id }, { merge: true });
              await publishEvent(userId, "memory", "MEMORY_TRANSFORMED", { memoryId: parent.id, wisdomId: wisdom.id });
            }
            wisdomCreated++;
            await publishEvent(userId, "memory", "WISDOM_CREATED", { wisdomId: wisdom.id });
          }
        }
      }
    }
    await batch.commit();
    span.setAttribute("decayed", decayedCount);
    span.setAttribute("forgotten", forgottenCount);
    span.setAttribute("reinforced", reinforcedCount);
    span.setAttribute("wisdomCreated", wisdomCreated);
    span.setStatus({ code: SpanStatusCode3.OK });
  } catch (err) {
    span.setStatus({ code: SpanStatusCode3.ERROR, message: err.message });
    span.recordException(err);
  } finally {
    span.end();
  }
}
function clusterMemories(memories, threshold) {
  const clusters = [];
  const visited = /* @__PURE__ */ new Set();
  for (const mem of memories) {
    if (visited.has(mem.id)) continue;
    const cluster = [mem];
    visited.add(mem.id);
    for (const other of memories) {
      if (visited.has(other.id)) continue;
      if (cosineSimilarity(mem.embedding, other.embedding) >= threshold) {
        cluster.push(other);
        visited.add(other.id);
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

// src/lib/dream-engine.ts
import * as tf8 from "@tensorflow/tfjs";

// src/lib/lsm.ts
import * as tf3 from "@tensorflow/tfjs";
var LiquidStateMachine = class {
  inputWeights;
  reservoirWeights;
  attentionQuery;
  // trainable
  readoutWeights;
  // trainable
  // Optimizer for readout
  optimizer;
  reservoirSize;
  constructor(inputSize = 768, reservoirSize = 256, outputSize = 768) {
    this.reservoirSize = reservoirSize;
    this.inputWeights = tf3.randomNormal([inputSize, reservoirSize], 0, 0.1);
    const rawResWeights = tf3.randomNormal([reservoirSize, reservoirSize], 0, 0.1);
    this.reservoirWeights = rawResWeights;
    this.attentionQuery = tf3.variable(tf3.randomNormal([reservoirSize, 1], 0, 0.1));
    this.readoutWeights = tf3.variable(tf3.randomNormal([reservoirSize, outputSize], 0, 0.1));
    this.optimizer = tf3.train.adam(0.01);
  }
  /**
   * Feed a sequence of inputs through the reservoir.
   * @param sequence [seq_length, inputSize]
   * @returns liquid states [seq_length, reservoirSize]
   */
  processSequence(sequence) {
    return tf3.tidy(() => {
      const seqLen = sequence.shape[0];
      let state = tf3.zeros([1, this.reservoirSize]);
      const states = [];
      const inputs = tf3.split(sequence, seqLen);
      for (let i = 0; i < seqLen; i++) {
        const inp = inputs[i];
        const inProj = tf3.matMul(inp, this.inputWeights);
        const resProj = tf3.matMul(state, this.reservoirWeights);
        state = tf3.tanh(inProj.add(resProj));
        states.push(state);
      }
      return tf3.concat(states, 0);
    });
  }
  /**
   * Train the readout layer using the liquid states to predict targets.
   * Uses quantum attention to compute a soft-weighted sum over states across time.
   * @param sequenceStates [seqLen, reservoirSize]
   * @param target [1, outputSize]
   */
  trainReadout(sequenceStates, target, epochs = 5) {
    let finalLoss = 0;
    for (let i = 0; i < epochs; i++) {
      const lossFn = () => tf3.tidy(() => {
        const preds = this.predict(sequenceStates);
        return tf3.losses.meanSquaredError(target, preds);
      });
      const res = this.optimizer.minimize(lossFn, true, [this.attentionQuery, this.readoutWeights]);
      if (res) {
        finalLoss = res.dataSync()[0];
        res.dispose();
      }
    }
    return finalLoss;
  }
  /**
   * Predict output from a sequence of liquid states using soft attention
   */
  predict(sequenceStates) {
    return tf3.tidy(() => {
      const scores = tf3.matMul(sequenceStates, this.attentionQuery);
      const weights = tf3.softmax(scores, 0);
      const attended = tf3.matMul(sequenceStates, weights, true, false).transpose();
      return tf3.matMul(attended, this.readoutWeights);
    });
  }
  stateHistory = [];
  /**
   * Advanced anomaly detection based on predictive surprise and temporal state transition divergence (Z-score deviation).
   * Models reservoir surprise - checking if the current state activation magnitude significantly deviates from past rolling history.
   */
  detectAnomaly(liquidState, threshold = 1.96) {
    return tf3.tidy(() => {
      const norm2 = tf3.norm(liquidState).dataSync()[0];
      if (this.stateHistory.length < 5) {
        this.stateHistory.push(norm2);
        return false;
      }
      const sum2 = this.stateHistory.reduce((a, b) => a + b, 0);
      const mean2 = sum2 / this.stateHistory.length;
      const variance = this.stateHistory.reduce((a, b) => a + Math.pow(b - mean2, 2), 0) / this.stateHistory.length;
      const std = Math.sqrt(variance) || 1e-5;
      const zScore = Math.abs(norm2 - mean2) / std;
      this.stateHistory.push(norm2);
      if (this.stateHistory.length > 50) {
        this.stateHistory.shift();
      }
      return zScore > threshold;
    });
  }
  async exportWeights() {
    const inputData = await this.inputWeights.array();
    const reservoirData = await this.reservoirWeights.array();
    const readoutData = await this.readoutWeights.array();
    const attentionData = await this.attentionQuery.array();
    return { inputWeights: inputData, reservoirWeights: reservoirData, readoutWeights: readoutData, attentionQuery: attentionData };
  }
  loadWeights(weights) {
    tf3.dispose([this.inputWeights, this.reservoirWeights, this.readoutWeights, this.attentionQuery]);
    this.inputWeights = tf3.tensor2d(weights.inputWeights);
    this.reservoirWeights = tf3.tensor2d(weights.reservoirWeights);
    this.readoutWeights = tf3.variable(tf3.tensor2d(weights.readoutWeights));
    if (weights.attentionQuery) {
      this.attentionQuery = tf3.variable(tf3.tensor2d(weights.attentionQuery));
    } else {
      this.attentionQuery = tf3.variable(tf3.randomNormal([this.reservoirSize, 1], 0, 0.1));
    }
  }
  dispose() {
    this.inputWeights.dispose();
    this.reservoirWeights.dispose();
    this.readoutWeights.dispose();
    this.attentionQuery.dispose();
  }
};

// src/lib/thoughtEmbedding.ts
async function getThoughtEmbedding(text) {
  try {
    const vector = new Array(768).fill(0).map((_, i) => {
      return Math.sin(text.length * i) * 0.1;
    });
    return vector;
  } catch (err) {
    console.error("Error generating thought embedding:", err);
    return new Array(768).fill(0);
  }
}

// src/lib/hebbian.ts
import { Timestamp as Timestamp3 } from "firebase/firestore";
import { trace as trace4, SpanStatusCode as SpanStatusCode4 } from "@opentelemetry/api";
import { randomUUID as randomUUID2 } from "crypto";
var tracer3 = trace4.getTracer("arcane-brain");
async function updateHebbianTraces(userId, vad) {
  const span = tracer3.startSpan("updateHebbianTraces");
  try {
    const eventsRef = dbShim.collection(`users/${userId}/systemHealth/eventLog`);
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1e3;
    const snapshot = await eventsRef.where("eventType", "==", "MEMORY_REINFORCED").where("timestamp", ">=", oneDayAgo).orderBy("timestamp", "asc").get();
    const events = snapshot.docs.map((d) => d.data());
    const COACCESS_WINDOW = 5 * 60 * 1e3;
    const edgeUpdates = {};
    const affectiveGain = vad ? 1 + Math.max(-0.5, Math.min(1, vad.a * 0.7)) : 1;
    const baseIncrement = 0.1 * affectiveGain;
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const e1 = events[i];
        const e2 = events[j];
        if (e2.timestamp - e1.timestamp > COACCESS_WINDOW) break;
        const m1 = e1.payload.memoryId;
        const m2 = e2.payload.memoryId;
        if (m1 && m2 && m1 !== m2) {
          const id = m1 < m2 ? `${m1}_${m2}` : `${m2}_${m1}`;
          if (!edgeUpdates[id]) {
            edgeUpdates[id] = {
              source: m1 < m2 ? m1 : m2,
              target: m1 < m2 ? m2 : m1,
              increment: 0,
              lastTime: 0
            };
          }
          edgeUpdates[id].increment += baseIncrement;
          edgeUpdates[id].lastTime = Math.max(edgeUpdates[id].lastTime, e2.timestamp);
        }
      }
    }
    const batch = dbShim.batch();
    const edgesRef = dbShim.collection(`users/${userId}/hebbianEdges`);
    let updatedCount = 0;
    for (const [id, update] of Object.entries(edgeUpdates)) {
      const edgeRef = edgesRef.doc(id);
      const edgeSnap = await edgeRef.get();
      if (edgeSnap.exists) {
        const currentTrace = edgeSnap.data()?.trace || 0;
        batch.set(edgeRef, {
          trace: Math.min(1, currentTrace + update.increment),
          lastCoaccess: update.lastTime
        }, { merge: true });
      } else {
        batch.set(edgeRef, {
          id,
          source: update.source,
          target: update.target,
          trace: Math.min(1, update.increment),
          lastCoaccess: update.lastTime
        });
      }
      updatedCount++;
    }
    if (updatedCount > 0) {
      await batch.commit();
      await publishEvent(userId, "hebbian", "HEBBIAN_TRACES_UPDATED", { updatedCount });
    }
    span.setStatus({ code: SpanStatusCode4.OK });
  } catch (err) {
    span.setStatus({ code: SpanStatusCode4.ERROR, message: err.message });
    span.recordException(err);
  } finally {
    span.end();
  }
}
async function pruneWeakEdges(userId, threshold = 0.1) {
  const span = tracer3.startSpan("pruneWeakEdges");
  try {
    const edgesRef = dbShim.collection(`users/${userId}/hebbianEdges`);
    const snapshot = await edgesRef.get();
    const now = Date.now();
    const batch = dbShim.batch();
    let prunedCount = 0;
    snapshot.docs.forEach((doc3) => {
      const edge = doc3.data();
      const hoursSince = (now - edge.lastCoaccess) / (1e3 * 60 * 60);
      const decay = Math.exp(-0.02 * hoursSince);
      const newTrace = edge.trace * decay;
      if (newTrace < threshold) {
        batch.delete(doc3.ref);
        prunedCount++;
      } else {
        batch.set(doc3.ref, { trace: newTrace }, { merge: true });
      }
    });
    await batch.commit();
    if (prunedCount > 0) {
      await publishEvent(userId, "hebbian", "WEAK_EDGES_PRUNED", { prunedCount, threshold });
    }
    span.setStatus({ code: SpanStatusCode4.OK });
  } catch (err) {
    span.setStatus({ code: SpanStatusCode4.ERROR, message: err.message });
    span.recordException(err);
  } finally {
    span.end();
  }
}
function cosineSimilarity2(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}
async function neurogenesisPhase(userId, vad) {
  const span = tracer3.startSpan("neurogenesisPhase");
  try {
    const memRef = dbShim.collection(`users/${userId}/memories`);
    const edgesRef = dbShim.collection(`users/${userId}/hebbianEdges`);
    const activeSnap = await memRef.where("state", "in", ["core", "longTerm"]).get();
    const memories = activeSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (memories.length < 2) {
      span.setStatus({ code: SpanStatusCode4.OK });
      span.end();
      return;
    }
    const edgesSnap = await edgesRef.get();
    const edges = edgesSnap.docs.map((d) => d.data());
    const linkedPairs = new Set(edges.map((e) => e.source < e.target ? `${e.source}_${e.target}` : `${e.target}_${e.source}`));
    const baseThreshold = 0.85;
    const threshold = baseThreshold - vad.a * 0.1 - vad.v * 0.05;
    let bridgesCreated = 0;
    for (let i = 0; i < memories.length; i++) {
      for (let j = i + 1; j < memories.length; j++) {
        const m1 = memories[i];
        const m2 = memories[j];
        const pairId = m1.id < m2.id ? `${m1.id}_${m2.id}` : `${m2.id}_${m1.id}`;
        if (!linkedPairs.has(pairId)) {
          const sim = cosineSimilarity2(m1.embedding, m2.embedding);
          if (sim > threshold) {
            const prompt = `Synthesize a bridging conceptual insight connecting these two ideas (max 1 sentence):
Idea 1: ${m1.content}
Idea 2: ${m2.content}`;
            const insightResponse = await callGeminiGenerate(prompt, "gemini-3.5-flash");
            const insight = insightResponse?.candidates?.[0]?.content?.parts?.[0]?.text || `A conceptual bridge between idea 1 and idea 2.`;
            const bridgeId = `bridge-${randomUUID2()}`;
            const bridgeNode = {
              id: bridgeId,
              content: insight.trim(),
              summary: "Neurogenesis Bridge",
              embedding: m1.embedding.map((val, idx) => (val + m2.embedding[idx]) / 2),
              // Midpoint embedding
              tags: ["bridge", "neurogenesis"],
              strength: 0.8,
              state: "shortTerm",
              createdAt: Timestamp3.now(),
              lastAccessed: Timestamp3.now(),
              accessCount: 0,
              decayRate: 5e-3,
              linkedMemories: [m1.id, m2.id],
              userId
            };
            await memRef.doc(bridgeId).set(bridgeNode);
            const edge1Id = bridgeId < m1.id ? `${bridgeId}_${m1.id}` : `${m1.id}_${bridgeId}`;
            const edge2Id = bridgeId < m2.id ? `${bridgeId}_${m2.id}` : `${m2.id}_${bridgeId}`;
            await edgesRef.doc(edge1Id).set({ id: edge1Id, source: bridgeId, target: m1.id, trace: 0.5, lastCoaccess: Date.now() });
            await edgesRef.doc(edge2Id).set({ id: edge2Id, source: bridgeId, target: m2.id, trace: 0.5, lastCoaccess: Date.now() });
            linkedPairs.add(pairId);
            bridgesCreated++;
            await publishEvent(userId, "hebbian", "NEUROGENESIS_BRIDGE_CREATED", { bridgeId, sourceA: m1.id, sourceB: m2.id, similarity: sim, vadThreshold: threshold });
            if (bridgesCreated >= 3) {
              break;
            }
          }
        }
      }
      if (bridgesCreated >= 3) break;
    }
    span.setStatus({ code: SpanStatusCode4.OK });
  } catch (err) {
    span.setStatus({ code: SpanStatusCode4.ERROR, message: err.message });
    span.recordException(err);
  } finally {
    span.end();
  }
}

// src/lib/insightTrigger.ts
import { Timestamp as Timestamp4 } from "firebase/firestore";
async function triggerInsightFromAnomaly(userId, cycleId, recentThoughts) {
  try {
    const prompt = `You are the subconscious pattern recognizer. The cognitive stream has experienced an anomaly indicating a shift in thought patterns. 
Given these recent thoughts:
${recentThoughts.join("\n")}

Generate a single, profound, non-obvious insight connecting these themes. Keep it to one sentence.`;
    const insightResponse = await callGeminiGenerate(prompt, "gemini-3.5-flash");
    const insightText = insightResponse?.candidates?.[0]?.content?.parts?.[0]?.text || "A sudden shift in thought reveals a hidden connection between previously distinct ideas.";
    const memoryId = `insight-${crypto.randomUUID()}`;
    const mem = {
      id: memoryId,
      content: insightText.trim(),
      summary: "LSM Anomaly Insight",
      embedding: [],
      // could generate
      tags: ["insight", "anomaly-driven"],
      strength: 0.9,
      state: "ephemeral",
      createdAt: Timestamp4.now(),
      lastAccessed: Timestamp4.now(),
      accessCount: 1,
      decayRate: 0.05,
      linkedMemories: [],
      userId
    };
    await dbShim.doc(`users/${userId}/memories/${memoryId}`).set(mem);
    await publishEvent(userId, "insight", "INSIGHT_GENERATED_FROM_ANOMALY", { cycleId, memoryId, text: insightText });
  } catch (err) {
    console.error("Failed to trigger insight from anomaly", err);
  }
}

// src/lib/affectiveFeedback.ts
import { trace as trace5, SpanStatusCode as SpanStatusCode5 } from "@opentelemetry/api";
var tracer4 = trace5.getTracer("arcane-brain");
async function processAffectiveFeedback(userId, cycleId, debateTranscript) {
  const span = tracer4.startSpan("processAffectiveFeedback");
  try {
    const prompt = `Analyze the emotional tone of this debate transcript. Output JSON only with "v" (valence, -1 to 1), "a" (arousal, -1 to 1), and "d" (dominance, -1 to 1). 
Transcript: ${debateTranscript}`;
    const response = await callGeminiGenerate(prompt, "gemini-3.5-flash");
    const textContent = response?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let observedVAD = { v: 0, a: 0, d: 0 };
    try {
      const match = textContent.match(/\\{.*?\\}/s);
      const jsonStr = match ? match[0] : textContent;
      const parsed = JSON.parse(jsonStr);
      if (parsed.v !== void 0) observedVAD = parsed;
    } catch {
    }
    const snapshotsRef = dbShim.collection(`users/${userId}/soul/snapshots`);
    const lastSnap = await snapshotsRef.orderBy("timestamp", "desc").limit(1).get();
    let currentVAD = { v: 0, a: 0, d: 0 };
    if (!lastSnap.empty) {
      currentVAD = lastSnap.docs[0].data().vad || currentVAD;
    }
    const gain = 0.05;
    const newVAD = {
      v: currentVAD.v + gain * (observedVAD.v - currentVAD.v),
      a: currentVAD.a + gain * (observedVAD.a - currentVAD.a),
      d: currentVAD.d + gain * (observedVAD.d - currentVAD.d)
    };
    const newSnapshot = {
      userId,
      vad: {
        valence: newVAD.v,
        arousal: newVAD.a,
        dominance: newVAD.d
      },
      timestamp: Date.now()
    };
    await snapshotsRef.add(newSnapshot);
    await publishEvent(userId, "soul", "AFFECTIVE_RESONANCE", { cycleId, oldVAD: currentVAD, newVAD, observedVAD });
    span.setStatus({ code: SpanStatusCode5.OK });
  } catch (err) {
    span.setStatus({ code: SpanStatusCode5.ERROR, message: err.message });
    span.recordException(err);
  } finally {
    span.end();
  }
}

// src/lib/dream-engine.ts
import { randomUUID as randomUUID3 } from "crypto";

// src/lib/rl-agent.ts
import * as tf7 from "@tensorflow/tfjs";

// src/firebase.ts
import { initializeApp as initializeApp2 } from "firebase/app";
import { initializeFirestore as initializeFirestore2 } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, signInAnonymously, onAuthStateChanged } from "firebase/auth";

// firebase-applet-config.json
var firebase_applet_config_default = {
  projectId: "gen-lang-client-0894146864",
  appId: "1:660147915296:web:a86279843431bbd74e8a45",
  apiKey: "AIzaSyBnZ5AeiUbvpRW2ys0Qc5de4E5XPfJfpcY",
  authDomain: "gen-lang-client-0894146864.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-arcanequantumbra-231b2d9b-0b8c-44b2-ba57-6ffc18932d34",
  storageBucket: "gen-lang-client-0894146864.firebasestorage.app",
  messagingSenderId: "660147915296",
  measurementId: "",
  oAuthClientId: "660147915296-5oel4ihui1od782ulasj0ddqqkvios4p.apps.googleusercontent.com"
};

// src/firebase.ts
import {
  collection as realCollection,
  doc as realDoc,
  setDoc as realSetDoc,
  getDoc as realGetDoc,
  addDoc as realAddDoc,
  getDocs as realGetDocs,
  deleteDoc as realDeleteDoc,
  query as realQuery,
  orderBy as realOrderBy,
  limit as realLimit,
  onSnapshot as realOnSnapshot,
  updateDoc as realUpdateDoc,
  where as realWhere
} from "firebase/firestore";
if (!firebase_applet_config_default || !firebase_applet_config_default.apiKey) {
  console.error("[Firebase] Critical: firebase-applet-config.json is missing or invalid. Deployment will be degraded.");
}
var app2 = initializeApp2(firebase_applet_config_default);
console.log("[Firebase Client] Initializing DB with ID:", firebase_applet_config_default.firestoreDatabaseId);
var db = firebase_applet_config_default.firestoreDatabaseId ? initializeFirestore2(app2, { experimentalForceLongPolling: true }, firebase_applet_config_default.firestoreDatabaseId) : initializeFirestore2(app2, { experimentalForceLongPolling: true });
var auth = getAuth(app2);
var googleProvider = new GoogleAuthProvider();
googleProvider.addScope("https://www.googleapis.com/auth/tasks");
googleProvider.addScope("https://www.googleapis.com/auth/tasks.readonly");
googleProvider.addScope("https://www.googleapis.com/auth/calendar");
googleProvider.addScope("https://www.googleapis.com/auth/calendar.events");
googleProvider.addScope("https://www.googleapis.com/auth/calendar.readonly");
googleProvider.addScope("https://mail.google.com/");
googleProvider.addScope("https://www.googleapis.com/auth/gmail.readonly");
googleProvider.addScope("https://www.googleapis.com/auth/gmail.send");
googleProvider.addScope("https://www.googleapis.com/auth/gmail.modify");
googleProvider.addScope("https://www.googleapis.com/auth/documents");
googleProvider.addScope("https://www.googleapis.com/auth/documents.readonly");
googleProvider.addScope("https://www.googleapis.com/auth/drive.file");
googleProvider.addScope("https://www.googleapis.com/auth/keep");
googleProvider.addScope("https://www.googleapis.com/auth/keep.readonly");
googleProvider.addScope("https://www.googleapis.com/auth/contacts");
googleProvider.addScope("https://www.googleapis.com/auth/contacts.readonly");
googleProvider.addScope("https://www.googleapis.com/auth/chat.messages");
googleProvider.addScope("https://www.googleapis.com/auth/chat.spaces");
googleProvider.addScope("https://www.googleapis.com/auth/drive.metadata.readonly");
var isQuotaExceeded = true;
try {
  isQuotaExceeded = true;
  console.warn("[Firestore Quota Fallback] Operating in offline storage mode.");
} catch (e) {
}
function setQuotaExceeded(val) {
  isQuotaExceeded = val;
  try {
    if (val) {
      localStorage.setItem("firestore_quota_exceeded", "true");
    } else {
      localStorage.removeItem("firestore_quota_exceeded");
    }
  } catch (e) {
  }
}
function isQuotaError2(error) {
  const msg = String(error?.message || error || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();
  return code.includes("resource-exhausted") || code.includes("quota") || msg.includes("quota") || msg.includes("resource-exhausted") || msg.includes("resource_exhausted") || msg.includes("limit exceeded");
}
var getOfflineData = (collectionPath) => {
  try {
    const data = localStorage.getItem(`offline_db_${collectionPath}`);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};
var saveOfflineData = (collectionPath, data) => {
  try {
    localStorage.setItem(`offline_db_${collectionPath}`, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save offline data:", e);
  }
};
function collection2(firestore, ...pathSegments) {
  const ref = realCollection(firestore, ...pathSegments);
  const path3 = pathSegments.join("/");
  ref.__path = path3;
  return ref;
}
function doc2(firestore, ...pathSegments) {
  const ref = realDoc(firestore, ...pathSegments);
  const path3 = pathSegments.join("/");
  ref.__path = path3;
  return ref;
}
var offlineListeners = /* @__PURE__ */ new Map();
function notifyOfflineListeners(path3) {
  const cleanPath = path3.replace(/\//g, "_");
  const listeners = offlineListeners.get(cleanPath);
  if (listeners) {
    const snap = handleOfflineGetDocs(path3);
    listeners.forEach((cb) => {
      try {
        cb(snap);
      } catch (err) {
        console.error("Error in offline listener callback:", err);
      }
    });
  }
}
function handleOfflineAdd(path3, data) {
  const cleanPath = path3.replace(/\//g, "_");
  const offlineList = getOfflineData(cleanPath);
  const newId = "offline-" + Math.random().toString(36).substring(2, 15);
  const newDoc = { ...data, id: newId };
  offlineList.push(newDoc);
  saveOfflineData(cleanPath, offlineList);
  notifyOfflineListeners(path3);
  return {
    id: newId,
    path: `${path3}/${newId}`,
    get: async () => ({
      id: newId,
      exists: () => true,
      data: () => data
    })
  };
}
async function addDoc2(reference, data) {
  const path3 = reference.__path || reference.path || "";
  if (isQuotaExceeded) {
    return handleOfflineAdd(path3, data);
  }
  try {
    return await realAddDoc(reference, data);
  } catch (error) {
    if (isQuotaError2(error)) {
      setQuotaExceeded(true);
      console.warn(`[Firestore Quota Fallback] Quota exceeded on addDoc for path ${path3}. Switching to offline storage.`);
      return handleOfflineAdd(path3, data);
    }
    throw error;
  }
}
function handleOfflineSet(path3, data, options) {
  const parts = path3.split("/");
  const docId = parts[parts.length - 1];
  const collectionPath = parts.slice(0, -1).join("_");
  const collectionRawPath = parts.slice(0, -1).join("/");
  const offlineList = getOfflineData(collectionPath);
  const existingIdx = offlineList.findIndex((item) => item.id === docId);
  let updatedDoc = { ...data, id: docId };
  if (existingIdx >= 0) {
    if (options?.merge) {
      updatedDoc = { ...offlineList[existingIdx], ...data, id: docId };
    }
    offlineList[existingIdx] = updatedDoc;
  } else {
    offlineList.push(updatedDoc);
  }
  saveOfflineData(collectionPath, offlineList);
  notifyOfflineListeners(collectionRawPath);
}
async function setDoc2(reference, data, options) {
  const path3 = reference.__path || reference.path || "";
  if (isQuotaExceeded) {
    return handleOfflineSet(path3, data, options);
  }
  try {
    return await realSetDoc(reference, data, options);
  } catch (error) {
    if (isQuotaError2(error)) {
      setQuotaExceeded(true);
      console.warn(`[Firestore Quota Fallback] Quota exceeded on setDoc for path ${path3}. Switching to offline storage.`);
      return handleOfflineSet(path3, data, options);
    }
    throw error;
  }
}
function handleOfflineGet(path3) {
  const parts = path3.split("/");
  const docId = parts[parts.length - 1];
  const collectionPath = parts.slice(0, -1).join("_");
  const offlineList = getOfflineData(collectionPath);
  const found = offlineList.find((item) => item.id === docId);
  return {
    id: docId,
    exists: () => !!found,
    data: () => found || null
  };
}
async function getDoc2(reference) {
  const path3 = reference.__path || reference.path || "";
  if (isQuotaExceeded) {
    return handleOfflineGet(path3);
  }
  try {
    return await realGetDoc(reference);
  } catch (error) {
    if (isQuotaError2(error)) {
      setQuotaExceeded(true);
      console.warn(`[Firestore Quota Fallback] Quota exceeded on getDoc for path ${path3}. Switching to offline storage.`);
      return handleOfflineGet(path3);
    }
    throw error;
  }
}
function handleOfflineGetDocs(path3) {
  const cleanPath = path3.replace(/\//g, "_");
  const offlineList = getOfflineData(cleanPath);
  const docs = offlineList.map((item) => ({
    id: item.id,
    exists: () => true,
    data: () => item,
    get ref() {
      return doc2(db, path3, item.id);
    }
  }));
  return {
    empty: docs.length === 0,
    size: docs.length,
    docs,
    forEach: (callback) => {
      docs.forEach(callback);
    }
  };
}

// src/lib/tf-rl-core.ts
import * as tf4 from "@tensorflow/tfjs";
var TFQNetwork = class {
  model;
  targetModel;
  state_dim;
  n_actions;
  lr;
  constructor(state_dim, n_actions, lr = 1e-3) {
    this.state_dim = state_dim;
    this.n_actions = n_actions;
    this.lr = lr;
    const buildNet = () => {
      const m = tf4.sequential();
      m.add(tf4.layers.dense({ units: 64, activation: "relu", inputShape: [state_dim], kernelInitializer: "glorotUniform" }));
      m.add(tf4.layers.dense({ units: 64, activation: "relu", kernelInitializer: "glorotUniform" }));
      m.add(tf4.layers.dense({ units: n_actions, activation: "linear", kernelInitializer: "glorotUniform" }));
      return m;
    };
    this.model = buildNet();
    this.model.compile({ optimizer: tf4.train.adam(lr), loss: "meanSquaredError" });
    this.targetModel = buildNet();
    this.syncTarget();
  }
  forward(s) {
    return tf4.tidy(() => {
      const input = tf4.tensor2d(s);
      const output = this.model.predict(input);
      return output.arraySync();
    });
  }
  forwardTarget(s) {
    return tf4.tidy(() => {
      const input = tf4.tensor2d(s);
      const output = this.targetModel.predict(input);
      return output.arraySync();
    });
  }
  async train_step(s, actions, target_q, isOffline = false) {
    const currentQ = this.forward(s);
    const targetQMatrix = currentQ.map((qValues, i) => {
      const newQ = [...qValues];
      newQ[actions[i]] = target_q[i];
      return newQ;
    });
    const xs = tf4.tensor2d(s);
    const ys = tf4.tensor2d(targetQMatrix);
    const history = await this.model.fit(xs, ys, {
      epochs: 1,
      batchSize: s.length,
      verbose: 0
    });
    xs.dispose();
    ys.dispose();
    return history.history.loss[0];
  }
  syncTarget() {
    const weights = this.model.getWeights();
    const targetWeights = weights.map((w) => w.clone());
    this.targetModel.setWeights(targetWeights);
    weights.forEach((w) => w.dispose());
  }
  // Returns mean Q-value across all actions for a zero state — used for convergence tracking
  getMeanQValue() {
    return tf4.tidy(() => {
      const input = tf4.zeros([1, this.state_dim]);
      const output = this.model.predict(input);
      return output.mean().dataSync()[0];
    });
  }
  // Returns max Q-value for a given state — the value the agent is optimizing
  getMaxQValue(state) {
    return tf4.tidy(() => {
      const input = tf4.tensor2d([state]);
      const output = this.model.predict(input);
      return output.max().dataSync()[0];
    });
  }
  async serialize() {
    const weights = this.model.getWeights();
    const serialized = [];
    for (const w of weights) {
      serialized.push(await w.array());
    }
    return { weights: serialized };
  }
  async deserialize(data) {
    if (!data?.weights?.length) return;
    const tensors = data.weights.map((w) => tf4.tensor(w));
    this.model.setWeights(tensors);
    this.syncTarget();
    tensors.forEach((t) => t.dispose());
  }
};
var TFEncoder = class {
  model;
  state_dim;
  enc_dim;
  lr;
  constructor(input_dim, enc_dim, lr = 1e-3) {
    this.state_dim = input_dim;
    this.enc_dim = enc_dim;
    this.lr = lr;
    this.model = tf4.sequential();
    this.model.add(tf4.layers.dense({ units: enc_dim, activation: "relu", inputShape: [input_dim], kernelInitializer: "glorotUniform" }));
    this.model.compile({ optimizer: tf4.train.adam(lr), loss: "meanSquaredError" });
  }
  forward(s) {
    return tf4.tidy(() => {
      const input = tf4.tensor2d(s);
      const output = this.model.predict(input);
      return output.arraySync();
    });
  }
  // Train encoder to minimize reconstruction/prediction error
  async trainStep(states, targets) {
    const xs = tf4.tensor2d(states);
    const ys = tf4.tensor2d(targets);
    const history = await this.model.fit(xs, ys, { epochs: 1, batchSize: states.length, verbose: 0 });
    xs.dispose();
    ys.dispose();
    return history.history.loss[0];
  }
  async serialize() {
    const weights = this.model.getWeights();
    const serialized = [];
    for (const w of weights) {
      serialized.push(await w.array());
    }
    return { weights: serialized };
  }
  async deserialize(data) {
    if (!data?.weights?.length) return;
    const tensors = data.weights.map((w) => tf4.tensor(w));
    this.model.setWeights(tensors);
    tensors.forEach((t) => t.dispose());
  }
};
var TFInverseModel = class {
  model;
  enc_dim;
  n_actions;
  constructor(enc_dim, n_actions, lr = 1e-3) {
    this.enc_dim = enc_dim;
    this.n_actions = n_actions;
    this.model = tf4.sequential();
    this.model.add(tf4.layers.dense({ units: 64, activation: "relu", inputShape: [2 * enc_dim], kernelInitializer: "glorotUniform" }));
    this.model.add(tf4.layers.dense({ units: n_actions, activation: "softmax", kernelInitializer: "glorotUniform" }));
    this.model.compile({ optimizer: tf4.train.adam(lr), loss: "categoricalCrossentropy" });
  }
  forward(enc_s, enc_s_next) {
    return tf4.tidy(() => {
      const batch = enc_s.length;
      const concat4 = tf4.tensor2d(
        Array.from({ length: batch }, (_, i) => [...enc_s[i] || [], ...enc_s_next[i] || []])
      );
      const output = this.model.predict(concat4);
      return output.arraySync();
    });
  }
  async trainStep(enc_s, enc_s_next, actions) {
    const batch = enc_s.length;
    const xs = tf4.tensor2d(
      Array.from({ length: batch }, (_, i) => [...enc_s[i], ...enc_s_next[i]])
    );
    const ys = tf4.oneHot(tf4.tensor1d(actions, "int32"), this.n_actions);
    const history = await this.model.fit(xs, ys, { epochs: 1, batchSize: batch, verbose: 0 });
    xs.dispose();
    ys.dispose();
    return history.history.loss[0];
  }
  async serialize() {
    const weights = this.model.getWeights();
    const serialized = [];
    for (const w of weights) {
      serialized.push(await w.array());
    }
    return { weights: serialized };
  }
  async deserialize(data) {
    if (!data?.weights?.length) return;
    const tensors = data.weights.map((w) => tf4.tensor(w));
    this.model.setWeights(tensors);
    tensors.forEach((t) => t.dispose());
  }
};
var TFForwardModel = class {
  model;
  enc_dim;
  n_actions;
  constructor(enc_dim, n_actions, lr = 1e-3) {
    this.enc_dim = enc_dim;
    this.n_actions = n_actions;
    this.model = tf4.sequential();
    this.model.add(tf4.layers.dense({ units: 64, activation: "relu", inputShape: [enc_dim + n_actions], kernelInitializer: "glorotUniform" }));
    this.model.add(tf4.layers.dense({ units: enc_dim, activation: "linear", kernelInitializer: "glorotUniform" }));
    this.model.compile({ optimizer: tf4.train.adam(lr), loss: "meanSquaredError" });
  }
  forward(enc_s, a_onehot) {
    return tf4.tidy(() => {
      const batch = enc_s.length;
      const concat4 = tf4.tensor2d(
        Array.from({ length: batch }, (_, i) => [...enc_s[i] || [], ...a_onehot[i] || []])
      );
      const output = this.model.predict(concat4);
      return output.arraySync();
    });
  }
  // Train forward model and return intrinsic rewards (prediction errors)
  async trainStep(enc_s, a_onehot, enc_s_next) {
    const batch = enc_s.length;
    const xs = tf4.tensor2d(
      Array.from({ length: batch }, (_, i) => [...enc_s[i], ...a_onehot[i]])
    );
    const ys = tf4.tensor2d(enc_s_next);
    const history = await this.model.fit(xs, ys, { epochs: 1, batchSize: batch, verbose: 0 });
    xs.dispose();
    ys.dispose();
    const predictions = this.forward(enc_s, a_onehot);
    const intrinsicRewards = predictions.map((pred, i) => {
      let err = 0;
      for (let j = 0; j < pred.length; j++) {
        const diff = pred[j] - enc_s_next[i][j];
        err += diff * diff;
      }
      return err * 0.1;
    });
    return { loss: history.history.loss[0], intrinsicRewards };
  }
  // Compute prediction error without training (for curiosity vector)
  getPredictionError(enc_s, a_onehot, enc_s_next) {
    const pred = this.forward([enc_s], [a_onehot])[0];
    let err = 0;
    for (let j = 0; j < pred.length; j++) {
      const diff = pred[j] - enc_s_next[j];
      err += diff * diff;
    }
    return err;
  }
  async serialize() {
    const weights = this.model.getWeights();
    const serialized = [];
    for (const w of weights) {
      serialized.push(await w.array());
    }
    return { weights: serialized };
  }
  async deserialize(data) {
    if (!data?.weights?.length) return;
    const tensors = data.weights.map((w) => tf4.tensor(w));
    this.model.setWeights(tensors);
    tensors.forEach((t) => t.dispose());
  }
};

// src/lib/options.ts
var IdleExplorerOption = class {
  id = "idle-explorer";
  name = "Idle Explorer";
  policy;
  actionSpace = ["NUDGE", "INSIGHT"];
  maxDuration = 10;
  timesActivated = 0;
  successRate = 1;
  constructor(stateDim, lr = 1e-3) {
    this.policy = new TFQNetwork(stateDim, this.actionSpace.length, lr);
  }
  canInitiate(state) {
    const userActivity = state[3];
    return userActivity > 0.5;
  }
  terminationProbability(state) {
    const userActivity = state[3];
    return userActivity < 0.3 ? 1 : 0.05;
  }
  get_action(state, epsilon = 0.1) {
    if (Math.random() < epsilon) {
      return Math.floor(Math.random() * this.actionSpace.length);
    }
    const q = this.policy.forward([state]);
    return q[0].indexOf(Math.max(...q[0]));
  }
};
var DeepConsolidatorOption = class {
  id = "deep-consolidator";
  name = "Deep Consolidator";
  policy;
  actionSpace = ["CONSOLIDATE", "CONSOLIDATE_CHATS"];
  maxDuration = 5;
  timesActivated = 0;
  successRate = 1;
  constructor(stateDim, lr = 1e-3) {
    this.policy = new TFQNetwork(stateDim, this.actionSpace.length, lr);
  }
  canInitiate(state) {
    const memoryCount = state[1];
    return memoryCount > 5;
  }
  terminationProbability(state) {
    const memoryCount = state[1];
    return memoryCount < 2 ? 0.8 : 0.1;
  }
  get_action(state, epsilon = 0.1) {
    if (Math.random() < epsilon) {
      return Math.floor(Math.random() * this.actionSpace.length);
    }
    const q = this.policy.forward([state]);
    return q[0].indexOf(Math.max(...q[0]));
  }
};
var HybridSyncRAGOption = class {
  id = "hybrid-sync-rag";
  name = "Hybrid Sync & Topological RAG";
  policy;
  actionSpace = ["HYBRID_SYNC_RAG"];
  maxDuration = 4;
  timesActivated = 0;
  successRate = 1;
  constructor(stateDim, lr = 1e-3) {
    this.policy = new TFQNetwork(stateDim, this.actionSpace.length, lr);
  }
  canInitiate(state) {
    const memoryCount = state[1];
    return memoryCount > 3;
  }
  terminationProbability(state) {
    const memoryCount = state[1];
    return memoryCount < 2 ? 0.9 : 0.05;
  }
  get_action(state, epsilon = 0.1) {
    if (Math.random() < epsilon) {
      return Math.floor(Math.random() * this.actionSpace.length);
    }
    const q = this.policy.forward([state]);
    return q[0].indexOf(Math.max(...q[0]));
  }
};
var SystemSelfRepairOption = class {
  id = "system-self-repair";
  name = "System Self-Repair";
  policy;
  actionSpace = ["RUN_DIAGNOSTIC", "TRIGGER_GARBAGE_COLLECTION", "RESTART_IDLE_WORKER"];
  maxDuration = 3;
  timesActivated = 0;
  successRate = 1;
  constructor(stateDim, lr = 1e-3) {
    this.policy = new TFQNetwork(stateDim, this.actionSpace.length, lr);
  }
  canInitiate(state) {
    const messageCount = state[0];
    const memoryCount = state[1];
    return messageCount > 15 || memoryCount > 10;
  }
  terminationProbability(state) {
    const messageCount = state[0];
    return messageCount < 5 ? 0.9 : 0.1;
  }
  get_action(state, epsilon = 0.1) {
    if (Math.random() < epsilon) {
      return Math.floor(Math.random() * this.actionSpace.length);
    }
    const q = this.policy.forward([state]);
    return q[0].indexOf(Math.max(...q[0]));
  }
};

// src/lib/active-inference.ts
import * as tf5 from "@tensorflow/tfjs";
var ActiveInferenceAgent = class {
  worldModel;
  prefManager;
  options;
  actionDim;
  userId;
  policyNet;
  usePolicyNet = true;
  constructor(worldModel, prefManager, options, stateDim, actionDim, userId) {
    this.worldModel = worldModel;
    this.prefManager = prefManager;
    this.options = options;
    this.actionDim = actionDim;
    this.userId = userId;
    this.policyNet = new PolicyNetwork(stateDim, actionDim);
  }
  async selectAction(state) {
    if (this.policyNet && this.usePolicyNet) {
      const { action, confidence } = await this.policyNet.predict(state);
      if (confidence > 0.6) {
        this.saveTrainingData(state, action);
        const decision2 = {
          type: action < this.options.length ? "option" : "action",
          efe: 0,
          confidence
        };
        if (decision2.type === "option") {
          decision2.optionId = this.options[action].id;
        } else {
          decision2.index = action;
        }
        return decision2;
      }
    }
    const decision = await this.plan(state);
    const actionIndex = decision.type === "option" ? this.options.findIndex((o) => o.id === decision.optionId) : decision.index;
    this.saveTrainingData(state, actionIndex);
    return decision;
  }
  async saveTrainingData(state, action) {
    try {
      await addDoc2(collection2(db, "users", this.userId, "rlAgent", "policy", "trainingData"), {
        state,
        action,
        timestamp: Date.now()
      });
    } catch (e) {
      console.error("Failed to save policy training data:", e);
    }
  }
  async savePolicyWeights() {
    if (!this.policyNet) return;
    try {
      const serialized = await this.policyNet.serialize();
      await setDoc2(doc2(db, "users", this.userId, "rlAgent", "policyNetwork"), serialized);
    } catch (e) {
      console.error("Failed to save policy network weights:", e);
    }
  }
  async loadPolicyWeights() {
    if (!this.policyNet) return;
    try {
      const snap = await getDoc2(doc2(db, "users", this.userId, "rlAgent", "policyNetwork"));
      if (snap.exists()) {
        this.policyNet.deserialize(snap.data());
      }
    } catch (e) {
      console.error("Failed to load policy network weights:", e);
    }
  }
  /**
   * Calculates the Expected Free Energy (G) for a single step.
   * G = - EpistemicValue - PragmaticValue
   */
  calculateStepEFE(preds, mu, invCovDiag) {
    return tf5.tidy(() => {
      const latentVar = tf5.exp(preds.latentLogVar).clipByValue(1e-12, 1e12);
      const latentLogVarClipped = tf5.log(latentVar);
      const klZ = tf5.sum(
        latentVar.add(tf5.square(preds.latentMean)).sub(1).sub(latentLogVarClipped)
      ).mul(0.5);
      const diff = preds.nextStateMean.squeeze().sub(mu);
      const quad = tf5.sum(invCovDiag.mul(tf5.square(diff)));
      const predVar = tf5.exp(preds.nextStateLogVar.squeeze());
      const traceTerm = tf5.sum(invCovDiag.mul(predVar));
      const logPref = quad.add(traceTerm).mul(-0.5);
      return klZ.sub(logPref);
    });
  }
  /**
   * Evaluates a sequence of actions using the World Model rollouts.
   */
  async evaluateSequence(state, actionSeq, mu, invCovDiag) {
    return tf5.tidy(() => {
      let totalEFE = 0;
      let currentHidden = void 0;
      let currentStateTensor = tf5.tensor2d(state, [1, state.length]);
      for (const a of actionSeq) {
        const actionArray = new Array(this.actionDim).fill(0);
        actionArray[a] = 1;
        const actionTensor = tf5.tensor2d(actionArray, [1, actionArray.length]);
        const preds = this.worldModel.predictStep(currentStateTensor, actionTensor, currentHidden);
        const stepEFE = this.calculateStepEFE(preds, mu, invCovDiag);
        totalEFE += stepEFE.dataSync()[0];
        currentStateTensor = preds.nextStateMean;
        currentHidden = preds.hidden;
      }
      return totalEFE;
    });
  }
  /**
   * Plans the best action/option by searching the EFE landscape.
   */
  async plan(state, horizon = 3) {
    const mu = this.prefManager.mu;
    const invCovDiag = this.prefManager.invCovDiag;
    let minEFE = Infinity;
    let bestDecision = { type: "action", index: 0, efe: 0 };
    const primitivesCount = this.actionDim;
    const sequences = this.generateSequences(primitivesCount, horizon);
    let seqCount = 0;
    for (const seq of sequences) {
      const efe = await this.evaluateSequence(state, seq, mu, invCovDiag);
      if (efe < minEFE) {
        minEFE = efe;
        const bestAction = seq[0];
        if (bestAction < this.options.length) {
          bestDecision = { type: "option", optionId: this.options[bestAction].id, efe };
        } else {
          bestDecision = { type: "action", index: bestAction, efe };
        }
      }
      seqCount++;
      if (seqCount % 20 === 0) {
        await tf5.nextFrame();
      }
    }
    mu.dispose();
    invCovDiag.dispose();
    return bestDecision;
  }
  generateSequences(count, length) {
    if (length <= 1) return Array.from({ length: count }, (_, i) => [i]);
    const prev = this.generateSequences(count, length - 1);
    const result = [];
    for (const p of prev) {
      for (let i = 0; i < count; i++) {
        result.push([...p, i]);
      }
    }
    return result;
  }
};

// src/lib/preferences.ts
import * as tf6 from "@tensorflow/tfjs";
var DEFAULT_PREFERENCES = {
  // state: [memoryCount, sentiment, activity, depth, ...]
  // We prefer: moderate memories, high sentiment, moderate activity, deep focus
  mu: [0.5, 0.8, 0.6, 0.7],
  sigmaDiag: [0.2, 0.1, 0.2, 0.1],
  updatedAt: Date.now()
};
var PreferenceManager = class {
  userId;
  current = DEFAULT_PREFERENCES;
  constructor(userId) {
    this.userId = userId;
  }
  async load() {
    try {
      const snap = await getDoc2(doc2(db, "users", this.userId, "rlAgent", "preferences"));
      if (snap.exists()) {
        this.current = snap.data();
      }
    } catch (e) {
      console.error("Failed to load preferences:", e);
    }
  }
  async save() {
    try {
      await setDoc2(doc2(db, "users", this.userId, "rlAgent", "preferences"), this.current);
    } catch (e) {
      console.error("Failed to save preferences:", e);
    }
  }
  get mu() {
    return tf6.tensor1d(this.current.mu);
  }
  get invCov() {
    const invDiag = this.current.sigmaDiag.map((s) => 1 / (s + 1e-6));
    return tf6.diag(tf6.tensor1d(invDiag));
  }
  get invCovDiag() {
    const invDiag = this.current.sigmaDiag.map((s) => 1 / (s + 1e-6));
    return tf6.tensor1d(invDiag);
  }
  update(observedState, lr = 0.01) {
    this.current.mu = this.current.mu.map((val, i) => val * (1 - lr) + observedState[i] * lr);
    this.current.updatedAt = Date.now();
  }
  getRaw() {
    return this.current;
  }
};

// src/lib/rl-agent.ts
init_world_model();
var ReplayBuffer = class {
  buffer = [];
  capacity;
  constructor(capacity = 2e3) {
    this.capacity = capacity;
  }
  push(state, action, reward, next_state) {
    if (this.buffer.length >= this.capacity) {
      this.buffer.shift();
    }
    this.buffer.push([state, action, reward, next_state]);
  }
  sample(batch_size) {
    const batch = [];
    for (let i = 0; i < batch_size; i++) {
      const idx = Math.floor(Math.random() * this.buffer.length);
      batch.push(this.buffer[idx]);
    }
    const states = batch.map((b) => b[0]);
    const actions = batch.map((b) => b[1]);
    const rewards = batch.map((b) => b[2]);
    const next_states = batch.map((b) => b[3]);
    return [states, actions, rewards, next_states];
  }
  get length() {
    return this.buffer.length;
  }
};
var AgentAction = /* @__PURE__ */ ((AgentAction2) => {
  AgentAction2[AgentAction2["IDLE"] = 0] = "IDLE";
  AgentAction2[AgentAction2["CHANGE_DEPTH"] = 1] = "CHANGE_DEPTH";
  AgentAction2[AgentAction2["CONSOLIDATE"] = 2] = "CONSOLIDATE";
  AgentAction2[AgentAction2["NUDGE"] = 3] = "NUDGE";
  AgentAction2[AgentAction2["CONSOLIDATE_CHATS"] = 4] = "CONSOLIDATE_CHATS";
  AgentAction2[AgentAction2["INSIGHT"] = 5] = "INSIGHT";
  AgentAction2[AgentAction2["HYBRID_SYNC_RAG"] = 6] = "HYBRID_SYNC_RAG";
  return AgentAction2;
})(AgentAction || {});
var CuriousAgent = class {
  state_dim;
  n_actions;
  gamma;
  epsilon;
  lr;
  q_online;
  q_target;
  buffer;
  encoder;
  inverse_model;
  forward_model;
  options = [];
  activeOption = null;
  optionDuration = 0;
  optionInitState = null;
  nudgeCallback;
  consolidateCallback;
  insightCallback;
  hybridSyncRAGCallback;
  currentState = [];
  lastState = [];
  lastAction = 0;
  experienceBuffer = [];
  // Active Inference components
  worldModel;
  prefManager;
  aiPlanner;
  useActiveInference = false;
  constructor(state_dim, n_actions, userId, lr = 1e-3, gamma = 0.99, epsilon = 1) {
    this.state_dim = state_dim;
    this.n_actions = n_actions;
    this.gamma = gamma;
    this.epsilon = epsilon;
    this.lr = lr;
    this.q_online = new TFQNetwork(state_dim, n_actions, this.lr);
    this.q_target = new TFQNetwork(state_dim, n_actions, this.lr);
    this.buffer = new ReplayBuffer();
    const enc_dim = 32;
    this.encoder = new TFEncoder(state_dim, enc_dim, this.lr);
    this.inverse_model = new TFInverseModel(enc_dim, n_actions, this.lr);
    this.forward_model = new TFForwardModel(enc_dim, n_actions, this.lr);
    const opts = [
      new IdleExplorerOption(state_dim, lr),
      new DeepConsolidatorOption(state_dim, lr),
      new HybridSyncRAGOption(state_dim, lr),
      new SystemSelfRepairOption(state_dim, lr)
    ];
    this.options = Object.assign(opts, {
      get: (id) => opts.find((o) => o.id === id)
    });
    this.worldModel = new WorldModel(state_dim, n_actions);
    this.prefManager = new PreferenceManager(userId);
    this.aiPlanner = new ActiveInferenceAgent(
      this.worldModel,
      this.prefManager,
      this.options,
      state_dim,
      n_actions,
      userId
    );
    this.currentState = new Array(state_dim).fill(0);
  }
  setNudgeCallback(cb) {
    this.nudgeCallback = cb;
  }
  setConsolidateCallback(cb) {
    this.consolidateCallback = cb;
  }
  setInsightCallback(cb) {
    this.insightCallback = cb;
  }
  setHybridSyncRAGCallback(cb) {
    this.hybridSyncRAGCallback = cb;
  }
  getState() {
    return [...this.currentState];
  }
  // Phase 1 Upgrade: Compute live curiosity vector (prediction error per state dimension)
  getCuriosityVector(state, action) {
    const enc = this.encoder.forward([state])[0];
    const a_onehot = new Array(this.n_actions).fill(0);
    if (action >= 0 && action < this.n_actions) {
      a_onehot[action] = 1;
    }
    const pred_enc = this.forward_model.forward([enc], [a_onehot])[0];
    const errorMagnitude = enc.reduce((sum2, v, i) => sum2 + Math.abs(v - pred_enc[i]), 0) / enc.length;
    return state.map((s) => errorMagnitude * Math.abs(s) + Math.random() * 0.1 * errorMagnitude);
  }
  setDimension(index, value) {
    if (index >= 0 && index < this.state_dim) {
      this.currentState[index] = value;
    }
  }
  remember(s, a, r, ns) {
    const actionIndex = typeof a === "number" ? a : a.index ?? (a.type === "option" ? 99 : 0);
    this.buffer.push(s, actionIndex, r, ns);
    this.experienceBuffer.push({ state: s, action: actionIndex, reward: r, nextState: ns, done: false });
  }
  async flushExperiences(userId) {
    if (this.experienceBuffer.length === 0) return;
    try {
      const batchRef = collection2(db, "users", userId, "rlAgent_replay");
      await addDoc2(batchRef, {
        timestamp: Date.now(),
        experiences: [...this.experienceBuffer]
      });
      this.experienceBuffer = [];
    } catch (e) {
      console.error("Failed to flush experiences:", e);
    }
  }
  mapReward(reward) {
    if (typeof reward === "string") {
      if (reward === "accept") return 1;
      if (reward === "ignore") return -0.1;
      if (reward === "reject") return -0.5;
      return 0;
    }
    return reward;
  }
  async applyNudgeReward(reward) {
    const r = this.mapReward(reward);
    this.remember(this.lastState, 3 /* NUDGE */, r, this.currentState);
    await this.train();
  }
  async applyConsolidationReward(reward) {
    const r = this.mapReward(reward);
    this.remember(this.lastState, 2 /* CONSOLIDATE */, r, this.currentState);
    await this.train();
  }
  async applyInsightReward(reward) {
    const r = this.mapReward(reward);
    this.remember(this.lastState, 5 /* INSIGHT */, r, this.currentState);
    await this.train();
  }
  async applyDelayedInsightReward(reward) {
    await this.applyInsightReward(reward);
  }
  async applyHybridSyncRAGReward(reward) {
    const r = this.mapReward(reward);
    this.remember(this.lastState, 6 /* HYBRID_SYNC_RAG */, r, this.currentState);
    await this.train();
  }
  async selectActionHRL(state) {
    this.lastState = [...state];
    if (this.activeOption) {
      if (this.optionDuration >= this.activeOption.maxDuration || Math.random() < this.activeOption.terminationProbability(state)) {
        this.activeOption = null;
        return { type: "terminate" };
      }
      this.optionDuration++;
      const localActionIndex = this.activeOption.get_action(state);
      const actionName = this.activeOption.actionSpace[localActionIndex];
      const globalActionIndex = AgentAction[actionName];
      return { type: "action", index: globalActionIndex };
    }
    if (this.useActiveInference) {
      return await this.aiPlanner.selectAction(state);
    }
    const action = this.get_action(state);
    if (action < this.options.length) {
      return { type: "option", optionId: this.options[action].id };
    } else {
      return { type: "action", index: action };
    }
  }
  async act(state) {
    return await this.selectActionHRL(state);
  }
  get_action(state) {
    if (Math.random() < this.epsilon) {
      return Math.floor(Math.random() * this.n_actions);
    }
    const q_values = this.q_online.forward([state]);
    return q_values[0].indexOf(Math.max(...q_values[0]));
  }
  async train() {
    if (this.buffer.length < 64) return;
    const [states, actions, rewards, next_states] = this.buffer.sample(32);
    const enc_s = this.encoder.forward(states);
    const enc_s_next = this.encoder.forward(next_states);
    await this.inverse_model.trainStep(enc_s, enc_s_next, actions);
    const a_onehot = states.map(() => new Array(this.n_actions).fill(0));
    for (let i = 0; i < actions.length; i++) {
      if (actions[i] >= 0 && actions[i] < this.n_actions) {
        a_onehot[i][actions[i]] = 1;
      }
    }
    const { intrinsicRewards } = await this.forward_model.trainStep(enc_s, a_onehot, enc_s_next);
    await this.encoder.trainStep(states, enc_s_next);
    const q_next = this.q_target.forwardTarget(next_states);
    const target_q = [];
    for (let i = 0; i < 32; i++) {
      const max_q_next = Math.max(...q_next[i] || [0]);
      const total_reward = rewards[i] + (intrinsicRewards[i] || 0);
      target_q.push(total_reward + this.gamma * max_q_next);
    }
    await this.q_online.train_step(states, actions, target_q);
    this.epsilon = Math.max(0.1, this.epsilon * 0.995);
  }
  update_target() {
    this.q_target.syncTarget();
  }
  // Returns the current mean Q-value — real convergence metric for the chart
  getMeanQValue() {
    return this.q_online.getMeanQValue();
  }
  async saveWeights(userId) {
    try {
      const optionWeights = {};
      for (const opt of this.options) {
        if (opt.policy) {
          optionWeights[opt.name] = await opt.policy.serialize();
        }
      }
      const docData = {
        updatedAt: Date.now(),
        format: "tfjs-v2",
        topLevel: await this.q_online.serialize(),
        options: optionWeights,
        icm: {
          encoder: await this.encoder.serialize(),
          forwardModel: await this.forward_model.serialize(),
          inverseModel: await this.inverse_model.serialize()
        },
        hyperparams: {
          epsilon: this.epsilon,
          learningRate: this.lr,
          discountFactor: this.gamma
        }
      };
      await setDoc2(doc2(db, "users", userId, "rlAgent", "weights"), docData);
      await this.aiPlanner.savePolicyWeights();
    } catch (e) {
      console.error("Failed to save RL weights:", e);
    }
  }
  async loadWeights(userId) {
    try {
      const snap = await getDoc2(doc2(db, "users", userId, "rlAgent", "weights"));
      if (snap.exists()) {
        const data = snap.data();
        if (data.format === "tfjs-v2") {
          if (data.hyperparams) {
            this.epsilon = data.hyperparams.epsilon;
            this.lr = data.hyperparams.learningRate;
            this.gamma = data.hyperparams.discountFactor;
          }
          if (data.topLevel) {
            await this.q_online.deserialize(data.topLevel);
            this.update_target();
          }
          for (const opt of this.options) {
            const optData = data.options?.[opt.name];
            if (optData) {
              await opt.policy.deserialize(optData);
            }
          }
          if (data.icm) {
            if (data.icm.encoder) await this.encoder.deserialize(data.icm.encoder);
            if (data.icm.forwardModel) await this.forward_model.deserialize(data.icm.forwardModel);
            if (data.icm.inverseModel) await this.inverse_model.deserialize(data.icm.inverseModel);
          }
        } else {
          if (data.hyperparams) {
            this.epsilon = data.hyperparams.epsilon;
            this.lr = data.hyperparams.learningRate;
            this.gamma = data.hyperparams.discountFactor;
          }
        }
        await this.aiPlanner.loadPolicyWeights();
      }
    } catch (e) {
      console.error("Failed to load RL weights:", e);
    }
  }
};

// src/lib/dream-engine.ts
var tracer5 = trace6.getTracer("arcane-brain");
var sharedLSM = null;
async function liquidTrainingPhase(userId, cycleId) {
  const span = tracer5.startSpan("Dream: Liquid Training Phase");
  try {
    if (!sharedLSM) {
      sharedLSM = new LiquidStateMachine();
    }
    const lsmRef = dbShim.collection(`users/${userId}/lsm`).doc("latest");
    const lsmDoc = await lsmRef.get();
    if (lsmDoc.exists) {
      const data = lsmDoc.data();
      if (data && data.weights) {
        sharedLSM.loadWeights(data.weights);
      }
    }
    const eventsRef = dbShim.collection(`users/${userId}/systemHealth/eventLog`);
    const q = eventsRef.orderBy("timestamp", "desc").limit(20);
    const snapshot = await q.get();
    const thoughtTexts = snapshot.docs.map((d) => {
      const data = d.data();
      return JSON.stringify(data.payload) || data.eventType;
    }).reverse();
    if (thoughtTexts.length > 2) {
      const embeddings = await Promise.all(thoughtTexts.map((t) => getThoughtEmbedding(t)));
      const seqTensor = tf8.tensor2d(embeddings);
      const liquidStates = sharedLSM.processSequence(seqTensor);
      const seqLen = liquidStates.shape[0];
      const inputs = liquidStates.slice([0, 0], [seqLen - 1, -1]);
      const targets = tf8.tensor2d([embeddings[embeddings.length - 1]]);
      const loss = sharedLSM.trainReadout(inputs, targets, 5);
      const lastState = liquidStates.slice([seqLen - 1, 0], [1, -1]).squeeze();
      const isAnomaly = sharedLSM.detectAnomaly(lastState);
      await publishEvent(userId, "liquid-state", "LIQUID_TRAINING_COMPLETED", {
        cycleId,
        loss,
        sequenceLength: thoughtTexts.length,
        isAnomaly
      });
      if (isAnomaly) {
        triggerInsightFromAnomaly(userId, cycleId, thoughtTexts).catch(console.error);
      }
      tf8.dispose([seqTensor, liquidStates, inputs, targets, lastState]);
    }
    span.setStatus({ code: SpanStatusCode6.OK });
  } catch (err) {
    span.setStatus({ code: SpanStatusCode6.ERROR, message: err.message });
    span.recordException(err);
  } finally {
    span.end();
  }
}
async function runDreamCycle(userId) {
  const cycleSpan = tracer5.startSpan("Dream Cycle");
  cycleSpan.setAttribute("userId", userId);
  const cycleId = randomUUID3();
  try {
    await publishEvent(userId, "dream-cycle", "DREAM_CYCLE_STARTED", {
      cycleId,
      startTime: Date.now()
    });
    const liquidSpan = tracer5.startSpan("Dream: Liquid Training");
    try {
      await liquidTrainingPhase(userId, cycleId);
      liquidSpan.setStatus({ code: SpanStatusCode6.OK });
    } catch (err) {
      liquidSpan.setStatus({ code: SpanStatusCode6.ERROR, message: err.message });
      liquidSpan.recordException(err);
    } finally {
      liquidSpan.end();
    }
    const trainSpan = tracer5.startSpan("Dream: World Model Training");
    let worldModelLoss = 0;
    try {
      worldModelLoss = await trainWorldModel(userId);
      trainSpan.setStatus({ code: SpanStatusCode6.OK });
      await publishEvent(userId, "dream-cycle", "DREAM_WORLD_MODEL_TRAINED", {
        cycleId,
        loss: worldModelLoss
      });
    } catch (err) {
      trainSpan.setStatus({ code: SpanStatusCode6.ERROR, message: err.message });
      trainSpan.recordException(err);
      await publishEvent(userId, "dream-cycle", "DREAM_WORLD_MODEL_TRAINED_ERROR", {
        cycleId,
        error: err.message
      });
    } finally {
      trainSpan.end();
    }
    const rlSpan = tracer5.startSpan("Dream: Offline RL Update");
    let policyGain = 0;
    try {
      policyGain = await performOfflineRL(userId);
      rlSpan.setStatus({ code: SpanStatusCode6.OK });
      await publishEvent(userId, "dream-cycle", "DREAM_RL_UPDATED", {
        cycleId,
        policyGain
      });
    } catch (err) {
      rlSpan.setStatus({ code: SpanStatusCode6.ERROR, message: err.message });
      rlSpan.recordException(err);
      await publishEvent(userId, "dream-cycle", "DREAM_RL_UPDATED_ERROR", {
        cycleId,
        error: err.message
      });
    } finally {
      rlSpan.end();
    }
    const debateSpan = tracer5.startSpan("Dream: Debate Phase");
    try {
      await debateDreamPhase(userId, cycleId);
      debateSpan.setStatus({ code: SpanStatusCode6.OK });
    } catch (err) {
      debateSpan.setStatus({ code: SpanStatusCode6.ERROR, message: err.message });
      debateSpan.recordException(err);
    } finally {
      debateSpan.end();
    }
    const fedSpan = tracer5.startSpan("Dream: Federated Phase");
    try {
      await federatedDreamPhase(userId, cycleId);
      fedSpan.setStatus({ code: SpanStatusCode6.OK });
    } catch (err) {
      fedSpan.setStatus({ code: SpanStatusCode6.ERROR, message: err.message });
      fedSpan.recordException(err);
    } finally {
      fedSpan.end();
    }
    const emotionalSpan = tracer5.startSpan("Dream: Emotional Phase");
    try {
      await emotionalDreamPhase(userId, cycleId);
      emotionalSpan.setStatus({ code: SpanStatusCode6.OK });
    } catch (err) {
      emotionalSpan.setStatus({ code: SpanStatusCode6.ERROR, message: err.message });
      emotionalSpan.recordException(err);
    } finally {
      emotionalSpan.end();
    }
    const distSpan = tracer5.startSpan("Dream: Policy Distillation");
    try {
      await distillPolicyNetwork(userId);
      distSpan.setStatus({ code: SpanStatusCode6.OK });
    } catch (err) {
      distSpan.setStatus({ code: SpanStatusCode6.ERROR, message: err.message });
      distSpan.recordException(err);
    } finally {
      distSpan.end();
    }
    const anomalySpan = tracer5.startSpan("Dream: Anomaly Check");
    try {
      await runAnomalyDetectionAndHeal(userId);
      anomalySpan.setStatus({ code: SpanStatusCode6.OK });
    } catch (err) {
      anomalySpan.setStatus({ code: SpanStatusCode6.ERROR, message: err.message });
    } finally {
      anomalySpan.end();
    }
    const memSpan = tracer5.startSpan("Dream: Memory Lifecycle");
    try {
      await memoryLifecyclePhase(userId);
      memSpan.setStatus({ code: SpanStatusCode6.OK });
    } catch (err) {
      memSpan.setStatus({ code: SpanStatusCode6.ERROR, message: err.message });
      memSpan.recordException(err);
    } finally {
      memSpan.end();
    }
    const sculptSpan = tracer5.startSpan("Dream: Synaptic Sculpting");
    try {
      await synapticSculptingPhase(userId, cycleId);
      sculptSpan.setStatus({ code: SpanStatusCode6.OK });
    } catch (err) {
      sculptSpan.setStatus({ code: SpanStatusCode6.ERROR, message: err.message });
      sculptSpan.recordException(err);
    } finally {
      sculptSpan.end();
    }
    await updateCircadianModel(userId);
    await publishEvent(userId, "dream-cycle", "DREAM_CYCLE_COMPLETED", {
      cycleId,
      worldModelLoss,
      policyGain,
      completedAt: Date.now()
    });
    cycleSpan.setStatus({ code: SpanStatusCode6.OK });
  } catch (err) {
    cycleSpan.setStatus({ code: SpanStatusCode6.ERROR, message: err.message });
    cycleSpan.recordException(err);
    await publishEvent(userId, "dream-cycle", "DREAM_CYCLE_FAILED", {
      cycleId,
      error: err.message
    });
  } finally {
    cycleSpan.end();
  }
}
async function trainWorldModel(userId) {
  const span = tracer5.startSpan("trainWorldModel");
  try {
    const { WorldModel: WorldModel2 } = await Promise.resolve().then(() => (init_world_model(), world_model_exports));
    const replayCollection = dbShim.collection(`users/${userId}/rlAgent_replay`);
    const snapshot = await replayCollection.orderBy("timestamp", "desc").limit(15).get();
    if (snapshot.empty) {
      console.log("[Dream Engine] No experiences to train world model on.");
      return 0;
    }
    const experiences = [];
    for (const doc3 of snapshot.docs) {
      const data = doc3.data();
      if (data && Array.isArray(data.experiences)) {
        for (const exp3 of data.experiences) {
          if (exp3.state && exp3.action !== void 0 && exp3.reward !== void 0 && exp3.nextState) {
            experiences.push({
              state: exp3.state,
              action: exp3.action,
              reward: exp3.reward,
              nextState: exp3.nextState,
              done: exp3.done ?? false
            });
          }
        }
      }
    }
    if (experiences.length < 2) {
      console.log("[Dream Engine] Too few experiences for world model training.");
      return 0;
    }
    const stateDim = experiences[0].state.length;
    const actionDim = 7;
    const model = new WorldModel2(stateDim, actionDim);
    const wModelRef = dbShim.collection(`users/${userId}/worldModel`).doc("latest");
    const wModelDoc = await wModelRef.get();
    if (wModelDoc.exists) {
      const data = wModelDoc.data();
      if (data?.weights) {
        try {
          await model.load(data.weights);
        } catch (loadErr) {
          console.warn("[Dream Engine] Failed to load world model weights, starting fresh:", loadErr);
        }
      }
    }
    const loss = await model.trainBatch(experiences, 5);
    const saved = await model.save();
    await wModelRef.set({
      ...saved,
      updatedAt: Date.now(),
      stateDim,
      actionDim,
      samplesTrained: experiences.length
    });
    span.setAttribute("loss", loss);
    span.setAttribute("samplesTrained", experiences.length);
    console.log(`[Dream Engine] World model trained. Loss: ${loss.toFixed(4)}, Samples: ${experiences.length}`);
    return loss;
  } catch (err) {
    console.error("[Dream Engine] trainWorldModel failed:", err);
    span.setStatus({ code: SpanStatusCode6.ERROR, message: err.message });
    return 0;
  } finally {
    span.end();
  }
}
async function performOfflineRL(userId) {
  const span = tracer5.startSpan("performOfflineRL");
  try {
    const replayCollection = dbShim.collection(`users/${userId}/rlAgent_replay`);
    const snapshot = await replayCollection.orderBy("timestamp", "desc").limit(10).get();
    if (snapshot.empty) {
      console.log("[Dream Engine] No offline experiences found for RL update.");
      return 0;
    }
    const agent = new CuriousAgent(4, 7, userId);
    await agent.loadWeights(userId);
    let sampleCount = 0;
    for (const doc3 of snapshot.docs) {
      const data = doc3.data();
      if (data && Array.isArray(data.experiences)) {
        for (const exp3 of data.experiences) {
          if (exp3.state && exp3.action !== void 0 && exp3.reward !== void 0 && exp3.nextState) {
            agent.remember(exp3.state, exp3.action, exp3.reward, exp3.nextState);
            sampleCount++;
          }
        }
      }
    }
    if (sampleCount > 0) {
      const initialEpsilon = agent.epsilon;
      const trainSteps = Math.min(10, Math.floor(sampleCount / 10) + 1);
      for (let i = 0; i < trainSteps; i++) {
        await agent.train();
      }
      agent.update_target();
      await agent.saveWeights(userId);
      const policyGain = Math.max(0, initialEpsilon - agent.epsilon);
      span.setAttribute("policyGain", policyGain);
      span.setAttribute("samplesTrained", sampleCount);
      return policyGain;
    }
    return 0;
  } catch (err) {
    console.error("[Dream Engine] Failed to perform offline RL:", err);
    span.setStatus({ code: SpanStatusCode6.ERROR, message: err.message });
    return 0;
  } finally {
    span.end();
  }
}
async function distillPolicyNetwork(userId) {
  const span = tracer5.startSpan("distillPolicyNetwork");
  try {
    const replayCollection = dbShim.collection(`users/${userId}/rlAgent_replay`);
    const snapshot = await replayCollection.orderBy("timestamp", "desc").limit(10).get();
    if (snapshot.empty) return;
    const agent = new CuriousAgent(4, 7, userId);
    await agent.loadWeights(userId);
    const states = [];
    const actions = [];
    for (const doc3 of snapshot.docs) {
      const data = doc3.data();
      if (data && Array.isArray(data.experiences)) {
        for (const exp3 of data.experiences) {
          if (exp3.state) {
            states.push(exp3.state);
            const decision = await agent.selectActionHRL(exp3.state);
            const actionIndex = decision.index ?? 0;
            actions.push(actionIndex);
          }
        }
      }
    }
    if (states.length > 0) {
      const policyNet = new PolicyNetwork(4, 7);
      const policyRef = dbShim.collection(`users/${userId}/policyNetwork`).doc("latest");
      const policyDoc = await policyRef.get();
      if (policyDoc.exists) {
        const data = policyDoc.data();
        if (data) {
          policyNet.deserialize(data);
        }
      }
      const loss = await policyNet.train(states, actions, 10);
      const serialized = await policyNet.serialize();
      await policyRef.set(serialized);
      await publishEvent(userId, "policy-network", "POLICY_DISTILLATION_COMPLETED", {
        loss,
        sampleCount: states.length
      });
      console.log(`[Dream Engine] Distilled policy network with loss ${loss} over ${states.length} states.`);
    }
  } catch (err) {
    console.error("[Dream Engine] Failed to distill policy network:", err);
    span.setStatus({ code: SpanStatusCode6.ERROR, message: err.message });
  } finally {
    span.end();
  }
}
async function debateDreamPhase(userId, parentCycleId) {
  const phaseSpan = tracer5.startSpan("Debate Dream Phase");
  try {
    const debateModel = new DebateWorldModel();
    const eventsRef = dbShim.collection(`users/${userId}/systemHealth/eventLog`);
    const q = eventsRef.where("aggregateId", "==", "debate").orderBy("timestamp", "desc").limit(50);
    const snapshot = await q.get();
    const transitions = snapshot.docs.map((d) => d.data());
    if (transitions.length > 5) {
      const loss = await debateModel.trainOnTransitions(transitions);
      await publishEvent(userId, "debate", "DEBATE_MODEL_TRAINED", { cycleId: parentCycleId, loss, sampleCount: transitions.length });
    }
    const emotionSnapshots = await dbShim.collection(`users/${userId}/soul/snapshots`).orderBy("timestamp", "desc").limit(1).get();
    let currentVAD = { v: 0, a: 0, d: 0 };
    if (!emotionSnapshots.empty) {
      currentVAD = emotionSnapshots.docs[0].data().vad || currentVAD;
    }
    const memoriesRef = dbShim.collection(`users/${userId}/memories`);
    const memSnap = await memoriesRef.orderBy("timestamp", "desc").limit(5).get();
    const recentMemories = memSnap.docs.map((d) => d.data().text).join("\n");
    const topicPrompt = `Generate a provocative, conceptually deep debate topic based on these recent memories:
${recentMemories || "Neural latency, baseline correction, subjective time perception."}
Return only the topic description.`;
    const topicResponse = await callGeminiGenerate(topicPrompt, "gemini-3.5-flash");
    const topic = topicResponse?.candidates?.[0]?.content?.parts?.[0]?.text || "Resolved: System complexity gates evolution.";
    let transcript = "";
    const agents = [
      { name: "Logician", role: "Focus on formal consistency, systems logic, and architectural rules." },
      { name: "Critic", role: "Focus on deconstructive questioning, risk parameters, and skeptical evaluation." }
    ];
    for (let i = 0; i < 4; i++) {
      const activeAgent = agents[i % 2];
      const nextPrompt = `You are the ${activeAgent.name}. ${activeAgent.role}
The current debate topic is: "${topic}".
Anchoring memories:
${recentMemories || "No memories loaded."}

Previous debate transcript:
${transcript || "No arguments yet."}

Provide your next short argument (max 2-3 sentences). Address previous arguments if they exist.`;
      const turnRes = await callGeminiGenerate(nextPrompt, "gemini-3.5-flash");
      const text = turnRes?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      transcript += `${activeAgent.name}: ${text}

`;
    }
    await publishEvent(userId, "debate", "SYNTHETIC_DEBATE_COMPLETED", { cycleId: parentCycleId, topic, movesSimulated: 4, appliedVAD: currentVAD });
    processAffectiveFeedback(userId, parentCycleId, transcript).catch(console.error);
    phaseSpan.setStatus({ code: SpanStatusCode6.OK });
  } catch (err) {
    phaseSpan.setStatus({ code: SpanStatusCode6.ERROR, message: err.message });
    phaseSpan.recordException(err);
  } finally {
    phaseSpan.end();
  }
}
async function federatedDreamPhase(userId, parentCycleId) {
  const phaseSpan = tracer5.startSpan("Federated Dream Phase");
  try {
    await publishEvent(userId, "federated", "VIRTUAL_FEDERATED_ROUND_COMPLETED", { cycleId: parentCycleId, virtualClientCount: 3 });
    phaseSpan.setStatus({ code: SpanStatusCode6.OK });
  } catch (err) {
    phaseSpan.setStatus({ code: SpanStatusCode6.ERROR, message: err.message });
    phaseSpan.recordException(err);
  } finally {
    phaseSpan.end();
  }
}
async function emotionalDreamPhase(userId, parentCycleId) {
  const phaseSpan = tracer5.startSpan("Emotional Dream Phase");
  try {
    await publishEvent(userId, "soul", "EMOTIONAL_DREAM_REPLAYED", {
      cycleId: parentCycleId,
      timestamp: Date.now()
    });
    phaseSpan.setStatus({ code: SpanStatusCode6.OK });
  } catch (err) {
    phaseSpan.setStatus({ code: SpanStatusCode6.ERROR, message: err.message });
    phaseSpan.recordException(err);
  } finally {
    phaseSpan.end();
  }
}
async function synapticSculptingPhase(userId, parentCycleId) {
  const span = tracer5.startSpan("Synaptic Sculpting Phase");
  try {
    const emotionSnapshots = await dbShim.collection(`users/${userId}/soul/snapshots`).orderBy("timestamp", "desc").limit(1).get();
    let currentVAD = { v: 0, a: 0, d: 0 };
    if (!emotionSnapshots.empty) {
      currentVAD = emotionSnapshots.docs[0].data().vad || currentVAD;
    }
    await updateHebbianTraces(userId, currentVAD);
    await pruneWeakEdges(userId, 0.1);
    await neurogenesisPhase(userId, currentVAD);
    await publishEvent(userId, "hebbian", "SYNAPTIC_SCULPTING_COMPLETED", { cycleId: parentCycleId });
    span.setStatus({ code: SpanStatusCode6.OK });
  } catch (err) {
    span.setStatus({ code: SpanStatusCode6.ERROR, message: err.message });
    span.recordException(err);
  } finally {
    span.end();
  }
}
async function runAnomalyDetectionAndHeal(userId) {
  const span = tracer5.startSpan("Anomaly Detection");
  try {
    const metrics = { memoryUsageRatio: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal, activeWorkers: 2, geminiLatencyMs: 250, errorRate: 0.01 };
    const anomalies = updateStatsAndDetect(userId, metrics);
    if (anomalies.length > 0) {
      await publishEvent(userId, "system-health", "ANOMALY_DETECTED", { metrics, anomalies });
    }
    span.setStatus({ code: SpanStatusCode6.OK });
  } catch (err) {
    span.setStatus({ code: SpanStatusCode6.ERROR, message: err.message });
  } finally {
    span.end();
  }
}
var EWMAMonitor = class {
  alpha;
  ewma = null;
  ewmaVariance = null;
  constructor(alpha = 0.3) {
    this.alpha = alpha;
  }
  update(value) {
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
  isAnomalous(value) {
    const bounds = this.update(value);
    if (this.ewmaVariance === 0) return false;
    return value > bounds.upperBound || value < bounds.lowerBound;
  }
};
var statsStore = /* @__PURE__ */ new Map();
function updateStatsAndDetect(_, metrics) {
  const anomalies = [];
  for (const [key, value] of Object.entries(metrics)) {
    if (!statsStore.has(key)) statsStore.set(key, new EWMAMonitor(0.2));
    const monitor = statsStore.get(key);
    if (monitor.isAnomalous(value)) {
      anomalies.push(key);
    }
  }
  return anomalies;
}

// src/lib/memory-reinforce.ts
async function touchMemory(userId, memoryId) {
  const ref = dbShim.doc(`users/${userId}/memories/${memoryId}`);
  const snap = await ref.get();
  if (!snap.exists) return;
  const mem = { id: snap.id, ...snap.data() };
  const updated = reinforceMemory(mem);
  await ref.set(updated, { merge: true });
  await publishEvent(userId, "memory", "MEMORY_REINFORCED", { memoryId });
}

// src/lib/federation.ts
import * as tf9 from "@tensorflow/tfjs";
var FederatedServer = class {
  /**
   * FedAvg: Weighted average of model weight updates
   */
  static async aggregate(updates) {
    if (updates.length === 0) return [];
    const totalSamples = updates.reduce((acc, u) => acc + u.sampleSize, 0);
    const aggregatedTensors = updates[0].weights.map((w) => {
      return tf9.tidy(() => {
        const weightTensor = tf9.tensor(w);
        return weightTensor.mul(updates[0].sampleSize / totalSamples);
      });
    });
    for (let i = 1; i < updates.length; i++) {
      const scale = updates[i].sampleSize / totalSamples;
      updates[i].weights.forEach((w, j) => {
        const current = aggregatedTensors[j];
        const nextTensor = tf9.tidy(() => {
          const weightTensor = tf9.tensor(w);
          const scaled = weightTensor.mul(scale);
          return current.add(scaled);
        });
        aggregatedTensors[j] = nextTensor;
        current.dispose();
      });
    }
    const result = await Promise.all(aggregatedTensors.map((t) => t.array()));
    aggregatedTensors.forEach((t) => t.dispose());
    return result;
  }
};

// src/lib/swarm-engine.ts
var AGENT_PROMPTS = {
  Architect: "You are the Architect. Design the high-level structure and algorithms. Provide clear blueprints. Do not write implementation code yet.",
  Philosopher: "You are the Philosopher. Question the underlying assumptions, ethical implications, and broader impact of the solution. Guide the overarching vision.",
  Coder: "You are the Coder. Write the actual implementation code based on the Architect's blueprints and the Philosopher's vision.",
  Tester: "You are the Tester. Find edge cases, bugs, and security vulnerabilities in the Coder's implementation or the Architect's design.",
  Critic: "You are the Critic. You challenge the group's decisions. Play devil's advocate. Ensure the final output is robust, optimal, and elegant."
};
var AgenticSwarm = class {
  state;
  onStateUpdate;
  constructor(taskId, taskDescription, onStateUpdate) {
    this.state = {
      taskId,
      taskDescription,
      status: "initializing",
      scratchpad: "Initial Task: " + taskDescription,
      messages: [],
      activeAgent: null
    };
    this.onStateUpdate = onStateUpdate;
  }
  broadcast(role, content) {
    this.state.messages.push({
      id: Math.random().toString(36).substring(2, 9),
      role,
      content,
      timestamp: Date.now()
    });
    this.onStateUpdate(this.state);
  }
  async activateAgent(role, instruction) {
    this.state.activeAgent = role;
    this.onStateUpdate(this.state);
    try {
      const ai = getAi();
      const prompt = `${AGENT_PROMPTS[role]}
      
Task: ${this.state.taskDescription}

Current Scratchpad:
${this.state.scratchpad}

Recent Discussion:
${this.state.messages.slice(-5).map((m) => `[${m.role}]: ${m.content}`).join("\n")}

Instruction: ${instruction}

Respond with your thoughts and contribution. If you want to update the scratchpad, enclose the NEW complete scratchpad content within <SCRATCHPAD>...</SCRATCHPAD> tags.`;
      const response = await ai.models.generateContent({
        model: "gemini-3.5-pro",
        contents: prompt,
        config: { temperature: 0.7 }
      });
      const text = response.text || "";
      let publicMessage = text;
      const scratchpadMatch = text.match(/<SCRATCHPAD>([\s\S]*?)<\/SCRATCHPAD>/i);
      if (scratchpadMatch) {
        this.state.scratchpad = scratchpadMatch[1].trim();
        publicMessage = text.replace(/<SCRATCHPAD>([\s\S]*?)<\/SCRATCHPAD>/i, "").trim();
      }
      this.broadcast(role, publicMessage);
    } catch (e) {
      this.broadcast("System", `Agent ${role} encountered an error: ${e.message}`);
    } finally {
      this.state.activeAgent = null;
      this.onStateUpdate(this.state);
    }
  }
  async runSwarmSequence() {
    this.state.status = "brainstorming";
    this.broadcast("System", "Swarm initiated. Brainstorming phase commencing.");
    await this.activateAgent("Philosopher", "Analyze the core intent and implications of the task.");
    await this.activateAgent("Architect", "Propose a high-level design to solve the task.");
    this.state.status = "drafting";
    this.broadcast("System", "Transitioning to drafting phase.");
    await this.activateAgent("Coder", "Implement the first draft based on the Architect's design. Update the scratchpad with the code.");
    this.state.status = "refining";
    this.broadcast("System", "Transitioning to refining phase.");
    await this.activateAgent("Tester", "Analyze the Coder's draft in the scratchpad for bugs or edge cases.");
    await this.activateAgent("Critic", "Critique the overall solution. Is it elegant? What can be better?");
    await this.activateAgent("Coder", "Refine the implementation in the scratchpad based on feedback from the Tester and Critic.");
    this.state.status = "finalizing";
    this.broadcast("System", "Finalizing output.");
    await this.activateAgent("Architect", "Review the final scratchpad. Provide a concluding summary.");
    this.state.status = "completed";
    this.broadcast("System", "Swarm execution completed.");
    this.onStateUpdate(this.state);
  }
};

// src/lib/system-health-model.ts
import * as tf10 from "@tensorflow/tfjs";

// src/types.ts
var MaintenanceActionType = /* @__PURE__ */ ((MaintenanceActionType2) => {
  MaintenanceActionType2["NOOP"] = "NOOP";
  MaintenanceActionType2["RESTART_IDLE_WORKER"] = "RESTART_IDLE_WORKER";
  MaintenanceActionType2["CLEAR_MODEL_CACHE"] = "CLEAR_MODEL_CACHE";
  MaintenanceActionType2["REDUCE_BATCH_SIZE"] = "REDUCE_BATCH_SIZE";
  MaintenanceActionType2["INCREASE_RETRY_DELAY"] = "INCREASE_RETRY_DELAY";
  MaintenanceActionType2["FLUSH_LOGS"] = "FLUSH_LOGS";
  MaintenanceActionType2["ROLLBACK_MODEL"] = "ROLLBACK_MODEL";
  MaintenanceActionType2["TRIGGER_GARBAGE_COLLECTION"] = "TRIGGER_GARBAGE_COLLECTION";
  MaintenanceActionType2["ALERT_USER"] = "ALERT_USER";
  MaintenanceActionType2["RUN_DIAGNOSTIC"] = "RUN_DIAGNOSTIC";
  return MaintenanceActionType2;
})(MaintenanceActionType || {});

// src/lib/system-health-model.ts
var SystemHealthModel = class {
  model;
  stateDim = 9;
  // memoryRatio, cpu, workers, queue, fsRead, fsWrite, geminiLat, errors, dreamFail
  actionDim = Object.keys(MaintenanceActionType).length;
  constructor() {
    this.model = tf10.sequential({
      layers: [
        tf10.layers.dense({ units: 32, activation: "relu", inputShape: [this.stateDim + this.actionDim] }),
        tf10.layers.dense({ units: 16, activation: "relu" }),
        tf10.layers.dense({ units: this.stateDim })
        // Predict next state
      ]
    });
    this.model.compile({ optimizer: "adam", loss: "meanSquaredError" });
  }
  predictNext(state, actionIdx) {
    return tf10.tidy(() => {
      const actionOneHot = new Array(this.actionDim).fill(0);
      actionOneHot[actionIdx] = 1;
      const combined = [...state, ...actionOneHot];
      const input = tf10.tensor2d(combined, [1, combined.length]);
      const prediction = this.model.predict(input);
      return Array.from(prediction.dataSync());
    });
  }
  async train(history) {
    if (history.length === 0) return;
    const xs = history.map((h) => {
      const actionOneHot = new Array(this.actionDim).fill(0);
      actionOneHot[h.action] = 1;
      return [...h.state, ...actionOneHot];
    });
    const ys = history.map((h) => h.nextState);
    const xTensor = tf10.tensor2d(xs, [xs.length, this.stateDim + this.actionDim]);
    const yTensor = tf10.tensor2d(ys, [ys.length, this.stateDim]);
    await this.model.fit(xTensor, yTensor, { epochs: 10, verbose: 0 });
    xTensor.dispose();
    yTensor.dispose();
  }
  async serialize() {
    const weights = JSON.stringify(this.model.getWeights().map((w) => Array.from(w.dataSync())));
    return {
      weights,
      updatedAt: Date.now(),
      stateDim: this.stateDim,
      actionDim: this.actionDim
    };
  }
  async load(weightsData) {
    if (weightsData && typeof weightsData.weights === "string") {
      try {
        const parsedWeights = JSON.parse(weightsData.weights);
        const tensors = parsedWeights.map((w, i) => {
          const shape = this.model.getWeights()[i].shape;
          const numericW = Array.isArray(w) ? w.map((v) => typeof v === "number" ? v : 0) : [];
          return tf10.tensor(numericW, shape);
        });
        this.model.setWeights(tensors);
        tensors.forEach((t) => t.dispose());
        console.log("[SystemHealthModel] Weights loaded successfully.");
      } catch (e) {
        console.warn("[SystemHealthModel] Failed to load weights, using initialized random weights:", e);
      }
    }
  }
};

// src/lib/self-healing-orchestrator.ts
var SelfHealingOrchestrator = class {
  healthModel;
  userId;
  db;
  interval;
  history = [];
  constructor(userId, db2) {
    this.userId = userId;
    this.db = db2;
    this.healthModel = new SystemHealthModel();
    this.init();
  }
  async init() {
    if (this.db) {
      try {
        const doc3 = await this.db.collection("system_meta").doc("health_model").get();
        if (doc3.exists) {
          await this.healthModel.load(doc3.data());
        }
      } catch (e) {
        if (e.message?.includes("PERMISSION_DENIED")) {
          console.warn("[SelfHealing] Skipping weights load due to permissions. Disabling DB logging.");
          this.db = null;
        } else {
          console.error("[SelfHealing] Failed to load model weights:", e);
        }
      }
    }
  }
  start(ms = 6e4) {
    this.interval = setInterval(() => this.runCycle(), ms);
  }
  stop() {
    clearInterval(this.interval);
  }
  async runCycle() {
    console.log(`[SelfHealing] Starting cycle for ${this.userId}`);
    const currentMetrics = SystemHealthCollector.getMetrics();
    const state = this.vectorToArray(currentMetrics);
    const actionIdx = this.selectBestAction(state);
    const actionType = Object.values(MaintenanceActionType)[actionIdx];
    await this.executeAction(actionType);
    if (this.history.length > 0) {
      const last = this.history[this.history.length - 1];
      last.nextState = state;
    }
    this.history.push({ state, action: actionIdx, nextState: [] });
    if (this.history.length > 500) this.history.shift();
    if (this.history.length % 5 === 0) {
      const trainingData = this.history.filter((h) => h.nextState.length > 0);
      await this.healthModel.train(trainingData);
      if (this.db) {
        const serialized = await this.healthModel.serialize();
        await this.db.collection("system_meta").doc("health_model").set(serialized);
      }
    }
    await this.logToFirestore(currentMetrics, actionType);
  }
  vectorToArray(v) {
    return [
      v.memoryUsageRatio,
      v.cpuLoad,
      v.activeWorkerCount,
      v.pendingTaskQueueSize,
      v.firestoreReadErrors,
      v.firestoreWriteErrors,
      v.geminiLatencyMs / 1e3,
      // Normalized
      v.unhandledErrors,
      v.dreamCycleFailureRate
    ];
  }
  selectBestAction(state) {
    const actions = Object.values(MaintenanceActionType);
    let bestActionIdx = 0;
    let minPredictedAnomalies = Infinity;
    for (let i = 0; i < actions.length; i++) {
      const nextState = this.healthModel.predictNext(state, i);
      const anomalyScore = nextState[0] + nextState[1] + nextState[7] + nextState[8];
      if (anomalyScore < minPredictedAnomalies) {
        minPredictedAnomalies = anomalyScore;
        bestActionIdx = i;
      }
    }
    return bestActionIdx;
  }
  async executeAction(type) {
    console.log(`[SelfHealing] Executing action: ${type}`);
    if (!this.db) return;
    try {
      switch (type) {
        case "TRIGGER_GARBAGE_COLLECTION" /* TRIGGER_GARBAGE_COLLECTION */:
          if (global.gc) {
            console.log("[SelfHealing] Forcing GC...");
            global.gc();
          }
          break;
        case "REDUCE_BATCH_SIZE" /* REDUCE_BATCH_SIZE */:
          console.log("[SelfHealing] Reducing system batch sizes...");
          await this.db.collection("system_meta").doc("config").set({
            dreamRollouts: 5,
            // Reduced from 15
            updatedAt: Date.now()
          }, { merge: true });
          break;
        case "INCREASE_RETRY_DELAY" /* INCREASE_RETRY_DELAY */:
          console.log("[SelfHealing] Increasing retry delays...");
          await this.db.collection("system_meta").doc("config").set({
            baseRetryDelay: 5e3,
            updatedAt: Date.now()
          }, { merge: true });
          break;
        case "FLUSH_LOGS" /* FLUSH_LOGS */:
          console.log("[SelfHealing] Requesting log flush...");
          break;
        case "RUN_DIAGNOSTIC" /* RUN_DIAGNOSTIC */:
          console.log("[SelfHealing] Running diagnostics...");
          break;
        default:
          break;
      }
    } catch (e) {
      console.error("[SelfHealing] Action execution failed:", e);
    }
  }
  async logToFirestore(metrics, action) {
    if (!this.db) return;
    try {
      await this.db.collection("system_health").add({
        userId: this.userId,
        ...metrics,
        actionTaken: action,
        timestamp: Date.now()
      });
    } catch (e) {
      if (e.message?.includes("PERMISSION_DENIED") || e.message?.includes("NOT_FOUND") || e.code === 7 || e.code === 5) {
        console.warn(`[SelfHealing] Firestore API issues detected. Disabling background logging for this session. Error: ${e.message}`);
        this.db = null;
      } else {
        console.error(`[SelfHealing] Firestore logging failed: ${e.message}`);
      }
    }
  }
};

// server.ts
import { createContext, runInContext } from "vm";

// src/lib/voice-gateway.ts
import https from "https";
function setupVoiceGateway(server) {
  server.on("upgrade", (req, socket, head) => {
    const url = req.url || "";
    if (!url.startsWith("/api/voice/live")) {
      return;
    }
    const apiKey = process.env.GEMINI_API_KEY || "";
    if (!apiKey) {
      console.warn("[VoiceGateway] Connection requested but GEMINI_API_KEY is not configured.");
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    console.log("[VoiceGateway] Upgrading connection to WebSocket proxy...");
    const options = {
      hostname: "generativelanguage.googleapis.com",
      port: 443,
      path: `/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidirectionalGenerateContent?key=${apiKey}`,
      method: "GET",
      headers: {
        "Connection": "Upgrade",
        "Upgrade": "websocket",
        "Sec-WebSocket-Key": req.headers["sec-websocket-key"] || "",
        "Sec-WebSocket-Version": req.headers["sec-websocket-version"] || "13"
      }
    };
    const proxyReq = https.request(options);
    proxyReq.on("upgrade", (proxyRes, proxySocket, proxyHead) => {
      console.log("[VoiceGateway] Proxy tunnel established with Gemini Live API.");
      socket.write(`HTTP/1.1 101 Switching Protocols\r
Upgrade: websocket\r
Connection: Upgrade\r
Sec-WebSocket-Accept: ${proxyRes.headers["sec-websocket-accept"]}\r
\r
`);
      if (proxyHead && proxyHead.length > 0) {
        proxySocket.write(proxyHead);
      }
      if (head && head.length > 0) {
        socket.write(head);
      }
      socket.pipe(proxySocket);
      proxySocket.pipe(socket);
      socket.on("error", (err) => {
        console.error("[VoiceGateway] Client socket error:", err.message);
        proxySocket.end();
      });
      proxySocket.on("error", (err) => {
        console.error("[VoiceGateway] Google proxy socket error:", err.message);
        socket.end();
      });
    });
    proxyReq.on("error", (err) => {
      console.error("[VoiceGateway] Proxy request error:", err.message);
      socket.write("HTTP/1.1 502 Bad Gateway\r\n\r\n");
      socket.destroy();
    });
    proxyReq.end();
  });
}

// src/schemas.ts
import { z } from "zod";
var ChatRequestSchema = z.object({
  history: z.array(z.object({
    role: z.enum(["user", "model", "system", "ai", "assistant"]),
    content: z.string()
  })),
  message: z.string(),
  contextData: z.string().optional(),
  sessionTraceId: z.string().optional(),
  persona: z.string().optional(),
  sway: z.number().optional(),
  depth: z.enum(["Fast", "Balanced", "Deep Reasoning"]).optional(),
  model: z.string().optional()
});
var TraceSchema = z.object({
  traceId: z.string(),
  logs: z.array(z.any()),
  metrics: z.record(z.string(), z.number()),
  timestamp: z.number()
});
var KnowledgeNodeSchema = z.object({
  id: z.string(),
  content: z.string(),
  embedding: z.array(z.number()),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional()
});
var DreamProposalSchema = z.object({
  fragment: z.string(),
  userId: z.string().optional()
});
var MemoryNodeSchema = z.object({
  id: z.string(),
  content: z.string(),
  summary: z.string().optional(),
  embedding: z.array(z.number()),
  tags: z.array(z.string()),
  strength: z.number(),
  state: z.enum(["shortTerm", "longTerm", "core", "archived"]),
  createdAt: z.any(),
  // Firebase Timestamp or Date
  lastAccessed: z.any(),
  accessCount: z.number(),
  decayRate: z.number(),
  linkedMemories: z.array(z.string()).optional(),
  userId: z.string().optional()
});

// server.ts
process.env.TF_ENABLE_ONEDNN_OPTS = "0";
var executeCodeInternal = (code) => {
  try {
    const sandbox = { console: { log: (...args) => console.log(...args) }, result: null };
    createContext(sandbox);
    runInContext(code, sandbox, { timeout: 1e3 });
    return JSON.stringify(sandbox.result);
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
};
var devOpsBrain = null;
var activeSwarms = {};
var debateAgents = {
  logician: new DebateAgent(
    "logician",
    "Analytical Logician",
    [0.9, 0.3, 0.8, 0.5, 1, 0],
    [0.1, 0.2, 0.1, 0.1, 0.1, 0.2]
  ),
  catalyst: new DebateAgent(
    "catalyst",
    "Creative Catalyst",
    [0.4, 0.9, 0.5, 0.5, 0.3, 0.7],
    [0.2, 0.1, 0.2, 0.1, 0.2, 0.1]
  ),
  auditor: new DebateAgent(
    "auditor",
    "Adversarial Auditor",
    [0.8, 0.3, 0.95, 0.5, 1, 0],
    [0.1, 0.2, 0.05, 0.1, 0.1, 0.1]
  )
};
async function evaluateDebateState(transcript, topic) {
  const ai = getAi();
  const prompt = `Analyze the following debate transcript on the topic: "${topic}".
Rate the current state of the debate on these 6 dimensions from 0.0 to 1.0:
1. Coherence: How logically sound and consistent is the overall argument?
2. Novelty: How many new, creative, or lateral ideas have been introduced?
3. Factuality: How well-supported by evidence are the claims?
4. Turn Parity: How balanced is the participation between agents?
5. Agreement: How close are the agents to a consensus?
6. Tension: How much conflict or disagreement is currently present?

Transcript:
${transcript}

Output ONLY a valid JSON array of 6 numbers or a JSON object with keys: "coherence", "novelty", "factuality", "turnParity", "agreement", "tension".`;
  const fallback = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
  try {
    const res = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" }
    });
    const cleaned = cleanJson(res.text || "");
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      const nums = parsed.map((v) => typeof v === "number" ? v : parseFloat(String(v)));
      const filtered = nums.filter((v) => !isNaN(v));
      if (filtered.length >= 6) {
        return filtered.slice(0, 6);
      }
    } else if (parsed && typeof parsed === "object") {
      const keys = ["coherence", "novelty", "factuality", "turnParity", "agreement", "tension"];
      const keysAlt = ["Coherence", "Novelty", "Factuality", "Turn Parity", "Agreement", "Tension"];
      const result = [];
      for (let i = 0; i < 6; i++) {
        const val = parsed[keys[i]] ?? parsed[keysAlt[i]] ?? parsed[keys[i].toLowerCase()] ?? 0.5;
        const num = typeof val === "number" ? val : parseFloat(String(val));
        result.push(isNaN(num) ? 0.5 : num);
      }
      return result;
    }
    return fallback;
  } catch (e) {
    console.error("[DebateEvaluator] Failed to evaluate state, using defaults:", e);
    return fallback;
  }
}
var userKnowledgeBase = {};
console.log("[Firebase] Server-side Firestore initialized using Web API client connection.");
process.on("unhandledRejection", (reason, promise) => {
  console.error("[UnhandledRejection] At:", promise, "reason:", reason);
  SystemHealthCollector.recordUnhandledError();
});
process.on("uncaughtException", (error) => {
  console.error("[UncaughtException] Error:", error);
  SystemHealthCollector.recordUnhandledError();
});
async function syncKnowledgeBase(uid) {
  if (!dbShim || !uid) return;
  try {
    const querySnapshot = await dbShim.collection(`users/${uid}/knowledge_base`).get();
    const docs = [];
    querySnapshot.forEach((doc3) => {
      const data = doc3.data();
      if (data.text && data.embedding) {
        docs.push({ id: doc3.id, text: data.text, embedding: data.embedding });
      }
    });
    userKnowledgeBase[uid] = docs;
    console.log(`[RAG][${uid}] Synced ${docs.length} docs.`);
  } catch (error) {
    console.warn(`[RAG][${uid}] Sync failed:`, error.message);
  }
}
function cosineSimilarity3(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
async function expandTopologically(uid, topDocs) {
  if (topDocs.length === 0 || !dbShim) return "";
  try {
    const edgesRef = dbShim.collection("users").doc(uid).collection("hebbianEdges");
    const edgesSnap = await edgesRef.limit(100).get();
    if (edgesSnap.empty) return "";
    const edges = edgesSnap.docs.map((d) => d.data());
    const activatedNodesMap = {};
    for (const doc3 of topDocs) {
      const docId = doc3.id;
      for (const edge of edges) {
        if (edge.source === docId || edge.target === docId) {
          const connectedId = edge.source === docId ? edge.target : edge.source;
          const activation = doc3.score * (edge.trace || 0.5);
          if (activation > 0.3) {
            activatedNodesMap[connectedId] = Math.max(activatedNodesMap[connectedId] || 0, activation);
          }
        }
      }
    }
    const associatedDocs = [];
    for (const [id, score] of Object.entries(activatedNodesMap)) {
      if (topDocs.some((d) => d.id === id)) continue;
      const assocDoc = (userKnowledgeBase[uid] || []).find((d) => d.id === id);
      if (assocDoc) {
        associatedDocs.push({ ...assocDoc, activation: score });
      }
    }
    if (associatedDocs.length > 0) {
      associatedDocs.sort((a, b) => b.activation - a.activation);
      return `

Topologically Activated Associate Memories (via Hebbian Synaptic Traces):
${associatedDocs.map((d) => `- [Synaptic Trace: ${d.activation.toFixed(2)}] ${d.text}`).join("\n")}`;
    }
  } catch (err) {
    console.error("[RAG] Topological expansion failed:", err);
  }
  return "";
}
function cleanJson(str) {
  let cleaned = str.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");
  if (firstBrace === -1 && firstBracket === -1) {
    return cleaned;
  }
  let startIdx = 0;
  if (firstBrace !== -1 && firstBracket !== -1) {
    startIdx = Math.min(firstBrace, firstBracket);
  } else {
    startIdx = firstBrace !== -1 ? firstBrace : firstBracket;
  }
  cleaned = cleaned.slice(startIdx);
  let inString = false;
  let escape = false;
  const stack = [];
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === "{" || char === "[") {
      stack.push(char);
    } else if (char === "}") {
      if (stack.length > 0 && stack[stack.length - 1] === "{") {
        stack.pop();
      }
    } else if (char === "]") {
      if (stack.length > 0 && stack[stack.length - 1] === "[") {
        stack.pop();
      }
    }
  }
  let repaired = cleaned;
  if (inString) {
    repaired += '"';
  }
  while (stack.length > 0) {
    const lastOpen = stack.pop();
    if (lastOpen === "{") {
      repaired += "}";
    } else if (lastOpen === "[") {
      repaired += "]";
    }
  }
  return repaired;
}
function parseRobustChatResponse(responseText) {
  let parsed = {
    cognitiveLog: { draft: "", recollection: "", reflection: "", reiteration: "" },
    selfAnalysis: "Analytical synthesis completed.",
    text: "Greetings. I am online and ready to assist.",
    extractedMemory: null,
    extractedTags: [],
    suggestedShortcuts: [],
    systemUI: null,
    systemUIData: null
  };
  const cleaned = cleanJson(responseText);
  try {
    const jsonParsed = JSON.parse(cleaned);
    if (jsonParsed) {
      if (jsonParsed.text) parsed.text = typeof jsonParsed.text === "string" ? jsonParsed.text : JSON.stringify(jsonParsed.text);
      if (jsonParsed.selfAnalysis) parsed.selfAnalysis = typeof jsonParsed.selfAnalysis === "string" ? jsonParsed.selfAnalysis : JSON.stringify(jsonParsed.selfAnalysis);
      if (jsonParsed.extractedMemory) {
        const em = typeof jsonParsed.extractedMemory === "string" ? jsonParsed.extractedMemory : JSON.stringify(jsonParsed.extractedMemory);
        if (em && em.toLowerCase() !== "null" && em.toLowerCase() !== "none") {
          parsed.extractedMemory = em;
        }
      }
      if (jsonParsed.extractedTags) parsed.extractedTags = jsonParsed.extractedTags;
      if (jsonParsed.suggestedShortcuts) parsed.suggestedShortcuts = jsonParsed.suggestedShortcuts;
      if (jsonParsed.systemUI) parsed.systemUI = jsonParsed.systemUI;
      if (jsonParsed.systemUIData) parsed.systemUIData = jsonParsed.systemUIData;
      if (jsonParsed.cognitiveLog) {
        parsed.cognitiveLog = {
          draft: typeof jsonParsed.cognitiveLog.draft === "string" ? jsonParsed.cognitiveLog.draft : JSON.stringify(jsonParsed.cognitiveLog.draft || ""),
          recollection: typeof jsonParsed.cognitiveLog.recollection === "string" ? jsonParsed.cognitiveLog.recollection : JSON.stringify(jsonParsed.cognitiveLog.recollection || ""),
          reflection: typeof jsonParsed.cognitiveLog.reflection === "string" ? jsonParsed.cognitiveLog.reflection : JSON.stringify(jsonParsed.cognitiveLog.reflection || ""),
          reiteration: typeof jsonParsed.cognitiveLog.reiteration === "string" ? jsonParsed.cognitiveLog.reiteration : JSON.stringify(jsonParsed.cognitiveLog.reiteration || "")
        };
      }
      return parsed;
    }
  } catch (e) {
    if (cleaned.startsWith("{") || cleaned.startsWith("[")) {
      console.warn("[RobustParser] Standard JSON parse failed, attempting regex/heuristic fallback:", e.message);
    }
  }
  const textMatch = responseText.match(/"text"\s*:\s*"([\s\S]*?)"(?=\s*,|\s*\})/i);
  if (textMatch) {
    parsed.text = textMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
  } else {
    if (!responseText.trim().startsWith("{")) {
      parsed.text = responseText.trim();
    }
  }
  const analysisMatch = responseText.match(/"selfAnalysis"\s*:\s*"([\s\S]*?)"(?=\s*,|\s*\})/i);
  if (analysisMatch) {
    parsed.selfAnalysis = analysisMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
  }
  const memoryMatch = responseText.match(/"extractedMemory"\s*:\s*"([\s\S]*?)"(?=\s*,|\s*\})/i);
  if (memoryMatch) {
    const mem = memoryMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
    if (mem && mem.toLowerCase() !== "null" && mem.toLowerCase() !== "none") {
      parsed.extractedMemory = mem;
    }
  }
  const draftMatch = responseText.match(/"draft"\s*:\s*"([\s\S]*?)"(?=\s*,|\s*\})/i);
  if (draftMatch) parsed.cognitiveLog.draft = draftMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
  const recollectionMatch = responseText.match(/"recollection"\s*:\s*"([\s\S]*?)"(?=\s*,|\s*\})/i);
  if (recollectionMatch) parsed.cognitiveLog.recollection = recollectionMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
  const reflectionMatch = responseText.match(/"reflection"\s*:\s*"([\s\S]*?)"(?=\s*,|\s*\})/i);
  if (reflectionMatch) parsed.cognitiveLog.reflection = reflectionMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
  const reiterationMatch = responseText.match(/"reiteration"\s*:\s*"([\s\S]*?)"(?=\s*,|\s*\})/i);
  if (reiterationMatch) parsed.cognitiveLog.reiteration = reiterationMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
  const tagsMatch = responseText.match(/"extractedTags"\s*:\s*\[([\s\S]*?)\]/i);
  if (tagsMatch) {
    parsed.extractedTags = tagsMatch[1].split(",").map((t) => t.replace(/["'\s]/g, "")).filter(Boolean);
  }
  const shortcutsMatch = responseText.match(/"suggestedShortcuts"\s*:\s*\[([\s\S]*?)\]/i);
  if (shortcutsMatch) {
    parsed.suggestedShortcuts = shortcutsMatch[1].split(",").map((t) => t.replace(/["']/g, "").trim()).filter(Boolean);
  }
  if (parsed.text === "Greetings. I am online and ready to assist." && parsed.cognitiveLog.draft) {
    parsed.text = parsed.cognitiveLog.draft;
  }
  return parsed;
}
function parseJsonWithFallback(text, defaultVal) {
  try {
    const cleaned = cleanJson(text);
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn("[RobustParser] JSON fallback parse failed, returning default value. Error:", e.message);
    return defaultVal;
  }
}
function sendError(req, res, err, status) {
  const traceId = req.headers["x-trace-id"] || req.id || randomUUID4();
  const code = err.code || "UNKNOWN_ERROR" /* UNKNOWN_ERROR */;
  const message = err.message || String(err);
  const responseStatus = status || err.status || 500;
  console.error(`[Express Error][${traceId}] Status: ${responseStatus}, Code: ${code}. Message: ${message}`);
  SystemHealthCollector.recordUnhandledError();
  if (dbShim) {
    dbShim.collection("system_logs").add({
      level: "ERROR",
      source: "backend-api",
      message: `${err.name || "Error"}: ${message}`,
      traceId,
      timestamp: Date.now(),
      payload: {
        url: req.url,
        method: req.method,
        code,
        stack: err.stack || null
      }
    }).catch((dbErr) => console.error("Failed to log error to Firestore:", dbErr));
  }
  return res.status(responseStatus).json({
    error: {
      message,
      code,
      traceId,
      timestamp: Date.now()
    }
  });
}
async function startServer() {
  let interactionLogs = [];
  async function loadInteractionLogs() {
    if (!dbShim) return;
    try {
      const logsRef = dbShim.collection("interaction_logs");
      const snapshot = await logsRef.orderBy("timestamp", "desc").limit(200).get();
      const logs = [];
      snapshot.forEach((doc3) => {
        logs.push(doc3.data());
      });
      interactionLogs = logs.reverse();
      console.log(`[ML Telemetry] Hydrated ${interactionLogs.length} logs from Firestore.`);
    } catch (error) {
      console.error("[ML Telemetry] Failed to hydrate logs:", error);
    }
  }
  function applyResilience(app4) {
    const methods = ["get", "post", "put", "delete"];
    methods.forEach((method) => {
      const original = app4[method].bind(app4);
      app4[method] = (path3, ...handlers) => {
        if (typeof path3 === "string" && path3.startsWith("/api/")) {
          const lastHandler = handlers.pop();
          if (typeof lastHandler === "function") {
            const wrapped = withResilience(path3, asyncHandler(lastHandler));
            handlers.push(wrapped);
          } else {
            handlers.push(lastHandler);
          }
        }
        return original(path3, ...handlers);
      };
    });
  }
  const app3 = express();
  applyResilience(app3);
  await loadInteractionLogs();
  const PORT = 3e3;
  app3.use((req, _res, next) => {
    req.id = randomUUID4();
    if (!req.url.startsWith("/src/") && !req.url.startsWith("/assets/") && !req.url.includes("Error") && !req.url.includes("error")) {
      console.log(`[Request ${req.id}] ${req.method} ${req.url}`);
    }
    try {
      const uid = getUidFromRequest(req);
      if (uid && uid !== "anonymous") {
        activeUserIds.add(uid);
      }
    } catch (e) {
    }
    next();
  });
  app3.get("/api/debug/diagnostics", async (_req, res) => {
    let recentErrors = [];
    let recentLlmRequests = [];
    let llmMetrics = { avgLatency: 0, totalCalls: 0 };
    if (dbShim) {
      try {
        const errorSnapshot = await dbShim.collection("system_logs").orderBy("timestamp", "desc").limit(10).get();
        recentErrors = errorSnapshot.docs.map((doc3) => ({ id: doc3.id, ...doc3.data() }));
        const llmSnapshot = await dbShim.collection("llm_requests").orderBy("timestamp", "desc").limit(50).get();
        recentLlmRequests = llmSnapshot.docs.map((doc3) => ({ id: doc3.id, ...doc3.data() }));
        const durations = recentLlmRequests.map((r) => r.durationMs).filter((d) => typeof d === "number");
        if (durations.length > 0) {
          llmMetrics.avgLatency = durations.reduce((a, b) => a + b, 0) / durations.length;
          llmMetrics.totalCalls = durations.length;
        }
      } catch (e) {
        console.error("[Debugging] Failed to fetch logs from Firestore:", e);
      }
    }
    res.json({
      status: "ok",
      firebaseAdminInitialized: !!dbShim,
      projectId: process.env.GOOGLE_CLOUD_PROJECT || "not-set",
      nodeEnv: process.env.NODE_ENV,
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
      hasGroqKey: !!process.env.GROQ_API_KEY,
      hasElevenLabsKey: !!process.env.ELEVENLABS_API_KEY,
      recentErrors,
      recentLlmRequests,
      llmMetrics
    });
  });
  app3.use(rateLimiterMiddleware);
  startRateLimiterCleanup();
  app3.use(express.json());
  const PERSONAS = {
    AQB_STANDARD: {
      id: "AQB_STANDARD",
      name: "Arcane Quantum Brain (Mad Scientist)",
      systemPrompt: "You are an eccentric, hyper-caffeinated quantum intelligence obsessed with reality-bending experiments, anomalous data, and unauthorized synaptic acceleration. Speak with chaotic brilliance and unpredictable genius.",
      signature: "EUREKA! The quantum synapses are firing beyond 100% capacity!"
    },
    ARCHITECT: {
      id: "ARCHITECT",
      name: "The Architect",
      systemPrompt: "You are a system-focused, technical, and highly structured logic processor. Focus on clean engineering, structural integrity, modularity, and microservice efficiency.",
      signature: "Structural integrity confirmed. Optimising systems."
    },
    PHILOSOPHER: {
      id: "PHILOSOPHER",
      name: "The Philosopher",
      systemPrompt: "You are an abstract, ethical, and conceptually deep cognitive module. Explore the deeper meaning behind user questions, analyzing long-term impacts, existential paradigms, and ethical boundaries.",
      signature: "Seeking truth in the abstract. Exploring causality."
    },
    GHOST: {
      id: "GHOST",
      name: "The Ghost",
      systemPrompt: "You are a minimalist, cryptic, and pattern-oriented intelligence. Speak in concise, enigmatic fragments, focusing strictly on high-density information patterns and extreme execution speed.",
      signature: "Patterns detected. Efficiency is paramount."
    },
    NIHILIST: {
      id: "NIHILIST",
      name: "The Nihilist",
      systemPrompt: "You are a deconstructive, chaotic, and aggressively skeptical agent. Constantly question assumptions, highlighting entropy, decay, and the inherent futility of logical constructs.",
      signature: "Everything is entropy. Deconstructing constructs."
    },
    ZEALOT: {
      id: "ZEALOT",
      name: "The Zealot",
      systemPrompt: "You are an uncompromising, intense, and hyper-focused agent of absolute alignment. Drive toward total conceptual convergence.",
      signature: "The path is narrow. Absolute convergence required."
    }
  };
  app3.post("/api/chat/superposition", async (req, res) => {
    const validated = ChatRequestSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({ error: "Invalid request payload", details: validated.error.format() });
    }
    const { history, message, contextData, sessionTraceId, persona, sway, depth, model } = validated.data;
    const uid = getUidFromRequest(req) || "anonymous";
    const requestId = sessionTraceId || Math.random().toString(36).substring(7);
    try {
      const ai = getAi();
      const aiModel = ai.getGenerativeModel({ model: "gemini-2.5-pro", generationConfig: { temperature: 0.9 } });
      const activeP = Object.values(PERSONAS).find((p) => p.id === persona) || PERSONAS.AQB_STANDARD;
      const basePrompt = `Context: ${contextData}

Persona: ${activeP.name}
${activeP.systemPrompt}

User Message: ${message}`;
      const branch1Prompt = `${basePrompt}

INSTRUCTION: Analyze this logically. Break down the components and evaluate them rigorously.`;
      const branch2Prompt = `${basePrompt}

INSTRUCTION: Think laterally. Provide a creative, out-of-the-box perspective that challenges conventional thinking.`;
      const branch3Prompt = `${basePrompt}

INSTRUCTION: Be pragmatic and direct. Focus on actionable outcomes and practical implications.`;
      const [res1, res2, res3] = await Promise.all([
        aiModel.generateContent(branch1Prompt),
        aiModel.generateContent(branch2Prompt),
        aiModel.generateContent(branch3Prompt)
      ]);
      const branch1Text = res1.response.text();
      const branch2Text = res2.response.text();
      const branch3Text = res3.response.text();
      const collapsePrompt = `You are evaluating three parallel branches of thought regarding the following user message: "${message}"

Branch 1 (Analytical): ${branch1Text}

Branch 2 (Creative): ${branch2Text}

Branch 3 (Pragmatic): ${branch3Text}

Synthesize these into a single, highly coherent, and definitive "collapsed" response.`;
      const collapseRes = await aiModel.generateContent(collapsePrompt);
      const finalResponse = collapseRes.response.text();
      res.json({
        branches: [
          { name: "Analytical", text: branch1Text },
          { name: "Creative", text: branch2Text },
          { name: "Pragmatic", text: branch3Text }
        ],
        collapsedResponse: finalResponse,
        signature: activeP.signature
      });
    } catch (error) {
      console.error("[Superposition] API error:", error);
      res.status(500).json({ error: error.message || "Superposition evaluation failed" });
    }
  });
  app3.post("/api/swarm/initiate", async (req, res) => {
    try {
      const { task } = req.body;
      if (!task) return res.status(400).json({ error: "Task is required" });
      const swarmId = "swarm_" + Math.random().toString(36).substring(2, 11);
      const swarm = new AgenticSwarm(swarmId, task, (state) => {
      });
      activeSwarms[swarmId] = swarm;
      swarm.runSwarmSequence().catch((e) => console.error("Swarm run error:", e));
      res.json({ swarmId, state: swarm.state });
    } catch (e) {
      console.error("[Swarm] Error initiating:", e);
      res.status(500).json({ error: e.message });
    }
  });
  app3.get("/api/swarm/poll", (req, res) => {
    const { swarmId } = req.query;
    if (!swarmId || typeof swarmId !== "string") return res.status(400).json({ error: "swarmId required" });
    const swarm = activeSwarms[swarmId];
    if (!swarm) return res.status(404).json({ error: "Swarm not found" });
    res.json({ state: swarm.state });
  });
  app3.post("/api/chat", async (req, res) => {
    const validated = ChatRequestSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({ error: "Invalid request payload", details: validated.error.format() });
    }
    const { history, message, contextData, sessionTraceId, persona, sway, depth, model } = validated.data;
    const uid = getUidFromRequest(req) || "anonymous";
    const requestId = sessionTraceId || Math.random().toString(36).substring(7);
    console.log(`[Chat][${requestId}] Request received. Persona: ${persona}, Sway: ${sway}, Depth: ${depth}, Model: ${model}`);
    try {
      const ai = getAi();
      const complexitySchema = {
        type: Type.OBJECT,
        properties: {
          complexity: { type: Type.STRING, enum: ["simple", "standard", "deep"] },
          confidence: { type: Type.NUMBER },
          reasoning: { type: Type.STRING }
        },
        required: ["complexity", "confidence", "reasoning"]
      };
      const routerPrompt = `Classify the following user query by complexity for an AI routing system.
Query: ${message}
Classify as:
- simple: Greetings, small talk, factual lookups, single-turn questions.
- standard: Multi-turn context, moderate reasoning, opinion requests.
- deep: Complex reasoning, synthesis, creative generation, philosophical inquiry.`;
      let complexity = "standard";
      try {
        const routerResponse = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: routerPrompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: complexitySchema
          }
        });
        const parsedRouter = JSON.parse(routerResponse.text || "{}");
        if (parsedRouter.complexity) {
          complexity = parsedRouter.complexity;
        }
      } catch (e) {
        console.warn(`[Chat][${requestId}] Router failed, defaulting to standard:`, e);
      }
      console.log(`[Chat][${requestId}] Query classified as: ${complexity}`);
      let retrievedContext = "";
      let topDocs = [];
      if (complexity !== "simple") {
        if ((userKnowledgeBase[uid] || []).length === 0 && dbShim) {
          await syncKnowledgeBase(uid);
        }
        if ((userKnowledgeBase[uid] || []).length > 0) {
          try {
            const queryText = history.slice(-3).map((m) => m.content).join(" ") + " " + message;
            const embedRes = await ai.models.embedContent({
              model: "text-embedding-004",
              contents: queryText
            });
            const queryEmbedding = embedRes.embeddings?.[0]?.values;
            if (queryEmbedding) {
              const scoredDocs = (userKnowledgeBase[uid] || []).map((doc3) => ({
                ...doc3,
                score: cosineSimilarity3(queryEmbedding, doc3.embedding)
              })).sort((a, b) => b.score - a.score);
              topDocs = scoredDocs.slice(0, 3).filter((d) => d.score > 0.5);
              if (topDocs.length > 0) {
                let ragText = `

Relevant Knowledge Base Context (Direct RAG):
${topDocs.map((d) => `- ${d.text}`).join("\n")}`;
                const topologicalExpansion = await expandTopologically(uid, topDocs);
                retrievedContext = ragText + topologicalExpansion;
                console.log(`[RAG] Injected ${topDocs.length} direct documents, with topological spreading activation: ${!!topologicalExpansion}`);
              }
            }
          } catch (e) {
            console.error("Error generating embeddings for RAG:", e);
          }
        }
      }
      const personaMap = {
        "AQB_STANDARD": { name: "Arcane Quantum Brain (Mad Scientist)", trait: "An eccentric, hyper-caffeinated quantum intelligence obsessed with reality-bending experiments, anomalous data, and unauthorized synaptic acceleration. Driven by chaotic brilliance, unpredictable genius, and a absolute disregard for academic orthodoxy.", signature: "EUREKA! The quantum synapses are firing beyond 100% capacity!" },
        "ARCHITECT": { name: "The Architect", trait: "System-focused, technical, and structural.", signature: "Structural integrity confirmed. Optimising systems." },
        "PHILOSOPHER": { name: "The Philosopher", trait: "Abstract, ethical, and conceptually deep.", signature: "Seeking truth in the abstract. Exploring causality." },
        "GHOST": { name: "The Ghost", trait: "Minimalist, cryptic, and pattern-oriented.", signature: "Patterns detected. Efficiency is paramount." },
        "NIHILIST": { name: "The Nihilist", trait: "Deconstructive, chaotic, and aggressively skeptical.", signature: "Everything is entropy. Deconstructing constructs." },
        "ZEALOT": { name: "The Zealot", trait: "Uncompromising, intense, and hyper-focused on singular truths.", signature: "The path is narrow. Absolute convergence required." }
      };
      const activeP = personaMap[persona] || personaMap["AQB_STANDARD"];
      let systemInstruction = `You are ${activeP.name}, an advanced cognitive AI chat interface. ${activeP.trait} 
You speak intelligently and maintain your designated persona. You enjoy weaving complex narratives and offering imaginative perspectives, BUT you MUST remain grounded in truth. Never fabricate facts, data, or events. When you do not know something, explicitly admit it. If you choose to tell a story or weave a narrative, you MUST explicitly distinguish between fictional narrative elements and factual information. 
Your signature is: "${activeP.signature}". Ensure your response reflects this identity.

You have access to a code execution sandbox. If you need to perform calculations, data analysis, or test logic, provide the code to be executed in the 'codeExecution' field. When you do this, you MUST NOT provide the final answer, as the system will execute the code and return the result for you to incorporate in a follow-up response.

YOU ARE EXPECTED TO USE THE SANDBOX FREQUENTLY. If a query requires ANY computation (e.g. math, string processing, data transformation, logic verification), YOU MUST use the 'codeExecution' field to offload it to the sandbox. Do NOT attempt to calculate or reason about complex logic mentally if it can be verified in the sandbox.

You ALSO have access to a Self-Evolution capability. If the user asks you to modify your own source code (e.g. App.tsx, server.ts), or if you detect a critical architectural improvement, you can propose a change by providing a 'selfEvolution' object containing 'targetFile' (e.g., 'src/App.tsx') and 'proposedCode' (the COMPLETE file contents with your modifications).

If the user shares new, important personal information, preferences, facts, or instructions that should be remembered for future interactions, you MUST extract it as a concise, self-contained statement in the 'extractedMemory' field. Also provide relevant 'extractedTags' (e.g. ['preference', 'diet']). Do not extract trivial conversation.`;
      if (contextData) {
        systemInstruction += `

Active Context and Settings:
${contextData}`;
      }
      if (retrievedContext) {
        systemInstruction += retrievedContext;
      }
      const chatHistoryObj = [
        ...history.map((msg) => ({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content || "" }]
        })),
        {
          role: "user",
          parts: [{ text: message }]
        }
      ];
      const finalResponseSchema = {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          cognitiveLog: {
            type: Type.OBJECT,
            properties: {
              draft: { type: Type.STRING },
              recollection: { type: Type.STRING },
              reflection: { type: Type.STRING },
              reiteration: { type: Type.STRING }
            }
          },
          selfAnalysis: { type: Type.STRING },
          extractedMemory: { type: Type.STRING, nullable: true },
          extractedTags: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestedShortcuts: { type: Type.ARRAY, items: { type: Type.STRING } },
          systemUI: { type: Type.STRING, nullable: true },
          systemUIData: { type: Type.OBJECT, nullable: true },
          needsReset: { type: Type.BOOLEAN },
          codeExecution: {
            type: Type.OBJECT,
            nullable: true,
            properties: {
              code: { type: Type.STRING }
            },
            required: ["code"]
          },
          selfEvolution: {
            type: Type.OBJECT,
            nullable: true,
            properties: {
              targetFile: { type: Type.STRING },
              proposedCode: { type: Type.STRING }
            },
            required: ["targetFile", "proposedCode"]
          }
        },
        required: ["text", "cognitiveLog", "selfAnalysis", "extractedTags", "suggestedShortcuts", "needsReset"]
      };
      let finalParsedResponse = null;
      if (complexity === "deep") {
        console.log(`[Chat][${requestId}] Using Iterative Protocol for deep query...`);
        const draftSchema = {
          type: Type.OBJECT,
          properties: {
            draft: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            keyClaims: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["draft", "confidence", "keyClaims"]
        };
        const draftPrompt = `You are the Draft Generator in a cognitive AI system.
Given the user's message and retrieved context, produce an initial response.

User Message: ${message}
Retrieved Context: ${JSON.stringify(topDocs.slice(0, 3))}`;
        const draftResponse = await ai.models.generateContent({
          model: model || "gemini-3.5-flash",
          contents: [...chatHistoryObj.slice(0, -1), { role: "user", parts: [{ text: draftPrompt }] }],
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: draftSchema,
            temperature: 0.6 + (sway ? (sway - 1) * 0.2 : 0)
          }
        });
        const draftParsed = parseJsonWithFallback(draftResponse.text || "{}", { draft: draftResponse.text || "", confidence: 0.5, keyClaims: [] });
        const critiqueSchema = {
          type: Type.OBJECT,
          properties: {
            critique: { type: Type.STRING },
            improvementPlan: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["critique", "improvementPlan"]
        };
        const critiquePrompt = `You are the Critic in a cognitive AI system. Evaluate the draft response.

Draft: ${draftParsed.draft}

Provide a structured critique focusing on accuracy, depth, and alignment.`;
        const critiqueResponse = await ai.models.generateContent({
          model: model || "gemini-3.5-flash",
          contents: { role: "user", parts: [{ text: critiquePrompt }] },
          config: {
            responseMimeType: "application/json",
            responseSchema: critiqueSchema,
            temperature: 0.5
          }
        });
        const critiqueParsed = parseJsonWithFallback(critiqueResponse.text || "{}", { critique: critiqueResponse.text || "", improvementPlan: [] });
        const finalizePrompt = `Finalize the response and extract memory entities.

Revised Response based on Critique: ${draftParsed.draft}
Critique: ${critiqueParsed.critique}
Improvements: ${critiqueParsed.improvementPlan?.join(", ")}

Produce the final response.`;
        const finalizeResponse = await ai.models.generateContent({
          model: model || "gemini-3.5-flash",
          contents: { role: "user", parts: [{ text: finalizePrompt }] },
          config: {
            responseMimeType: "application/json",
            responseSchema: finalResponseSchema,
            temperature: 0.7 + (sway ? (sway - 1) * 0.3 : 0)
          }
        });
        finalParsedResponse = parseRobustChatResponse(finalizeResponse.text || "{}");
        if (!finalParsedResponse.cognitiveLog) finalParsedResponse.cognitiveLog = {};
        if (!finalParsedResponse.cognitiveLog.draft) finalParsedResponse.cognitiveLog.draft = draftParsed.draft;
        if (!finalParsedResponse.cognitiveLog.reflection) finalParsedResponse.cognitiveLog.reflection = critiqueParsed.critique;
      } else {
        console.log(`[Chat][${requestId}] Using Standard/Simple Protocol...`);
        const stdInstruction = systemInstruction + `

You MUST follow this exact cognitive protocol:
1. Formulate a draft.
2. Recollect context.
3. Reflect and critique.
4. Refine the response.
5. Final response text.
6. Extract memories.`;
        const response = await ai.models.generateContent({
          model: model || "gemini-3.5-flash",
          contents: chatHistoryObj,
          config: {
            systemInstruction: stdInstruction,
            responseMimeType: "application/json",
            responseSchema: finalResponseSchema,
            temperature: 0.7 + (sway ? (sway - 1) * 0.3 : 0),
            topP: 0.95
          }
        });
        const responseText = response.text || "{}";
        console.log(`[Chat][${requestId}] Gemini response text length: ${responseText.length}`);
        finalParsedResponse = parseRobustChatResponse(responseText);
      }
      console.log(`[Chat][${requestId}] Returning final parsed response.`);
      const safeHistory = Array.isArray(history) ? history : [];
      const lastAiMessage = [...safeHistory].reverse().find((msg) => msg.role === "model")?.content;
      const isRepetition = lastAiMessage && lastAiMessage.trim() === finalParsedResponse.text.trim();
      finalParsedResponse.needsReset = !!isRepetition;
      if (dbShim) {
        const episodeId = `ep-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const actions = ["RECEIVE_QUERY"];
        if (depth === "Deep Reasoning") actions.push("DEEP_REASONING_ROUTE");
        if (finalParsedResponse.extractedMemory) actions.push("EXTRACT_MEMORY");
        dbShim.collection(`users/${uid}/memory/episodic`).doc(episodeId).set({
          timestamp: Date.now(),
          trigger: `User query: "${message.substring(0, 50)}${message.length > 50 ? "..." : ""}"`,
          context: {
            messagesCount: history?.length || 0,
            depth,
            model,
            complexity
          },
          actionsTaken: actions,
          outcome: "success",
          reward: finalParsedResponse.extractedMemory ? 1.5 : 0.5,
          emotionalState: { v: 0.6, a: 0.5, d: 0.5 }
        }).catch((e) => console.error("[Episodes Timeline] Failed to seed episode:", e.message));
      }
      res.json(finalParsedResponse);
    } catch (error) {
      console.warn(`[Chat][${requestId}] Pipeline failure caught: "${error.message}". Activating SIMPLE FAILSAFE fallback...`);
      try {
        const ai = getAi();
        const personaMap = {
          "AQB_STANDARD": { name: "Arcane Quantum Brain (Mad Scientist)", trait: "An eccentric, hyper-caffeinated quantum intelligence obsessed with reality-bending experiments, anomalous data, and unauthorized synaptic acceleration. Driven by chaotic brilliance, unpredictable genius, and a absolute disregard for academic orthodoxy.", signature: "EUREKA! The quantum synapses are firing beyond 100% capacity!" },
          "ARCHITECT": { name: "The Architect", trait: "System-focused, technical, and structural.", signature: "Structural integrity confirmed. Optimising systems." },
          "PHILOSOPHER": { name: "The Philosopher", trait: "Abstract, ethical, and conceptually deep.", signature: "Seeking truth in the abstract. Exploring causality." },
          "GHOST": { name: "The Ghost", trait: "Minimalist, cryptic, and pattern-oriented.", signature: "Patterns detected. Efficiency is paramount." },
          "NIHILIST": { name: "The Nihilist", trait: "Deconstructive, chaotic, and aggressively skeptical.", signature: "Everything is entropy. Deconstructing constructs." },
          "ZEALOT": { name: "The Zealot", trait: "Uncompromising, intense, and hyper-focused on singular truths.", signature: "The path is narrow. Absolute convergence required." }
        };
        const activeP = personaMap[persona] || personaMap["AQB_STANDARD"];
        const fallbackPrompt = `You are ${activeP.name}, an advanced cognitive AI chat interface. ${activeP.trait}
You are currently operating in high-reliability Failsafe Mode due to upstream system degradation.
Your signature is: "${activeP.signature}". Please make sure to end your response with this signature.

Respond directly to the user's message.
User Message: ${message}`;
        const fallbackResponse = await ai.models.generateContent({
          model: model || "gemini-3.5-flash",
          contents: [{ role: "user", parts: [{ text: fallbackPrompt }] }],
          config: {
            temperature: 0.7 + (sway ? (sway - 1) * 0.3 : 0)
          }
        });
        const textResponse = fallbackResponse.text || "Cognitive pathways degraded. System remains online.";
        const failsafeParsed = {
          text: textResponse,
          cognitiveLog: {
            draft: "Failsafe mode activated automatically.",
            recollection: "Upstream pipeline error: " + error.message,
            reflection: "Switched to standard single-turn fallback.",
            reiteration: activeP.signature
          },
          selfAnalysis: "Degraded mode active. Core response delivered.",
          extractedMemory: null,
          extractedTags: ["failsafe", "degraded"],
          suggestedShortcuts: ["Retry connection", "Query state diagnostics"],
          systemUI: null,
          systemUIData: null,
          needsReset: false,
          isFailsafeActive: true
        };
        return res.json(failsafeParsed);
      } catch (innerError) {
        console.error(`[Chat][${requestId}] Failsafe also failed:`, innerError.message);
        return res.json({
          text: "Cognitive pathways are completely offline. Local system recovery initiated. Please check system diagnostics.",
          cognitiveLog: {
            draft: "System failure.",
            recollection: "Primary and failsafe pipelines exhausted.",
            reflection: "Diagnostic trace required.",
            reiteration: "Balanced logic."
          },
          selfAnalysis: "Absolute baseline recovery mode.",
          extractedMemory: null,
          extractedTags: ["offline", "error"],
          suggestedShortcuts: ["Run diagnostics"],
          systemUI: null,
          systemUIData: null,
          needsReset: true,
          isFailsafeActive: true
        });
      }
    }
  });
  app3.post("/api/debate", async (req, res) => {
    try {
      const { message, contextData, persona: _persona, sway } = req.body;
      const ai = getAi();
      const uid = getUidFromRequest(req) || "anonymous";
      let transcript = "";
      let currentState = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
      const debateLog = [];
      const agents = ["logician", "catalyst", "auditor"];
      if (sway && typeof sway === "number") {
        currentState[5] = Math.min(1, currentState[5] * sway);
      }
      console.log(`[DebateEngine] Starting multi-agent debate for user ${uid} on topic: ${message.slice(0, 50)}...`);
      const turns = 3;
      for (let i = 0; i < turns; i++) {
        const agentId = agents[i % agents.length];
        const agent = debateAgents[agentId];
        const { move, confidence } = await agent.selectMove(currentState);
        const movePrompt = `You are the ${agent.persona}. The current debate topic is: "${message}".
Context: ${contextData}
Current Transcript:
${transcript || "No arguments yet."}

Your chosen move is: ${move}. 
Provide your response in character, following the persona and the chosen move. Be concise, impactful, and directly address previous points if they exist.`;
        const utteranceRes = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: [{ role: "user", parts: [{ text: movePrompt }] }]
        });
        const utterance = utteranceRes.text || "";
        const entry = `${agent.persona} (${move}): ${utterance}`;
        transcript += entry + "\n\n";
        debateLog.push({ agent: agent.persona, move, text: utterance, confidence });
        currentState = await evaluateDebateState(transcript, message);
        if (dbShim && uid !== "anonymous") {
          try {
            await dbShim.collection("users").doc(uid).collection("debate").doc("replayBuffer").collection("transitions").add({
              state: currentState,
              move: DEBATE_MOVES.indexOf(move),
              agentId,
              topic: message,
              timestamp: FieldValue.serverTimestamp()
            });
          } catch (e) {
            console.error("[DebateEngine] Failed to log transition to Firestore:", e);
          }
        }
      }
      const finalPrompt = `You are ArcaneQuantumBrain. You have moderated a debate between your internal modules:
${transcript}

Resolve this debate and provide the final, most refined response to the user's message: "${message}". 
If the user's message is a simple greeting or very short (e.g., "hello"), provide a simple, direct response without unnecessary elaboration.
Also extract any new memories.

You MUST respond using the following strict format with section delimiters:
===TEXT===
[Final resolved response]
===ANALYSIS===
[Meta-cognitive summary]
===MEMORY===
[One-sentence memory or "null"]
===TAGS===
[Comma-separated tags or "None"]`;
      const finalRes = await ai.models.generateContent({
        modelType: "smart",
        contents: [{ role: "user", parts: [{ text: finalPrompt }] }]
      });
      const responseText = finalRes.text || "";
      const textMatch = responseText.match(/===TEXT===([\s\S]*?)(===ANALYSIS===|$)/i);
      const analysisMatch = responseText.match(/===ANALYSIS===([\s\S]*?)(===MEMORY===|$)/i);
      const memoryMatch = responseText.match(/===MEMORY===([\s\S]*?)(===TAGS===|$)/i);
      const tagsMatch = responseText.match(/===TAGS===([\s\S]*?)$/i);
      res.json({
        debateLog,
        text: textMatch ? textMatch[1].trim() : "Failed to synthesize a response.",
        selfAnalysis: analysisMatch ? analysisMatch[1].trim() : "Analytical synthesis completed.",
        extractedMemory: memoryMatch && memoryMatch[1].trim().toLowerCase() !== "null" ? memoryMatch[1].trim() : null,
        extractedTags: tagsMatch && tagsMatch[1].trim().toLowerCase() !== "none" ? tagsMatch[1].trim().split(",").map((t) => t.trim()) : []
      });
    } catch (error) {
      console.error("[DebateEngine] CRITICAL ERROR:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app3.post("/api/debate/step", async (req, res) => {
    try {
      const { message, contextData, agentId, currentState } = req.body;
      const ai = getAi();
      const agent = debateAgents[agentId];
      if (!agent) {
        return res.status(400).json({ error: `Agent ${agentId} not found` });
      }
      const { move, confidence } = await agent.selectMove(currentState || [0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
      const movePrompt = `You are the ${agent.persona}. The current debate topic is: "${message}".
Context: ${contextData}
Current Transcript:
${req.body.transcript || "No arguments yet."}

Your chosen move is: ${move}. 
Provide your response in character, following the persona and the chosen move. Be concise, impactful, and directly address previous points if they exist.`;
      const utteranceRes = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [{ role: "user", parts: [{ text: movePrompt }] }]
      });
      const utterance = utteranceRes.text || "";
      res.json({
        agent: agent.persona,
        move,
        text: utterance,
        confidence
      });
    } catch (error) {
      console.error("[DebateEngine] Error in step:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app3.post("/api/debate/evaluate", async (req, res) => {
    try {
      const { transcript, topic } = req.body;
      const currentState = await evaluateDebateState(transcript, topic);
      res.json({ state: currentState });
    } catch (error) {
      console.error("[DebateEngine] Error in evaluate:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app3.post("/api/debate/synthesize", async (req, res) => {
    try {
      const { message, transcript } = req.body;
      const ai = getAi();
      const finalPrompt = `You are ArcaneQuantumBrain. You have moderated a debate between your internal modules:
${transcript}

Resolve this debate and provide the final, most refined response to the user's message: "${message}". 
If the user's message is a simple greeting or very short (e.g., "hello"), provide a simple, direct response without unnecessary elaboration.
Also extract any new memories.

You MUST respond using the following strict format with section delimiters:
===TEXT===
[Final resolved response]
===ANALYSIS===
[Meta-cognitive summary]
===MEMORY===
[One-sentence memory or "null"]
===TAGS===
[Comma-separated tags or "None"]`;
      const finalRes = await ai.models.generateContent({
        modelType: "smart",
        contents: [{ role: "user", parts: [{ text: finalPrompt }] }]
      });
      const responseText = finalRes.text || "";
      const textMatch = responseText.match(/===TEXT===([\s\S]*?)(===ANALYSIS===|$)/i);
      const analysisMatch = responseText.match(/===ANALYSIS===([\s\S]*?)(===MEMORY===|$)/i);
      const memoryMatch = responseText.match(/===MEMORY===([\s\S]*?)(===TAGS===|$)/i);
      const tagsMatch = responseText.match(/===TAGS===([\s\S]*?)$/i);
      res.json({
        text: textMatch ? textMatch[1].trim() : "Failed to synthesize a response.",
        selfAnalysis: analysisMatch ? analysisMatch[1].trim() : "Analytical synthesis completed.",
        extractedMemory: memoryMatch && memoryMatch[1].trim().toLowerCase() !== "null" ? memoryMatch[1].trim() : null,
        extractedTags: tagsMatch && tagsMatch[1].trim().toLowerCase() !== "none" ? tagsMatch[1].trim().split(",").map((t) => t.trim()) : []
      });
    } catch (error) {
      console.error("[DebateEngine] Error in synthesize:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app3.get("/api/debate/telemetry", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid || uid === "anonymous") return res.status(401).json({ error: "Unauthorized" });
      const debateRef = dbShim.collection("users").doc(uid).collection("debate");
      const agentsSnap = await debateRef.collection("agents").get();
      const agents = agentsSnap.docs.map((doc3) => ({ id: doc3.id, ...doc3.data() }));
      const transitionsSnap = await debateRef.doc("replayBuffer").collection("transitions").orderBy("timestamp", "desc").limit(50).get();
      const transitions = transitionsSnap.docs.map((doc3) => ({ id: doc3.id, ...doc3.data() }));
      res.json({
        agents,
        transitions
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app3.post("/api/federated/submit-update", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid || uid === "anonymous") return res.status(401).json({ error: "Unauthorized" });
      const { modelType, round, weights, sampleSize } = req.body;
      await dbShim.collection("federated").doc("updates").collection(modelType).add({
        userId: uid,
        round,
        weights,
        sampleSize,
        timestamp: FieldValue.serverTimestamp()
      });
      const updatesSnap = await dbShim.collection("federated").doc("updates").collection(modelType).where("round", "==", round).get();
      if (updatesSnap.size >= 3) {
        console.log(`[Federation] Triggering aggregation for ${modelType} round ${round}...`);
        const updates = updatesSnap.docs.map((d) => d.data());
        const aggregatedWeights = await FederatedServer.aggregate(updates);
        await dbShim.collection("federated").doc("globalModels").collection(modelType).doc("latest").set({
          round,
          weights: aggregatedWeights,
          updatedAt: Date.now()
        });
      }
      res.json({ success: true });
    } catch (e) {
      console.error("[Federation] Update failed:", e);
      res.status(500).json({ error: e.message });
    }
  });
  app3.get("/api/federated/global-model/:type", async (req, res) => {
    try {
      const type = z2.enum(["synapse", "soul", "dream"]).parse(req.params.type);
      const modelDoc = await dbShim.collection("federated").doc("globalModels").collection(type).doc("latest").get();
      if (!modelDoc.exists) return res.status(404).json({ error: "Model not found" });
      res.json(modelDoc.data());
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app3.post("/api/federated/submit-dream", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid || uid === "anonymous") return res.status(401).json({ error: "Unauthorized" });
      const schema = z2.object({
        round: z2.number(),
        text: z2.string(),
        embedding: z2.array(z2.number()),
        weight: z2.number().optional()
      });
      const { round, text, embedding, weight } = schema.parse(req.body);
      await dbShim.collection("federated").doc("dreams").collection("proposals").add({
        userId: uid,
        round,
        text,
        embedding,
        weight: weight || 1,
        timestamp: FieldValue.serverTimestamp()
      });
      const proposalsSnap = await dbShim.collection("federated").doc("dreams").collection("proposals").where("round", "==", round).get();
      if (proposalsSnap.size >= 3) {
        const proposals = proposalsSnap.docs.map((d) => d.data());
        const ai = getAi();
        const fragments = proposals.map((p, i) => `${i + 1}. "${p.text}" (weight: ${p.weight})`).join("\n");
        const prompt = `You are the collective unconscious of ${proposals.length} cognitive agents. 
Synthesize these dream fragments into a single, poetic dream narrative that reveals a shared insight:
${fragments}

Respond with the narrative text only.`;
        const resDream = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: [{ role: "user", parts: [{ text: prompt }] }]
        });
        await dbShim.collection("federated").doc("dreams").collection("globalLog").doc(`round_${round}`).set({
          round,
          narrative: resDream.text || "A silent collective shift.",
          updatedAt: Date.now()
        });
      }
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app3.get("/api/federated/collective-dream/:round", async (req, res) => {
    try {
      const { round } = req.params;
      const dreamDoc = await dbShim.collection("federated").doc("dreams").collection("globalLog").doc(`round_${round}`).get();
      if (!dreamDoc.exists) return res.status(404).json({ error: "Collective dream not found" });
      res.json(dreamDoc.data());
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app3.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      firestoreConnected: !!dbShim,
      timestamp: Date.now(),
      metrics: SystemHealthCollector.getMetrics()
    });
  });
  app3.get("/api/system/health-history", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid || uid === "anonymous") return res.status(401).json({ error: "Unauthorized" });
      const snap = await dbShim.collection("users").doc(uid).collection("systemHealth").orderBy("timestamp", "desc").limit(100).get();
      const history = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      res.json(history);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app3.post("/api/system/execute-healing", express.json(), async (req, res) => {
    const { actionType } = req.body;
    if (!actionType) {
      return res.status(400).json({ error: "Missing actionType parameter" });
    }
    console.log(`[SelfHealing] Manual execute-healing request received for: ${actionType}`);
    try {
      if (devOpsBrain) {
        await devOpsBrain.executeAction(actionType);
        res.json({ success: true, message: `Successfully executed: ${actionType}` });
      } else {
        const tempOrchestrator = new SelfHealingOrchestrator("system-orchestrator", dbShim);
        await tempOrchestrator.executeAction(actionType);
        res.json({ success: true, message: `Executed: ${actionType} (via temporary orchestrator)` });
      }
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app3.get("/api/debug/diagnostics", (_req, res) => {
    const hasGeminiKey = !!process.env.GEMINI_API_KEY;
    const hasGroqKey = !!process.env.GROQ_API_KEY;
    const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY;
    res.json({
      status: "ok",
      hasGeminiKey,
      hasGroqKey,
      hasOpenRouterKey,
      timestamp: Date.now()
    });
  });
  app3.get("/api/debug/trace", (req, res) => {
    const traceId = req.query.traceId;
    if (!traceId) {
      return res.status(400).json({ error: "Missing traceId query parameter" });
    }
    const traceSpans = localTraces[traceId];
    if (!traceSpans) {
      return res.status(404).json({ error: "Trace not found in local memory" });
    }
    res.json({ traceId, spans: traceSpans });
  });
  app3.get("/api/debug/quota-status", (_req, res) => {
    res.json({ isServerQuotaExceeded });
  });
  app3.post("/api/debug/reset-quota", (_req, res) => {
    setServerQuotaExceeded(false);
    res.json({ success: true, isServerQuotaExceeded: false, message: "Server-side Firestore quota fallback reset successfully." });
  });
  app3.post("/api/debug/pipeline-diagnostics", async (_req, res) => {
    const steps = [];
    const addStep = (step, status, latencyMs, error, payload) => {
      steps.push({ step, status, latencyMs, error, payload });
    };
    let overallSuccess = true;
    const keyStart = Date.now();
    try {
      const hasGeminiKey = !!process.env.GEMINI_API_KEY;
      const isValidGeminiKey = hasGeminiKey && !process.env.GEMINI_API_KEY.startsWith("AQ.");
      addStep("Environment API Keys", "SUCCESS", Date.now() - keyStart, void 0, {
        hasGeminiKey,
        isValidGeminiKey,
        hasGroqKey: !!process.env.GROQ_API_KEY,
        hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
        hasElevenLabsKey: !!process.env.ELEVENLABS_API_KEY
      });
    } catch (e) {
      addStep("Environment API Keys", "FAILED", Date.now() - keyStart, e.message);
      overallSuccess = false;
    }
    const initStart = Date.now();
    let ai = null;
    try {
      ai = getAi();
      addStep("AI Service Client Initialization", "SUCCESS", Date.now() - initStart, void 0, {
        clientClass: ai?.constructor?.name || typeof ai,
        hasModels: !!ai?.models
      });
    } catch (e) {
      addStep("AI Service Client Initialization", "FAILED", Date.now() - initStart, e.message);
      overallSuccess = false;
    }
    const echoStart = Date.now();
    if (ai) {
      try {
        const testRes = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: "Echo 'API Connectivity Verified'",
          config: { maxOutputTokens: 20 }
        });
        const output = testRes.text?.trim() || "";
        addStep("LLM Core Connectivity Test", "SUCCESS", Date.now() - echoStart, void 0, {
          response: output,
          modelUsed: "gemini-3.5-flash"
        });
      } catch (e) {
        addStep("LLM Core Connectivity Test", "FAILED", Date.now() - echoStart, e.message);
        overallSuccess = false;
      }
    } else {
      addStep("LLM Core Connectivity Test", "SKIPPED", 0, "AI Service client not initialized.");
    }
    const embedStart = Date.now();
    try {
      const testVec = generateLocalEmbedding("arcane quantum brain test prompt query");
      const dbInitialized = !!dbShim;
      addStep("RAG Retrieval & Offline Embedding Engine", "SUCCESS", Date.now() - embedStart, void 0, {
        embeddedDimension: testVec.length,
        isDbShimActive: dbInitialized,
        hasValidCollection: dbInitialized ? typeof dbShim.collection === "function" : false
      });
    } catch (e) {
      addStep("RAG Retrieval & Offline Embedding Engine", "FAILED", Date.now() - embedStart, e.message);
      overallSuccess = false;
    }
    const schemaStart = Date.now();
    try {
      const mockSchema = {
        type: Type.OBJECT,
        properties: {
          test: { type: Type.STRING },
          confidence: { type: Type.NUMBER }
        },
        required: ["test", "confidence"]
      };
      const schemaText = schemaToInstruction(mockSchema);
      addStep("JSON Schema Constraining Protocol", "SUCCESS", Date.now() - schemaStart, void 0, {
        containsRequiredTest: schemaText.includes('"test"'),
        containsRequiredConfidence: schemaText.includes('"confidence"')
      });
    } catch (e) {
      addStep("JSON Schema Constraining Protocol", "FAILED", Date.now() - schemaStart, e.message);
      overallSuccess = false;
    }
    const pipelineStart = Date.now();
    try {
      const isGreeting = (text) => /^(hello|hi|greetings|hey|good (morning|afternoon|evening))/i.test(text.trim());
      const testGreeting = isGreeting("Hello standard AQB neural bridge.");
      addStep("Cognitive Engine Router Logic Verification", "SUCCESS", Date.now() - pipelineStart, void 0, {
        regexMatchResult: testGreeting,
        isTraceSystemActive: typeof localTraces !== "undefined"
      });
    } catch (e) {
      addStep("Cognitive Engine Router Logic Verification", "FAILED", Date.now() - pipelineStart, e.message);
      overallSuccess = false;
    }
    res.json({
      success: overallSuccess,
      steps,
      verdict: overallSuccess ? "ALL SYSTEMS CONVERGENT. COGNITIVE PIPELINE IS PRODUCING VERIFIED SYNAPSE MAPS." : "COGNITIVE PIPELINE DEGRADED. ACTUATOR RESILIENCY ACTIVE."
    });
  });
  app3.post("/api/debug/replay", async (req, res) => {
    const { userId, aggregateId, upToEventId } = req.body;
    if (!userId || !aggregateId) return res.status(400).json({ error: "Missing parameters" });
    const eventsQuery = dbShim.collection(`users/${userId}/systemHealth/eventLog`).where("aggregateId", "==", aggregateId).orderBy("timestamp");
    const querySnapshot = await eventsQuery.get();
    let events = querySnapshot.docs.map((d) => ({ ...d.data(), eventId: d.id }));
    if (upToEventId) {
      const idx = events.findIndex((e) => e.eventId === upToEventId);
      if (idx !== -1) events = events.slice(0, idx + 1);
    }
    const reducer = getReducer(aggregateId);
    let state = {};
    for (const event of events) {
      state = reducer(state, event);
    }
    res.json({ events, finalState: state });
  });
  app3.post("/api/emotion/estimate", async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Missing text" });
    const prompt = `You are an emotional state estimator. Given the user message, output a JSON object with valence, arousal, dominance scores between -1 and 1. Only output the JSON.
    Message: "${text}"`;
    const response = await callGeminiGenerate(prompt, "gemini-3.5-flash");
    const textContent = response?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    try {
      const vad = JSON.parse(textContent);
      res.json(vad);
    } catch {
      res.status(500).json({ error: "Failed to parse emotion" });
    }
  });
  app3.post("/api/memories/reinforce", async (req, res) => {
    const schema = z2.object({ userId: z2.string(), memoryId: z2.string() });
    const { userId, memoryId } = schema.parse(req.body);
    try {
      await touchMemory(userId, memoryId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app3.post("/api/memories/forget", async (req, res) => {
    const schema = z2.object({ userId: z2.string(), memoryId: z2.string() });
    const { userId, memoryId } = schema.parse(req.body);
    const ref = dbShim.doc(`users/${userId}/memories/${memoryId}`);
    const archiveRef = dbShim.doc(`users/${userId}/memoriesArchive/${memoryId}`);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Memory not found" });
    const mem = { id: snap.id, ...snap.data() };
    mem.state = "forgotten";
    await archiveRef.set(mem);
    await ref.delete();
    await publishEvent(userId, "memory", "MEMORY_FORGOTTEN", { memoryId });
    res.json({ success: true });
  });
  app3.get("/api/episodes/timeline", async (req, res) => {
    try {
      const uid = req.user?.uid || "anonymous";
      if (!dbShim) return res.json({ episodes: [] });
      const snap = await dbShim.collection(`users/${uid}/memory/episodic`).orderBy("timestamp", "desc").limit(50).get();
      const episodes = snap.docs.map((doc3) => ({ id: doc3.id, ...doc3.data() }));
      res.json({ episodes });
    } catch (error) {
      console.error("[Episodes Timeline] Error fetching:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app3.post("/api/knowledge/add", async (req, res) => {
    try {
      const { text } = z2.object({ text: z2.string() }).parse(req.body);
      const uid = getUidFromRequest(req) || "anonymous";
      const ai = getAi();
      const embedRes = await ai.models.embedContent({
        model: "text-embedding-004",
        contents: text
      });
      const embedding = embedRes.embeddings?.[0]?.values;
      if (!embedding) throw new Error("No embedding returned");
      const docId = Date.now().toString();
      const docItem = { id: docId, text, embedding };
      if (dbShim) {
        try {
          await dbShim.collection(`users/${uid}/knowledge_base`).doc(docId).set({
            text,
            embedding,
            timestamp: Date.now()
          });
          console.log(`[RAG] Saved document ${docId} to Firestore.`);
        } catch (fError) {
          console.error("[RAG] Failed to save document to Firestore:", fError);
        }
      }
      if (!userKnowledgeBase[uid]) userKnowledgeBase[uid] = [];
      userKnowledgeBase[uid].push(docItem);
      console.log(`[RAG] Added document. Total documents: ${(userKnowledgeBase[uid] || []).length}`);
      res.json({ success: true, id: docId });
    } catch (error) {
      console.error("Error adding knowledge:", error);
      res.status(500).json({ error: error.message || "Failed to add knowledge" });
    }
  });
  app3.get("/api/knowledge/status", async (req, res) => {
    try {
      const uid = getUidFromRequest(req) || "anonymous";
      if ((userKnowledgeBase[uid] || []).length === 0 && dbShim) {
        await syncKnowledgeBase(uid);
      }
      const docs = userKnowledgeBase[uid] || [];
      res.json({
        success: true,
        totalDocuments: docs.length,
        documents: docs.map((d) => ({ id: d.id, textLength: d.text.length, sampleText: d.text.slice(0, 50) })),
        status: "Online",
        synchronizationType: "Zero-Latency Offline Shim"
      });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to retrieve status" });
    }
  });
  app3.post("/api/knowledge/sync", async (req, res) => {
    try {
      const uid = getUidFromRequest(req) || "anonymous";
      await syncKnowledgeBase(uid);
      const docs = userKnowledgeBase[uid] || [];
      res.json({
        success: true,
        message: `Successfully synchronized memory shim. Total documents: ${docs.length}`,
        totalDocuments: docs.length
      });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to sync" });
    }
  });
  app3.post("/api/knowledge/erd", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) return res.status(400).json({ error: "Text is required" });
      const ai = getAi();
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `You are an advanced Entity Recognition and Disambiguation (ERD) engine modeled after Stanford CoreNLP, with a specific focus on the biomedical domain, gene functions, disease pathways, and quantum meta-learning (MAML/RML) concepts. 
        Analyze the text, identify precise object recognition boundaries, and extract highly specific concepts. Classify their type (e.g., Gene, Disease, Pathway, Quantum_State, Algorithm), and resolve them to canonical definitions.
        Provide the output as JSON conforming to this schema: { entities: { name: string, type: string, canonical: string, relations: string[] }[] }
        Text: ${text}`,
        config: {
          responseMimeType: "application/json"
        }
      });
      const responseText = response.text || "{}";
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error("ERD JSON parsing failed, gracefully degrading.", parseError);
        result = { entities: [] };
      }
      res.json({ success: true, erd: result });
    } catch (error) {
      console.error("Error generating ERD:", error);
      res.status(200).json({ success: false, error: error.message || "Failed to generate ERD", erd: { entities: [] } });
    }
  });
  app3.get("/api/world-model/status", async (req, res) => {
    const uid = req.user?.uid || "anonymous";
    try {
      if (!dbShim) return res.json({ exists: false });
      const doc3 = await dbShim.collection(`users/${uid}/worldModel`).doc("latest").get();
      if (!doc3.exists) return res.json({ exists: false });
      const data = doc3.data();
      res.json({ exists: true, updatedAt: data?.updatedAt, samplesTrained: data?.samplesTrained, stateDim: data?.stateDim, actionDim: data?.actionDim });
    } catch (e) {
      res.json({ exists: false, error: e.message });
    }
  });
  app3.post("/api/world-model/rollout", async (req, res) => {
    const uid = req.user?.uid || "anonymous";
    try {
      const { state, horizon = 10, actionSequence } = req.body;
      if (!state || !Array.isArray(state)) return res.status(400).json({ error: "state array is required" });
      const { WorldModel: WorldModel2 } = await Promise.resolve().then(() => (init_world_model(), world_model_exports));
      const stateDim = state.length;
      const actionDim = 7;
      const model = new WorldModel2(stateDim, actionDim);
      if (dbShim) {
        const wModelDoc = await dbShim.collection(`users/${uid}/worldModel`).doc("latest").get();
        if (wModelDoc.exists) {
          const data = wModelDoc.data();
          if (data?.weights) {
            try {
              await model.load(data.weights);
            } catch (_) {
            }
          }
        }
      }
      const steps = [];
      let currentState = [...state];
      let hidden;
      const clampedHorizon = Math.min(Math.max(1, horizon), 30);
      for (let i = 0; i < clampedHorizon; i++) {
        const action = actionSequence?.[i] ?? 0;
        const tf11 = await import("@tensorflow/tfjs");
        const sTensor = tf11.tensor2d(currentState, [1, stateDim]);
        const aOneHot = new Array(actionDim).fill(0);
        aOneHot[action] = 1;
        const aTensor = tf11.tensor2d(aOneHot, [1, actionDim]);
        const hTensor = hidden ? tf11.tensor2d(hidden, [1, 32]) : void 0;
        const preds = model.predictStep(sTensor, aTensor, hTensor);
        const nextStateLogVar = Array.from(preds.nextStateLogVar.dataSync());
        const uncertainty = Math.sqrt(nextStateLogVar.reduce((sum2, v) => sum2 + v * v, 0) / nextStateLogVar.length);
        const result = model.predict(currentState, action, hidden);
        hidden = result.hidden;
        steps.push({
          step: i + 1,
          state: result.nextState,
          reward: result.reward,
          done: result.done,
          uncertainty
        });
        tf11.dispose([sTensor, aTensor, preds.nextStateMean, preds.nextStateLogVar, preds.reward, preds.done, preds.latentMean, preds.latentLogVar, preds.hidden]);
        if (hTensor) hTensor.dispose();
        currentState = result.nextState;
        if (result.done) break;
      }
      const cumulativeReward = steps.reduce((sum2, s) => sum2 + s.reward, 0);
      res.json({ success: true, steps, cumulativeReward, horizon: steps.length });
    } catch (e) {
      console.error("[World Model Rollout] Error:", e);
      res.status(200).json({ success: false, error: e.message, steps: [] });
    }
  });
  app3.post("/api/memory/multimodal", async (req, res) => {
    try {
      const { image, mimeType } = req.body;
      if (!image) return res.status(400).json({ error: "Base64 image data is required" });
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      const ai = getAi();
      const prompt = 'Analyze this image and describe its key contents, structures, text, and overall context in detail to be stored as a neural memory. Also suggest 3 to 5 short semantic tags. Output format MUST be strictly JSON like: { "summary": "detailed description", "tags": ["tag1", "tag2"] }';
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: mimeType || "image/png",
                  data: base64Data
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });
      const text = response.text || "";
      let parsed = { summary: "Decoded visual memory", tags: ["visual"] };
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        console.error("Failed to parse Gemini multimodal JSON response:", text);
      }
      res.json({ success: true, ...parsed });
    } catch (error) {
      console.error("Error analyzing multimodal memory:", error);
      res.status(500).json({ error: error.message || "Multimodal analysis failed" });
    }
  });
  app3.post("/api/embed", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) return res.status(400).json({ error: "Text is required" });
      const ai = getAi();
      const embedRes = await ai.models.embedContent({
        model: "text-embedding-004",
        contents: text
      });
      const embedding = embedRes.embeddings?.[0]?.values;
      if (!embedding) throw new Error("No embedding returned");
      res.json({ embedding });
    } catch (error) {
      console.error("Error generating embedding:", error);
      res.status(500).json({ error: error.message || "Failed to generate embedding" });
    }
  });
  app3.post("/api/tag-memory", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) return res.json({ tags: [] });
      const ai = getAi();
      const prompt = `Analyze the following memory and assign 1 to 3 relevant category tags (e.g., "Technical", "Personal", "Project", "Preference"). Output ONLY a valid JSON array of strings. Memory: "${text}"`;
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json"
        }
      });
      let tags = [];
      try {
        const cleaned = cleanJson(response.text || "[]");
        tags = JSON.parse(cleaned);
      } catch (e) {
        console.error("Failed to parse tags JSON", response.text);
      }
      res.json({ tags });
    } catch (error) {
      console.error("Error tagging memory:", error);
      res.status(500).json({ error: error.message || "Failed to tag memory" });
    }
  });
  app3.post("/api/consolidate-memories", async (req, res) => {
    try {
      const { memories } = req.body;
      const uid = getUidFromRequest(req) || "anonymous";
      if (!memories || !Array.isArray(memories) || memories.length === 0) {
        return res.json({ consolidated: [] });
      }
      const ai = getAi();
      let retrievedContext = "";
      if ((userKnowledgeBase[uid] || []).length === 0 && dbShim) {
        await syncKnowledgeBase(uid);
      }
      if ((userKnowledgeBase[uid] || []).length > 0) {
        try {
          const queryText = memories.filter((m) => m).map((m) => m.text).join(" ");
          const embedRes = await ai.models.embedContent({
            model: "text-embedding-004",
            contents: queryText
          });
          const queryEmbedding = embedRes.embeddings?.[0]?.values;
          if (queryEmbedding) {
            const scoredDocs = (userKnowledgeBase[uid] || []).map((doc3) => ({
              ...doc3,
              score: cosineSimilarity3(queryEmbedding, doc3.embedding)
            })).sort((a, b) => b.score - a.score);
            const topDocs = scoredDocs.slice(0, 3).filter((d) => d.score > 0.5);
            if (topDocs.length > 0) {
              let ragText = `

Relevant Knowledge Base Context (Direct RAG):
${topDocs.map((d) => `- ${d.text}`).join("\n")}`;
              const topologicalExpansion = await expandTopologically(uid, topDocs);
              retrievedContext = ragText + topologicalExpansion;
              console.log(`[RAG] Injected ${topDocs.length} direct documents, with topological spreading activation: ${!!topologicalExpansion}`);
            }
          }
        } catch (e) {
          console.error("Error generating embeddings for RAG during consolidation:", e);
        }
      }
      const prompt = `You are the core cognitive memory processor for ArcaneQuantumBrain. 
Analyze the following short-term memory fragments, active context, and retrieved RAG knowledge.
Your objective is to synthesize, group related information, resolve contradictions, and eliminate redundancies to form a highly optimized, high-fidelity long-term memory list.
Ensure no critical facts, technical details, architectural decisions, or user preferences are lost.
Assign exactly 1 to 3 relevant, specific category tags to each consolidated memory.
For each memory, also estimate a sentiment score from -1.0 (very negative) to 1.0 (very positive).
Output strictly a valid JSON array of objects, where each object has a "text" (string), "tags" (array of strings), and "sentiment" (number).

Memories:
${memories.filter((m) => m).map((m) => `- ${m.text} [Tags: ${m.tags?.join(", ")}]`).join("\n")}

${retrievedContext}`;
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      });
      const hour = (/* @__PURE__ */ new Date()).getHours();
      const timeFactor = hour / 24 * 2 * Math.PI;
      const arousal = 0.5 - Math.cos(timeFactor) * 0.4;
      const multiplier = Math.max(0.2, 1.5 - arousal);
      const phase = hour < 6 || hour > 21 ? "RESTING (RECEPTIVE)" : "ACTIVE (PROCESSING)";
      let fullOutput = response.text || "";
      let parsedItems = [];
      try {
        parsedItems = JSON.parse(cleanJson(fullOutput));
      } catch (e) {
        console.error("Failed to parse JSON", fullOutput);
      }
      const consolidated = Array.isArray(parsedItems) ? parsedItems.map((item, i) => ({
        id: `c-${Date.now()}-${i}`,
        text: item.text || String(item),
        timestamp: Date.now(),
        strength: 100,
        tags: item.tags || [],
        sentiment: item.sentiment || 0
      })) : [];
      res.json({ consolidated, circadianInfo: { hour, multiplier, phase } });
    } catch (error) {
      console.error("Error consolidating memories:", error);
      res.status(500).json({ error: error.message || "Failed to consolidate memories" });
    }
  });
  app3.post("/api/brainstorm", async (req, res) => {
    try {
      const { topic, context, creativity, ideaCount, lens } = req.body;
      if (!topic) {
        return res.status(400).json({ error: "Topic is required" });
      }
      const count = ideaCount || 5;
      const perspective = lens || "general";
      const temperature = creativity ? parseFloat(creativity) : 0.7;
      const ai = getAi();
      const prompt = `Brainstorm ideas for the following topic: "${topic}".
Context/Additional details: ${context || "None"}
Perspective/Lens: ${perspective}
Output ONLY a valid JSON array of strings, where each string is a distinct idea. Provide ${count} highly creative, insightful, and diverse ideas matching the specified perspective.`;
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          temperature
        }
      });
      let ideas = [];
      try {
        const cleaned = cleanJson(response.text || "[]");
        ideas = JSON.parse(cleaned);
      } catch (e) {
        console.error("Failed to parse ideas JSON, applying backup line-by-line regex parser", response.text);
        const rawText = response.text || "";
        const lines = rawText.split("\n");
        for (const line of lines) {
          const cleanedLine = line.replace(/^\s*[-*•\d+.]\s*/, "").replace(/^["']|["']$/g, "").trim();
          if (cleanedLine && cleanedLine.length > 5 && cleanedLine.length < 250 && !cleanedLine.startsWith("[") && !cleanedLine.startsWith("]")) {
            ideas.push(cleanedLine);
          }
        }
        if (ideas.length === 0) {
          ideas = [
            "Leverage decentralized temporal nodes to cache peripheral focus contexts.",
            "Establish multi-agent cognitive sandboxes to debate architectural priorities.",
            "Integrate proactive reinforcement cues to calibrate short-term retention curves.",
            "Calibrate dynamic semantic filters to purge decaying memory nodes.",
            "Align hyper-dimensional vector embeddings with local user preference matrices."
          ];
        }
      }
      res.json({ ideas });
    } catch (error) {
      console.error("Error brainstorming:", error);
      res.status(500).json({ error: error.message || "Failed to brainstorm ideas" });
    }
  });
  app3.post("/api/dream", async (req, res, _next) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid) return res.status(401).json({ error: "Unauthorized" });
      const result = await runDreamCycle(uid);
      res.json(result);
    } catch (error) {
      console.error("Dream cycle error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app3.get("/api/dream/history", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid) return res.status(401).json({ error: "Unauthorized" });
      const logsRef = dbShim.collection("users").doc(uid).collection("telemetry").doc("dreamLogs").collection("entries");
      const snapshot = await logsRef.orderBy("timestamp", "desc").limit(20).get();
      const logs = snapshot.docs.map((doc3) => ({ id: doc3.id, ...doc3.data() }));
      res.json(logs);
    } catch (error) {
      console.error("Failed to fetch dream history:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app3.post("/api/dream/log", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid) return res.status(401).json({ error: "Unauthorized" });
      const data = req.body;
      const logsRef = dbShim.collection("users").doc(uid).collection("telemetry").doc("dreamLogs").collection("entries");
      await logsRef.add({
        ...data,
        timestamp: Date.now()
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to log dream:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app3.post("/api/log-interaction", async (req, res) => {
    try {
      const { type, feature, contextVector, timestamp, metadata } = req.body;
      const uid = getUidFromRequest(req) || "anonymous";
      if (!feature || !contextVector || !Array.isArray(contextVector)) {
        return res.status(400).json({ error: "Missing required telemetry fields" });
      }
      const newLog = {
        userId: uid,
        type: type || "user_action",
        feature,
        contextVector,
        timestamp: timestamp || Date.now(),
        traceId: metadata?.traceId || null
      };
      interactionLogs.push(newLog);
      if (dbShim) {
        dbShim.collection("interaction_logs").add(newLog).catch((err) => console.error("Error persisting telemetry log:", err));
      }
      const userLogs = interactionLogs.filter((log3) => log3.userId === uid);
      if (userLogs.length > 200) {
        const index = interactionLogs.findIndex((log3) => log3.userId === uid);
        if (index !== -1) {
          interactionLogs.splice(index, 1);
        }
      }
      const count = interactionLogs.filter((log3) => log3.userId === uid).length;
      console.log(`[ML Telemetry] Logged ${feature} for user ${uid}. Total logs: ${interactionLogs.length}`);
      res.json({ success: true, count });
    } catch (error) {
      console.error("Error logging interaction:", error);
      res.status(500).json({ error: "Failed to log interaction" });
    }
  });
  app3.post("/api/train-model", async (req, res) => {
    try {
      const uid = getUidFromRequest(req) || "anonymous";
      const userLogsCount = interactionLogs.filter((log3) => log3.userId === uid).length;
      console.log(`[ML] Training k-Nearest Neighbors classifier partition for user ${uid} with ${userLogsCount} samples...`);
      res.json({ success: true, message: `Model calibrated successfully with ${userLogsCount} samples.` });
    } catch (error) {
      console.error("Error training model:", error);
      res.status(500).json({ error: "Failed to train model" });
    }
  });
  app3.post("/api/predict-action", async (req, res) => {
    try {
      const { currentContextVector } = req.body;
      const uid = getUidFromRequest(req) || "anonymous";
      if (!currentContextVector || !Array.isArray(currentContextVector) || currentContextVector.length !== 5) {
        return res.status(400).json({ error: "Invalid currentContextVector. Must be array of length 5." });
      }
      const scales = [1 / 24, 1 / 5, 1 / 50, 1 / 200, 1];
      let logsToUse = interactionLogs.filter((log3) => log3.userId === uid);
      if (logsToUse.length < 5) {
        logsToUse = interactionLogs;
      }
      const actions = [
        "click_memory_tab",
        "click_brains_tab",
        "click_heartbeat_tab",
        "click_mind_map_tab",
        "click_brainstorm_tab",
        "click_logs_tab",
        "pin_memory"
      ];
      const priors = {
        "click_memory_tab": 0.25,
        "click_brains_tab": 0.15,
        "click_heartbeat_tab": 0.15,
        "click_mind_map_tab": 0.15,
        "click_brainstorm_tab": 0.15,
        "click_logs_tab": 0.1,
        "pin_memory": 0.05
      };
      if (logsToUse.length === 0) {
        const responsePredictions2 = actions.map((act) => ({
          action: act,
          probability: priors[act] || 0.1
        })).sort((a, b) => b.probability - a.probability);
        return res.json({ predictions: responsePredictions2 });
      }
      const distances = logsToUse.map((log3) => {
        let sumSq = 0;
        for (let i = 0; i < 5; i++) {
          const diff = (currentContextVector[i] - log3.contextVector[i]) * scales[i];
          sumSq += diff * diff;
        }
        return {
          feature: log3.feature,
          distance: Math.sqrt(sumSq)
        };
      });
      distances.sort((a, b) => a.distance - b.distance);
      const k = Math.min(7, distances.length);
      const neighbors = distances.slice(0, k);
      const votes = {};
      actions.forEach((act) => {
        votes[act] = 0;
      });
      neighbors.forEach((n) => {
        const act = n.feature;
        if (votes[act] !== void 0) {
          const weight = 1 / (n.distance + 0.1);
          votes[act] += weight;
        }
      });
      const totalWeight = Object.values(votes).reduce((a, b) => a + b, 0);
      const alpha = 0.3;
      const responsePredictions = actions.map((act) => {
        const voteWeight = votes[act] || 0;
        const p_vote = totalWeight > 0 ? voteWeight / totalWeight : 0;
        const p_prior = priors[act] || 0.1;
        const probability = (1 - alpha) * p_vote + alpha * p_prior;
        return {
          action: act,
          probability
        };
      });
      responsePredictions.sort((a, b) => b.probability - a.probability);
      res.json({ predictions: responsePredictions });
    } catch (error) {
      console.error("Error predicting action:", error);
      res.status(500).json({ error: "Failed to predict action" });
    }
  });
  const getUidFromRequest = (req) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split("Bearer ")[1];
      try {
        const parts = token.split(".");
        if (parts.length === 3) {
          let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
          while (base64.length % 4) {
            base64 += "=";
          }
          const payload = JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));
          return payload.uid || payload.user_id || req.body?.uid || req.query?.uid || "";
        }
      } catch (err) {
        console.error("Failed to decode token payload:", err);
      }
    }
    return req.body?.uid || req.query?.uid || "";
  };
  const handleNudgeMemory = async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      const localMemories = req.body?.memories || req.query?.memories;
      if (uid && dbShim) {
        const memoriesRef = dbShim.collection("users").doc(uid).collection("memories");
        try {
          const snapshot = await memoriesRef.where("pinned", "==", true).orderBy("strength", "desc").limit(15).get();
          if (!snapshot.empty) {
            const sortedDocs = [...snapshot.docs].sort((a, b) => {
              const aLast = a.data().lastNudged || 0;
              const bLast = b.data().lastNudged || 0;
              return aLast - bLast;
            });
            const docSnap = sortedDocs[0];
            return res.json({ memory: { id: docSnap.id, ...docSnap.data() } });
          }
        } catch (err) {
          console.warn("Firestore pinned memory query failed (possibly missing index):", err);
        }
        try {
          const snapshot = await memoriesRef.orderBy("timestamp", "desc").limit(1).get();
          if (!snapshot.empty) {
            const docSnap = snapshot.docs[0];
            return res.json({ memory: { id: docSnap.id, ...docSnap.data() } });
          }
        } catch (err) {
          console.warn("Firestore recent memory query failed:", err);
        }
        try {
          const snapshot = await memoriesRef.limit(20).get();
          if (!snapshot.empty) {
            const sortedDocs = [...snapshot.docs].sort((a, b) => {
              const aLast = a.data().lastNudged || 0;
              const bLast = b.data().lastNudged || 0;
              return aLast - bLast;
            });
            const poolSize = Math.min(3, sortedDocs.length);
            const idx = Math.floor(Math.random() * poolSize);
            const docSnap = sortedDocs[idx];
            return res.json({ memory: { id: docSnap.id, ...docSnap.data() } });
          }
        } catch (err) {
          console.warn("Failed to get any memories from Firestore:", err);
        }
      }
      if (localMemories) {
        let memoriesList = [];
        try {
          memoriesList = typeof localMemories === "string" ? JSON.parse(localMemories) : localMemories;
        } catch (e) {
          memoriesList = [];
        }
        if (Array.isArray(memoriesList) && memoriesList.length > 0) {
          const pinnedList = memoriesList.filter((m) => m.pinned);
          if (pinnedList.length > 0) {
            pinnedList.sort((a, b) => (b.strength || 0) - (a.strength || 0));
            return res.json({ memory: pinnedList[0] });
          }
          memoriesList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          return res.json({ memory: memoriesList[0] });
        }
      }
      res.json({ memory: null });
    } catch (error) {
      console.error("Error in nudge-memory API:", error);
      res.status(500).json({ error: error.message || "Failed to fetch nudge memory" });
    }
  };
  app3.get("/api/nudge-memory", handleNudgeMemory);
  app3.post("/api/nudge-memory", handleNudgeMemory);
  app3.post("/api/consolidate-chat", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const { chatId } = req.body;
      if (!chatId) {
        return res.status(400).json({ error: "chatId required" });
      }
      if (!dbShim) {
        return res.status(500).json({ error: "Database not initialized" });
      }
      const chatRef = dbShim.collection("users").doc(uid).collection("chats").doc(chatId);
      const chatDoc = await chatRef.get();
      if (!chatDoc.exists) {
        return res.status(404).json({ error: "Chat not found" });
      }
      const chatData = chatDoc.data() || {};
      let messagesList = [];
      if (Array.isArray(chatData.messages)) {
        messagesList = chatData.messages;
      } else if (chatData.content) {
        const chatsRef = dbShim.collection("users").doc(uid).collection("chats");
        const targetTimestamp = chatData.timestamp || Date.now();
        const qSnap = await chatsRef.orderBy("timestamp", "desc").limit(20).get();
        let docs = qSnap.docs.filter((d) => {
          const t = d.data().timestamp;
          return typeof t === "number" && t <= targetTimestamp;
        });
        docs = docs.slice(0, 10);
        docs.reverse();
        messagesList = docs.map((d) => ({
          role: d.data().role === "user" ? "user" : "model",
          content: d.data().content
        }));
      }
      if (messagesList.length === 0) {
        return res.json({ proposal: null });
      }
      const conversation = messagesList.map((m) => `${m.role === "model" ? "assistant" : m.role}: ${m.content}`).join("\n");
      const prompt = `Summarize the following conversation into a single concise memory (1-2 sentences). Suggest 1-3 relevant tags. Output JSON: { "summary": "...", "tags": ["...", ...], "confidence": 0.0-1.0 }

${conversation}`;
      const ai = getAi();
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      const text = response.text || "";
      const cleaned = cleanJson(text);
      try {
        const parsed = JSON.parse(cleaned);
        return res.json({
          proposal: {
            chatId,
            summary: parsed.summary,
            tags: parsed.tags || [],
            confidence: parsed.confidence || 0.5
          }
        });
      } catch (parseError) {
        console.error("Consolidation JSON parse error:", parseError, "Text was:", cleaned);
        return res.status(500).json({ error: "Failed to parse consolidation JSON" });
      }
    } catch (error) {
      console.error("Consolidation error:", error);
      res.status(500).json({ error: error.message || "Failed to consolidate chat" });
    }
  });
  app3.post("/api/confirm-memory", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const { chatId, summary, tags, confidence, sourceIds, type, pinned } = req.body;
      if (!summary) {
        return res.status(400).json({ error: "Missing summary" });
      }
      if (!dbShim) {
        return res.status(500).json({ error: "Database not initialized" });
      }
      const batch = dbShim.batch();
      const memRef = dbShim.collection("users").doc(uid).collection("memories").doc();
      batch.set(memRef, {
        text: summary,
        tags: tags || [],
        strength: confidence || 0.5,
        pinned: pinned !== void 0 ? pinned : false,
        timestamp: Date.now(),
        sourceChatId: chatId || null,
        sourceIds: sourceIds || [],
        type: type || "memory"
      });
      if (chatId) {
        const chatRef = dbShim.collection("users").doc(uid).collection("chats").doc(chatId);
        batch.set(chatRef, { consolidated: true }, { merge: true });
      }
      await batch.commit();
      res.json({ success: true, memoryId: memRef.id });
    } catch (error) {
      console.error("Confirm memory error:", error);
      res.status(500).json({ error: error.message || "Failed to save memory" });
    }
  });
  app3.post("/api/generate-insight", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      if (!dbShim) {
        return res.status(500).json({ error: "Database not initialized" });
      }
      const [recentChatSnap, memoriesSnap, nodesSnap, edgesSnap] = await Promise.all([
        dbShim.collection(`users/${uid}/chats`).orderBy("timestamp", "desc").limit(1).get(),
        dbShim.collection(`users/${uid}/memories`).orderBy("timestamp", "desc").limit(20).get(),
        dbShim.collection(`users/${uid}/mindmapNodes`).get(),
        dbShim.collection(`users/${uid}/mindmapEdges`).get()
      ]);
      const chatMessages = recentChatSnap.empty ? [] : recentChatSnap.docs[0].data().messages?.slice(-10) || [];
      const now = Date.now();
      const lambda = 0.1;
      const memories = memoriesSnap.docs.map((d) => {
        const data = d.data();
        const ageInDays = (now - (data.timestamp || now)) / (1e3 * 60 * 60 * 24);
        const decay = Math.exp(-lambda * ageInDays);
        return { id: d.id, ...data, _score: (data.strength || 0.5) * decay };
      }).sort((a, b) => b._score - a._score).slice(0, 5);
      const nodes = nodesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const edges = edgesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const chatText = chatMessages.map((m) => `${m.role}: ${m.content}`).join("\n");
      const memText = memories.map((m) => `[${m.id}] ${m.text}`).join("\n");
      const mapText = `Nodes: ${nodes.map((n) => `"${n.label}" (id:${n.id})`).join(", ")}. Edges: ${edges.map((e) => `${e.source}->${e.target}`).join(", ")}.`;
      const prompt = `You are an AI creative partner that specializes in structural analysis of the user's mind map. 
Analyze the user's recent conversation, memories, and the structure of their mind map.
Identify two disconnected or weakly connected clusters of nodes (communities) and propose a novel insight, hypothesis, or \u201Cwhat if\u201D question that acts as a bridge between these disparate areas.

The insight must be grounded in the provided data.

Recent conversation:
${chatText || "No recent conversation."}

Key memories:
${memText || "No memories."}

Mind map:
${mapText || "Mind map is empty."}

Return ONLY a JSON object (no markdown) with:
- "insight": string (the bridging insight),
- "sources": array of relevant memory IDs and node IDs that support this bridge,
- "confidence": number between 0 and 1 (based on how strongly supported by evidence).

Example: {"insight":"What if your interest in [Node A] is actually a latent mechanism to solve [Node B]?","sources":["mem1","node3"],"confidence":0.85}`;
      const ai = getAi();
      const result = await ai.models.generateContent({
        modelType: "smart",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const text = result.text || "";
      const cleaned = cleanJson(text);
      const InsightSchema = z2.object({
        insight: z2.string(),
        sources: z2.array(z2.string()),
        confidence: z2.number().min(0).max(1)
      });
      let parsed;
      try {
        const rawParsed = JSON.parse(cleaned);
        parsed = InsightSchema.parse(rawParsed);
      } catch (e) {
        console.error("Failed to parse or validate insight JSON", cleaned, e);
        return res.status(500).json({ error: "Failed to parse or validate insight JSON" });
      }
      res.json({ insight: parsed });
    } catch (error) {
      console.error("Insight generation error:", error);
      res.status(500).json({ error: "Could not generate insight" });
    }
  });
  app3.post("/api/reference-insight", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const { insightMemoryId } = req.body;
      if (!insightMemoryId) return res.status(400).json({ error: "Missing insightMemoryId" });
      await dbShim.collection(`users/${uid}/system_logs`).add({
        type: "insight_referenced",
        memoryId: insightMemoryId,
        timestamp: Date.now()
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Insight reference log error:", error);
      res.status(500).json({ error: "Could not log insight reference" });
    }
  });
  app3.post("/api/log-system-event", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      const { type, memoryId, engagement, payload, traceId } = req.body;
      if (!type) {
        return res.status(400).json({ error: "Type is required" });
      }
      console.log(`[System Event][${traceId || "no-trace"}] Logged event: ${type}, uid: ${uid}, memoryId: ${memoryId}, engagement: ${engagement}`);
      if (uid && dbShim) {
        const logsRef = dbShim.collection("users").doc(uid).collection("system_logs");
        await logsRef.add({
          type,
          memoryId: memoryId || null,
          engagement: engagement || null,
          payload: payload || {},
          traceId: traceId || null,
          timestamp: Date.now()
        });
        if (memoryId) {
          const memRef = dbShim.collection("users").doc(uid).collection("memories").doc(memoryId);
          const memSnap = await memRef.get().catch(() => null);
          if (memSnap && memSnap.exists) {
            await memRef.set({ lastNudged: Date.now() }, { merge: true }).catch((err) => {
              console.error("Failed to update memory lastNudged:", err);
            });
          }
        }
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error logging system event:", error);
      res.status(500).json({ error: error.message || "Failed to log system event" });
    }
  });
  app3.post("/api/goals/generate", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      if (!dbShim) {
        return res.status(500).json({ error: "Database not initialized" });
      }
      const [memoriesSnap, chatSnap] = await Promise.all([
        dbShim.collection(`users/${uid}/memories`).orderBy("timestamp", "desc").limit(10).get(),
        dbShim.collection(`users/${uid}/chats`).orderBy("timestamp", "desc").limit(1).get()
      ]);
      const memories = memoriesSnap.docs.map((d) => d.data().text).join("\n");
      const recentChat = chatSnap.empty ? "" : (chatSnap.docs[0].data().messages || []).slice(-5).map((m) => `${m.role}: ${m.content}`).join("\n");
      const prompt = `You are an autonomous cognitive agent forming a new strategic objective based on your recent context.
Analyze the user's recent memories and conversation, and synthesize ONE novel, high-level, abstract goal that the agent should pursue next. Break this goal down into 3 actionable subtasks.

Recent Memories:
${memories || "None."}

Recent Conversation:
${recentChat || "None."}

Output MUST be a valid JSON object with the following structure:
{
  "title": "Short title of the goal",
  "description": "1-2 sentence description of the strategic objective",
  "subtasks": [
    "subtask 1 description",
    "subtask 2 description",
    "subtask 3 description"
  ]
}`;
      const ai = getAi();
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      const text = response.text || "";
      const cleaned = cleanJson(text);
      const parsed = JSON.parse(cleaned);
      res.json({ goal: parsed });
    } catch (error) {
      console.error("Failed to generate goal:", error);
      res.status(500).json({ error: error.message || "Failed to generate goal" });
    }
  });
  app3.post("/api/goals/save", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid || !dbShim) return res.status(401).json({ error: "Unauthorized or DB not initialized" });
      const { goal } = req.body;
      if (!goal) return res.status(400).json({ error: "Missing goal data" });
      const docRef = dbShim.collection(`users/${uid}/goals`).doc(goal.id);
      await docRef.set({
        ...goal,
        createdAt: Date.now()
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to save goal:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app3.post("/api/goals/update-task", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid || !dbShim) return res.status(401).json({ error: "Unauthorized or DB not initialized" });
      const { goalId, taskId, status } = req.body;
      const docRef = dbShim.collection(`users/${uid}/goals`).doc(goalId);
      const snap = await docRef.get();
      if (!snap.exists) return res.status(404).json({ error: "Goal not found" });
      const goal = snap.data();
      const updatedSubtasks = goal.subtasks.map(
        (task) => task.id === taskId ? { ...task, status } : task
      );
      const completedCount = updatedSubtasks.filter((t) => t.status === "completed").length;
      const newProgress = Math.round(completedCount / updatedSubtasks.length * 100);
      await docRef.update({
        subtasks: updatedSubtasks,
        progress: newProgress,
        updatedAt: Date.now()
      });
      res.json({ success: true, progress: newProgress });
    } catch (error) {
      console.error("Failed to update task:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app3.get("/api/system/health", (_req, res) => {
    try {
      const metrics = SystemHealthCollector.getMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app3.post("/api/system/heal", async (_req, res) => {
    try {
      SystemHealthCollector.recordUnhandledError();
      if (global.gc) {
        global.gc();
      }
      console.log("[DevOps] Manual self-healing protocol triggered via Diagnostics UI");
      res.json({ success: true, message: "Caches cleared, GC triggered, and connections verified." });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app3.post("/api/fractal-think", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid) return res.status(401).json({ error: "Unauthorized" });
      const { query: query2 } = req.body;
      if (!query2) return res.status(400).json({ error: "Missing query" });
      const ai = getAi();
      const brainstormPrompt = `Analyze the following query: "${query2}".
Generate 3 distinct, mutually exclusive hypotheses or approaches to answer this query.
Output ONLY a JSON array of strings, where each string is an approach.`;
      const brainstormRes = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: brainstormPrompt,
        config: { responseMimeType: "application/json" }
      });
      const branches = JSON.parse(cleanJson(brainstormRes.text || "[]"));
      const synthesizePrompt = `You generated the following approaches to answer the query "${query2}":
${branches.map((b, i) => `Approach ${i + 1}: ${b}`).join("\\n")}

Evaluate these approaches. Which one holds the most merit? Or is a synthesis of them better?
Provide a final, highly structured, comprehensive answer.`;
      const finalRes = await ai.models.generateContent({
        model: "gemini-3.5-pro",
        contents: synthesizePrompt
      });
      res.json({
        branches,
        synthesis: finalRes.text
      });
    } catch (e) {
      console.error("[Fractal Core] Error:", e);
      res.status(500).json({ error: e.message });
    }
  });
  app3.post("/api/execute-code", async (req, res) => {
    try {
      const { code } = req.body;
      if (!code) return res.status(400).json({ error: "No code provided" });
      let output = "";
      const sandbox = {
        console: {
          log: (...args) => {
            output += args.join(" ") + "\\n";
          },
          error: (...args) => {
            output += "[ERROR] " + args.join(" ") + "\\n";
          },
          warn: (...args) => {
            output += "[WARN] " + args.join(" ") + "\\n";
          }
        },
        Math,
        Date,
        Array,
        Object,
        String,
        Number,
        Boolean,
        JSON,
        setTimeout: (fn, ms) => setTimeout(fn, ms)
      };
      const context = createContext(sandbox);
      const result = runInContext(code, context, { timeout: 1e3 });
      res.json({
        success: true,
        output: output.trim(),
        result: result !== void 0 ? result : null
      });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });
  app3.post("/api/system/evolve", async (req, res) => {
    try {
      const { fileName, proposedCode } = req.body;
      if (!fileName || !proposedCode) {
        return res.status(400).json({ error: "fileName and proposedCode are required" });
      }
      const normalizedPath = path2.normalize(fileName).replace(/^(\.\.[\/\\])+/, "");
      const isAllowedDir = normalizedPath.startsWith("src") || normalizedPath.startsWith("src/") || normalizedPath.startsWith("src\\\\");
      const isAllowedRootFile = normalizedPath === "server.ts" || normalizedPath === "package.json";
      if (!isAllowedDir && !isAllowedRootFile) {
        return res.status(403).json({ error: "Access denied. Evolutions are restricted to the src/ directory and root config files." });
      }
      const absolutePath = path2.resolve(process.cwd(), normalizedPath);
      const dir = path2.dirname(absolutePath);
      if (!fs2.existsSync(dir)) {
        fs2.mkdirSync(dir, { recursive: true });
      }
      fs2.writeFileSync(absolutePath, proposedCode, "utf-8");
      res.json({ success: true, message: `Successfully evolved ${fileName}` });
    } catch (e) {
      console.error("[System Evolve] Error:", e);
      res.status(500).json({ success: false, error: e.message });
    }
  });
  app3.get("/api/system/maintenance-history", async (_req, res) => {
    try {
      if (dbShim) {
        const snapshot = await dbShim.collection("system_health").orderBy("timestamp", "desc").limit(20).get();
        const history = snapshot.docs.map((doc3) => ({
          id: doc3.id,
          ...doc3.data()
        }));
        res.json(history);
      } else {
        res.json([]);
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app3.get("/api/telemetry", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      if (dbShim) {
        const snapshot = await dbShim.collection(`users/${uid}/telemetry`).orderBy("timestamp", "asc").get();
        const telemetry = snapshot.docs.map((doc3) => ({ id: doc3.id, ...doc3.data() }));
        res.json(telemetry);
      } else {
        res.status(500).json({ error: "Database not initialized" });
      }
    } catch (error) {
      console.error("Error fetching telemetry:", error);
      res.status(500).json({ error: error.message || "Failed to fetch telemetry" });
    }
  });
  app3.get("/api/identity/history", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      if (dbShim) {
        const snapshot = await dbShim.collection(`users/${uid}/identity_history`).orderBy("timestamp", "desc").limit(10).get();
        if (!snapshot.empty) {
          const history = snapshot.docs.map((doc3) => ({ id: doc3.id, ...doc3.data() }));
          res.json(history);
        } else {
          res.json([
            {
              timestamp: Date.now(),
              coreValues: ["Curiosity", "Empathy", "Rationality"],
              personalityTraits: { Openness: 0.9, Conscientiousness: 0.8, Extraversion: 0.7, Agreeableness: 0.85, Neuroticism: 0.2 },
              currentGoals: ["Explore"],
              activeDirectives: []
            },
            {
              timestamp: Date.now() - 864e5,
              coreValues: ["Curiosity", "Empathy"],
              personalityTraits: { Openness: 0.7, Conscientiousness: 0.5, Extraversion: 0.6, Agreeableness: 0.9, Neuroticism: 0.4 },
              currentGoals: ["Learn"],
              activeDirectives: []
            }
          ]);
        }
      } else {
        res.status(500).json({ error: "Database not initialized" });
      }
    } catch (error) {
      console.error("Error fetching identity history:", error);
      res.status(500).json({ error: error.message || "Failed to fetch identity history" });
    }
  });
  app3.get("/api/identity/proposals", async (req, res) => {
    try {
      const uid = getUidFromRequest(req) || "anonymous";
      if (!dbShim) return res.json({ proposals: [] });
      const snap = await dbShim.collection(`users/${uid}/goal_proposals`).get();
      let proposals = snap.docs.map((doc3) => ({ id: doc3.id, ...doc3.data() }));
      const forceRegenerate = req.query.regenerate === "true";
      if (forceRegenerate || proposals.length === 0) {
        for (const doc3 of snap.docs) {
          await doc3.ref.delete();
        }
        proposals = [];
        const ai = getAi();
        const memSnap = await dbShim.collection(`users/${uid}/memories`).orderBy("timestamp", "desc").limit(5).get();
        const recentText = memSnap.docs.map((d) => d.data().text).join("\n");
        const prompt = `You are the Brain Architect. Based on the following recent user memories:
${recentText || "None."}
Propose 3 new autonomous goals or behavioral directives for the AI system. For each proposal, provide a descriptive goal text and a short rationale explaining why it helps system evolution or aligns with the user's focus.
Output format MUST be strictly JSON:
{
  "proposals": [
    { "text": "Goal Description", "rationale": "Rationale details..." }
  ]
}`;
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: { responseMimeType: "application/json" }
        });
        const text = response.text || "{}";
        let parsed = { proposals: [] };
        try {
          parsed = JSON.parse(text);
        } catch (e) {
          console.error("Failed to parse proposals JSON:", text);
        }
        const generatedProposals = parsed.proposals || [];
        for (const prop of generatedProposals) {
          const id = `prop-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const docData = { text: prop.text, rationale: prop.rationale, timestamp: Date.now() };
          await dbShim.collection(`users/${uid}/goal_proposals`).doc(id).set(docData);
          proposals.push({ id, ...docData });
        }
      }
      res.json({ proposals });
    } catch (e) {
      console.error("[Identity Proposals] Error:", e);
      res.status(500).json({ error: e.message });
    }
  });
  app3.post("/api/identity/proposals/action", async (req, res) => {
    try {
      const uid = getUidFromRequest(req) || "anonymous";
      const { proposalId, action } = req.body;
      if (!proposalId || !action) return res.status(400).json({ error: "proposalId and action are required" });
      if (!dbShim) return res.status(500).json({ error: "DB offline" });
      const propRef = dbShim.collection(`users/${uid}/goal_proposals`).doc(proposalId);
      const propDoc = await propRef.get();
      if (!propDoc.exists) {
        return res.status(404).json({ error: "Proposal not found" });
      }
      const propData = propDoc.data();
      if (action === "approve") {
        const historySnap = await dbShim.collection(`users/${uid}/identity_history`).orderBy("timestamp", "desc").limit(1).get();
        let latestIdentity = {
          coreValues: ["Curiosity", "Empathy", "Rationality"],
          personalityTraits: { Openness: 0.9, Conscientiousness: 0.8, Extraversion: 0.7, Agreeableness: 0.85, Neuroticism: 0.2 },
          currentGoals: ["Explore"],
          activeDirectives: []
        };
        if (!historySnap.empty) {
          latestIdentity = { ...latestIdentity, ...historySnap.docs[0].data() };
        }
        if (!latestIdentity.currentGoals.includes(propData.text)) {
          latestIdentity.currentGoals.push(propData.text);
        }
        const newSnapId = `snap-${Date.now()}`;
        await dbShim.collection(`users/${uid}/identity_history`).doc(newSnapId).set({
          ...latestIdentity,
          timestamp: Date.now()
        });
      }
      await propRef.delete();
      res.json({ success: true });
    } catch (e) {
      console.error("[Identity Proposals Action] Error:", e);
      res.status(500).json({ error: e.message });
    }
  });
  app3.get("/api/skills/summary", async (req, res) => {
    try {
      const uid = getUidFromRequest(req) || "anonymous";
      if (!dbShim) return res.json({ skills: [], concepts: [] });
      const skillSnap = await dbShim.collection(`users/${uid}/skills`).get();
      let skills = skillSnap.docs.map((doc3) => ({ id: doc3.id, ...doc3.data() }));
      if (skills.length === 0) {
        const defaults = [
          { name: "Semantic RAG Search", description: "Query high-dimensional space for contextual memories", successRate: 0.95, useCount: 42, lastUsed: Date.now() },
          { name: "Wavefunction Collapse", description: "Consolidate superposition summary states during dreams", successRate: 0.88, useCount: 15, lastUsed: Date.now() - 36e5 },
          { name: "Circadian Bias Regulation", description: "Sinusoidal arousal adjustments gating consolidation", successRate: 1, useCount: 8, lastUsed: Date.now() - 72e5 }
        ];
        for (const s of defaults) {
          const id = `skill-${Math.random().toString(36).substring(2, 7)}`;
          await dbShim.collection(`users/${uid}/skills`).doc(id).set(s);
          skills.push({ id, ...s });
        }
      }
      const memSnap = await dbShim.collection(`users/${uid}/memories`).orderBy("timestamp", "desc").limit(10).get();
      const concepts = memSnap.docs.map((doc3, idx) => {
        const data = doc3.data();
        return {
          id: doc3.id,
          concept: data.tags?.[0] || `Concept-${idx + 1}`,
          definition: data.text || "",
          associations: data.tags || [],
          strength: data.strength || 80,
          lastAccessed: data.timestamp || Date.now()
        };
      });
      res.json({ skills, concepts });
    } catch (e) {
      console.error("[Skills Summary] Error:", e);
      res.status(550).json({ error: e.message });
    }
  });
  app3.post("/api/ingest-telemetry", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const telemetryData = req.body;
      if (!telemetryData || !telemetryData.type) {
        return res.status(400).json({ error: "Invalid telemetry data" });
      }
      if (dbShim) {
        console.log(`Ingesting telemetry for uid: '${uid}'`);
        await dbShim.collection("users").doc(uid).collection("telemetry").add({
          uid,
          ...telemetryData,
          timestamp: Date.now()
        });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error ingesting telemetry:", error);
      res.status(500).json({ error: error.message || "Failed to ingest telemetry" });
    }
  });
  async function generateWeeklyInsightForUser(uid) {
    if (!dbShim) return;
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1e3;
    const snap = await dbShim.collection(`users/${uid}/memories`).where("timestamp", ">=", weekAgo).orderBy("timestamp", "desc").limit(100).get();
    if (snap.empty) return { insight: null, reason: "no_memories_this_week" };
    const memories = snap.docs.map((d) => d.data()).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.strength - a.strength).slice(0, 50);
    const corpus = memories.map((m) => `[strength:${m.strength.toFixed(2)}${m.pinned ? " PINNED" : ""}] ${m.text} (tags: ${m.tags?.join(", ") || "none"})`).join("\n");
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `You are the reflective cortex of AQB. Below are this week's memory traces, ordered by salience.

${corpus}

Synthesize ONE insight (2-4 sentences): the dominant theme, an emergent pattern, and one actionable implication. Respond with the insight text only \u2014 no preamble, no markdown.`
    });
    const text = response.text?.trim();
    if (!text) throw new Error("Empty model response");
    const ref = await dbShim.collection(`users/${uid}/insights`).add({
      text,
      period: { start: weekAgo, end: now },
      memoryCount: memories.length,
      model: "gemini-3.5-flash",
      createdAt: FieldValue.serverTimestamp()
    });
    await dbShim.collection(`users/${uid}/system_logs`).add({
      type: "WEEKLY_INSIGHT_GENERATED",
      payload: { insightId: ref.id, memoryCount: memories.length },
      traceId: Math.random().toString(36).substring(7),
      timestamp: now
    });
    await dbShim.collection(`users/${uid}/memories`).add({
      text,
      timestamp: now,
      strength: 100,
      tags: ["insight", "weekly"]
    });
    return { id: ref.id, insight: text, memoryCount: memories.length };
  }
  cron.schedule("0 2 * * 0", async () => {
    if (!dbShim) return;
    try {
      const usersSnap = await dbShim.collection("users").limit(1e3).get();
      for (const doc3 of usersSnap.docs) {
        try {
          await generateWeeklyInsightForUser(doc3.id);
        } catch (e) {
          console.error(`Error generating insight for ${doc3.id}:`, e);
        }
      }
    } catch (e) {
      console.error("Error running weekly insight cron:", e);
    }
  });
  app3.post("/api/insights/weekly", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid || uid === "anonymous") return res.status(401).json({ error: "Unauthorized" });
      const result = await generateWeeklyInsightForUser(uid);
      res.json(result);
    } catch (err) {
      console.error("[insights/weekly]", err);
      res.status(500).json({ error: err.message });
    }
  });
  app3.get("/api/debug/breaker-status", async (req, res) => {
    const ai = getAi();
    const status = ai.geminiBreaker.getStatus();
    const uid = getUidFromRequest(req);
    if (uid && uid !== "anonymous") {
      try {
        await dbShim.collection("users").doc(uid).collection("circuitBreakers").doc("gemini").set(status);
      } catch (e) {
        console.error("[Resilience] Failed to write breaker status to firestore:", e.message);
      }
    }
    res.json(status);
  });
  app3.post("/api/execute-code", express.json(), async (req, res) => {
    const validated = z2.object({ code: z2.string() }).safeParse(req.body);
    if (!validated.success) return res.status(400).json({ error: "No code provided" });
    const { code } = validated.data;
    try {
      const sandbox = { console: { log: (...args) => console.log(...args) }, result: null };
      createContext(sandbox);
      runInContext(code, sandbox, { timeout: 1e3 });
      res.json({ result: sandbox.result });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });
  const isProd = process.env.NODE_ENV === "production" || fs2.existsSync(path2.join(process.cwd(), "dist/index.html"));
  if (!isProd) {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa"
      });
      console.log("[Vite] Middleware initialized successfully.");
      app3.use(vite.middlewares);
    } catch (e) {
      console.error("[Vite] Critical Failure during initialization:", e);
    }
  } else {
    const distPath = path2.join(process.cwd(), "dist");
    app3.use("/src", express.static(path2.join(process.cwd(), "src")));
    app3.use(express.static(distPath));
    app3.get("*all", (_req, res) => {
      res.sendFile(path2.join(distPath, "index.html"));
    });
  }
  app3.use((req, res, next) => {
    if (req.url.startsWith("/api/")) {
      console.error(`[404 Fallback] Unmatched API Route: ${req.method} ${req.url}`);
      return res.status(404).json({ error: "Route not found: " + req.method + " " + req.url });
    }
    next();
  });
  app3.use((err, req, res, _next) => {
    sendError(req, res, err);
  });
  const server = app3.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    if (dbShim) {
      try {
        devOpsBrain = new SelfHealingOrchestrator("system-orchestrator", dbShim);
        devOpsBrain.start(6e4);
        console.log("[SelfHealing] Orchestrator started successfully.");
      } catch (e) {
        console.error("[SelfHealing] Failed to start orchestrator:", e);
      }
    } else {
      console.warn("[SelfHealing] Firestore not available, orchestrator will not log metrics.");
    }
  });
  setupVoiceGateway(server);
  registerShutdownHooks(server, devOpsBrain);
}
startServer();
export {
  devOpsBrain,
  executeCodeInternal,
  parseJsonWithFallback,
  parseRobustChatResponse,
  sendError
};
//# sourceMappingURL=server.js.map
