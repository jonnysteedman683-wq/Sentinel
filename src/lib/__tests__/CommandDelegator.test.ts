import { describe, expect, it, vi } from 'vitest';
import { type CommandContext, handleSlashCommand } from '../CommandDelegator.js';

function makeContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    uid: 'user-1',
    db: {},
    auth: {},
    vitals: { cpu: 0.5, health: 'nominal' },
    systemLogs: Array.from({ length: 60 }, (_, i) => ({ id: i })),
    memories: [{ id: 'm1' }, { id: 'm2' }],
    setDepth: vi.fn(),
    setActivePersona: vi.fn(),
    handleManualConsolidate: vi.fn(async () => {}),
    clearChat: vi.fn(async () => {}),
    triggerNudge: vi.fn(),
    addLog: vi.fn(),
    ...overrides,
  };
}

describe('handleSlashCommand', () => {
  it('ignores input that is not a slash command', async () => {
    const ctx = makeContext();
    expect(await handleSlashCommand('hello there', ctx)).toEqual({ handled: false });
    expect(ctx.addLog).not.toHaveBeenCalled();
  });

  it('logs delegation for a recognised command', async () => {
    const ctx = makeContext();
    await handleSlashCommand('/vitals', ctx);
    expect(ctx.addLog).toHaveBeenCalledWith(
      expect.stringContaining('Delegating command: /vitals'),
      'NEURAL',
      'DELEGATOR',
    );
  });

  it('is case-insensitive on the command name', async () => {
    const parsed = await handleSlashCommand('/HELP', makeContext());
    expect(parsed.systemUI).toBe('help');
  });

  it('returns the command directory for /help', async () => {
    const res = await handleSlashCommand('/help', makeContext());
    expect(res.handled).toBe(true);
    expect(res.systemUI).toBe('help');
    expect(Array.isArray(res.systemUIData.commands)).toBe(true);
    expect(res.systemUIData.commands.length).toBeGreaterThan(0);
  });

  it('surfaces vitals with contextual counts for /vitals and /status', async () => {
    const ctx = makeContext();
    for (const cmd of ['/vitals', '/status']) {
      const res = await handleSlashCommand(cmd, ctx);
      expect(res.systemUI).toBe('vitals');
      expect(res.systemUIData.memoryCount).toBe(2);
      expect(res.systemUIData.logCount).toBe(60);
      expect(res.systemUIData.vitals).toBe(ctx.vitals);
    }
  });

  it('requires an argument for /persona and uppercases the requested name', async () => {
    expect((await handleSlashCommand('/persona', makeContext())).content).toContain(
      'requires an argument',
    );
    const res = await handleSlashCommand('/persona aqb_standard', makeContext());
    expect(res.systemUIData.requestedPersona).toBe('AQB_STANDARD');
  });

  describe('/depth', () => {
    it('requires an argument', async () => {
      const ctx = makeContext();
      const res = await handleSlashCommand('/depth', ctx);
      expect(res.content).toContain('requires an argument');
      expect(ctx.setDepth).not.toHaveBeenCalled();
    });

    it.each([
      ['/depth fast', 'Fast'],
      ['/depth Deep Reasoning', 'Deep Reasoning'],
      ['/depth deep', 'Deep Reasoning'],
      ['/depth balanced', 'Balanced'],
      ['/depth anything-else', 'Balanced'],
    ] as const)('%s configures depth to %s', async (input, expected) => {
      const ctx = makeContext();
      await handleSlashCommand(input, ctx);
      expect(ctx.setDepth).toHaveBeenCalledWith(expected);
    });
  });

  describe('/logs', () => {
    it('defaults to 10 entries', async () => {
      const res = await handleSlashCommand('/logs', makeContext());
      expect(res.systemUI).toBe('logs');
      expect(res.systemUIData.logs).toHaveLength(10);
    });

    it('caps the requested count at 50', async () => {
      const res = await handleSlashCommand('/logs 100', makeContext());
      expect(res.systemUIData.logs).toHaveLength(50);
    });
  });

  describe('/consolidate', () => {
    it('runs consolidation and reports success', async () => {
      const ctx = makeContext();
      const res = await handleSlashCommand('/consolidate', ctx);
      expect(ctx.handleManualConsolidate).toHaveBeenCalledOnce();
      expect(res.content).toContain('completed successfully');
    });

    it('reports the error when consolidation throws', async () => {
      const ctx = makeContext({
        handleManualConsolidate: vi.fn(async () => {
          throw new Error('defrag stalled');
        }),
      });
      const res = await handleSlashCommand('/consolidate', ctx);
      expect(res.content).toContain('defrag stalled');
      expect(ctx.addLog).toHaveBeenCalledWith(
        expect.stringContaining('Consolidation failed'),
        'ERROR',
        'NEURAL',
      );
    });
  });

  it('fires the nudge callback for /nudge', async () => {
    const ctx = makeContext();
    await handleSlashCommand('/nudge', ctx);
    expect(ctx.triggerNudge).toHaveBeenCalledOnce();
  });

  it('clears the chat for /clear', async () => {
    const ctx = makeContext();
    await handleSlashCommand('/clear', ctx);
    expect(ctx.clearChat).toHaveBeenCalledOnce();
  });

  describe('/erd', () => {
    it('requires a text argument', async () => {
      expect((await handleSlashCommand('/erd', makeContext())).content).toContain(
        'Missing text argument',
      );
    });

    it('routes the joined text to the qpu-erd panel', async () => {
      const res = await handleSlashCommand('/erd tumour suppressor gene', makeContext());
      expect(res.systemUI).toBe('qpu-erd');
      expect(res.systemUIData.text).toBe('tumour suppressor gene');
    });
  });

  it('routes /diagnose and /reboot to their panels', async () => {
    expect((await handleSlashCommand('/diagnose', makeContext())).systemUI).toBe('diagnose');
    expect((await handleSlashCommand('/reboot', makeContext())).systemUI).toBe('reboot');
  });

  it('returns an unrecognised message for unknown commands', async () => {
    const res = await handleSlashCommand('/wibble', makeContext());
    expect(res.handled).toBe(true);
    expect(res.content).toContain('Command unrecognized');
    expect(res.content).toContain('/wibble');
  });
});
