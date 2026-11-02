import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMemoryGraph, parseEnvelopes } from '../../lib/unisync-memory.js';

const apiRequest = vi.fn();
vi.mock('../../lib/api.js', () => ({ apiRequest: (...args: unknown[]) => apiRequest(...args) }));

import UniSyncMemoryPanel from '../UniSyncMemoryPanel.js';

const rows = readFileSync(
  path.join(__dirname, '../../lib/__tests__/fixtures/unisync-ledger.jsonl'),
  'utf8',
)
  .trim()
  .split('\n')
  .map((l) => JSON.parse(l));
const graph = buildMemoryGraph(parseEnvelopes(rows));

describe('UniSyncMemoryPanel', () => {
  beforeEach(() => apiRequest.mockReset());

  it('shows the graph summary and conflicts', async () => {
    apiRequest.mockResolvedValue({ enabled: true, graph });
    render(<UniSyncMemoryPanel />);
    expect(await screen.findByText(/facts at ledger #11/)).toBeInTheDocument();
    expect(screen.getByText('shared/build_cmd', { selector: 'b' })).toBeInTheDocument();
    expect(screen.getByText(/chain verified/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Shared memory graph' })).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith('/unisync/memory', {}, 1);
  });

  it('explains when the server is not connected', async () => {
    apiRequest.mockResolvedValue({ enabled: false, reason: 'Set UNISYNC_SUPABASE_URL' });
    render(<UniSyncMemoryPanel />);
    expect(await screen.findByText(/Not connected: Set UNISYNC_SUPABASE_URL/)).toBeInTheDocument();
  });

  it('flags a chain that needs checking and shows request failures', async () => {
    apiRequest.mockResolvedValueOnce({
      enabled: true,
      graph: { ...graph, chain: { ...graph.chain, continuous: false } },
    });
    const { unmount } = render(<UniSyncMemoryPanel />);
    expect(await screen.findByText(/run linx selftest/)).toBeInTheDocument();
    unmount();
    apiRequest.mockRejectedValueOnce(new Error('offline'));
    render(<UniSyncMemoryPanel />);
    await waitFor(() =>
      expect(screen.getByText(/Could not load shared memory: offline/)).toBeInTheDocument(),
    );
  });
});
