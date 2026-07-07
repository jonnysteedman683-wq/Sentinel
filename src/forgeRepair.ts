// ============================================================================
// forgeRepair.ts — Sentinel Self-Correction Loop
// Run → on fault, feed stack trace back to Gemini → retry (max 3)
// successScore decays 1.0 → 0.75 → 0.5 → 0.25 per repair attempt
// ============================================================================

import { getGeminiClient } from './geminiClient';

const MODEL_ID = 'gemini-2.5-flash';
const EXEC_TIMEOUT_MS = 5000;
const MAX_ATTEMPTS = 3;

export interface SandboxResult {
  ok: boolean;
  logs: string[];
  error?: string;
}

export interface RepairOutcome {
  ok: boolean;
  code: string;           // final (possibly repaired) code
  attempts: number;       // repair cycles consumed (0 = passed first try)
  successScore: number;   // write this to db.skills
  logs: string[];
}

type LogFn = (level: 'log' | 'warn' | 'error' | 'success' | 'system', text: string) => void;

// ---------------------------------------------------------------------------
// Sandbox (same Blob-Worker isolation as ForgePanel, promisified)
// ---------------------------------------------------------------------------

function workerSource(userCode: string): string {
  return `
    const __post = (level, args) => self.postMessage({ type: 'console', level,
      text: args.map(a => { try { return typeof a === 'string' ? a : JSON.stringify(a); }
        catch { return String(a); } }).join(' ') });
    ['log','warn','error','info'].forEach(l => { console[l] = (...a) => __post(l==='info'?'log':l, a); });
    try {
      (function () { ${userCode}\n })();
      self.postMessage({ type: 'done' });
    } catch (err) {
      self.postMessage({ type: 'fatal', text: err && err.stack ? err.stack : String(err) });
    }
  `;
}

export function runSandbox(code: string, timeoutMs = EXEC_TIMEOUT_MS): Promise<SandboxResult> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(new Blob([workerSource(code)], { type: 'application/javascript' }));
    const worker = new Worker(url);
    const logs: string[] = [];

    const finish = (ok: boolean, error?: string) => {
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve({ ok, logs, error });
    };

    const timer = setTimeout(() => finish(false, `Watchdog timeout after ${timeoutMs}ms (possible infinite loop)`), timeoutMs);

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data as { type: string; text?: string };
      if (msg.type === 'console') logs.push(msg.text ?? '');
      else if (msg.type === 'done') finish(true);
      else if (msg.type === 'fatal') finish(false, msg.text);
    };
    worker.onerror = e => finish(false, e.message);
  });
}

// ---------------------------------------------------------------------------
// Repair codegen
// ---------------------------------------------------------------------------

function sanitize(raw: string): string {
  const m = raw.trim().match(/^\s*```(?:javascript|js|typescript|ts)?\s*([\s\S]*?)```\s*$/i);
  return m ? m[1].trim() : raw.trim();
}

async function requestFix(directive: string, brokenCode: string, error: string): Promise<string> {
  const res = await getGeminiClient().models.generateContent({
    model: MODEL_ID,
    contents:
      `Original directive: ${directive}\n\n` +
      `This code failed in a Web Worker sandbox:\n${brokenCode}\n\n` +
      `Runtime error:\n${error}\n\n` +
      `Return ONLY the corrected, complete, raw JavaScript. No markdown, no commentary. ` +
      `Vanilla JS only (no DOM/window/imports). Invoke the utility and console.log results at the end.`,
    config: { temperature: 0.1 },
  });
  const fixed = sanitize(res.text ?? '');
  if (!fixed) throw new Error('Repair model returned empty payload');
  return fixed;
}

// ---------------------------------------------------------------------------
// Public API: run + auto-repair loop
// ---------------------------------------------------------------------------

export async function autoRepair(
  directive: string,
  initialCode: string,
  onLog?: LogFn,
): Promise<RepairOutcome> {
  const log: LogFn = (lvl, txt) => onLog?.(lvl, txt);
  let code = initialCode;
  const allLogs: string[] = [];

  for (let attempt = 0; attempt <= MAX_ATTEMPTS; attempt++) {
    log('system', attempt === 0
      ? 'SELF-CORRECTION // initial verification run'
      : `SELF-CORRECTION // repair cycle ${attempt}/${MAX_ATTEMPTS}`);

    const result = await runSandbox(code);
    result.logs.forEach(l => { allLogs.push(l); log('log', l); });

    if (result.ok) {
      const successScore = Math.max(0.25, 1 - attempt * 0.25);
      log('success', `Verified after ${attempt} repair(s) — successScore ${successScore.toFixed(2)}`);
      return { ok: true, code, attempts: attempt, successScore, logs: allLogs };
    }

    log('error', `Fault: ${result.error}`);
    if (attempt === MAX_ATTEMPTS) break;

    log('warn', 'Dispatching stack trace to Gemini for structural repair…');
    try {
      code = await requestFix(directive, code, result.error ?? 'unknown');
      log('system', `Patched artifact received (${code.split('\n').length} lines) — re-verifying.`);
    } catch (err) {
      log('error', `Repair codegen failed: ${err instanceof Error ? err.message : String(err)}`);
      break;
    }
  }

  log('error', 'Self-correction exhausted — skill rejected, not eligible for library.');
  return { ok: false, code, attempts: MAX_ATTEMPTS, successScore: 0, logs: allLogs };
}
