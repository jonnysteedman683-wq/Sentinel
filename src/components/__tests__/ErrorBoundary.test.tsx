import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/api.js', () => ({ ingestTelemetry: vi.fn().mockResolvedValue(undefined) }));

import { ingestTelemetry } from '../../lib/api.js';
import { ErrorBoundary } from '../ErrorBoundary.js';

const Boom = () => {
  throw new Error('kaboom');
};

const originalLocation = window.location;

beforeEach(() => {
  vi.mocked(ingestTelemetry).mockClear();
  // jsdom does not implement navigation; stub reload/href.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { href: 'http://localhost/', reload: vi.fn() },
  });
  // Suppress the expected React error-boundary console noise.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('all good')).toBeInTheDocument();
  });

  it('renders the fallback UI and surfaces the error message on a crash', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Cognitive Thread Aborted')).toBeInTheDocument();
    expect(screen.getByText('kaboom')).toBeInTheDocument();
  });

  it('dispatches fatal-error telemetry when it catches an error', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(ingestTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'REACT_FATAL_UI_ERROR',
        data: expect.objectContaining({ message: 'kaboom', name: 'Error' }),
      }),
    );
  });

  it('resets by clearing session state and reloading on Neural Resync', () => {
    window.localStorage.setItem('cognitive-session', 'stale');
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByText('Neural Resync'));
    expect(window.localStorage.getItem('cognitive-session')).toBeNull();
    expect(window.location.reload).toHaveBeenCalled();
  });

  it('copies diagnostics to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByText('Copy Diagnostics'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('kaboom'));
    await waitFor(() => expect(screen.getByText('Diagnostics Copied')).toBeInTheDocument());
  });

  it('reveals the advanced stack trace when expanded', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.queryByText('Runtime Stack Trace:')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Advanced Diagnostic Stack Trace'));
    expect(screen.getByText('Runtime Stack Trace:')).toBeInTheDocument();
  });
});
