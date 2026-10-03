import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HelpWidget, LogsWidget, VitalsWidget } from '../CommandWidgets.js';

describe('HelpWidget', () => {
  const commands = [
    { cmd: '/help', desc: 'Display this command directory.' },
    { cmd: '/vitals', desc: 'Acquire engine health.' },
  ];

  it('renders every command with its description', () => {
    render(<HelpWidget commands={commands} onCommandClick={vi.fn()} />);
    expect(screen.getByText('/help')).toBeInTheDocument();
    expect(screen.getByText('/vitals')).toBeInTheDocument();
    expect(screen.getByText('Acquire engine health.')).toBeInTheDocument();
  });

  it('invokes onCommandClick with the command when a button is clicked', () => {
    const onCommandClick = vi.fn();
    render(<HelpWidget commands={commands} onCommandClick={onCommandClick} />);
    fireEvent.click(screen.getByText('/vitals'));
    expect(onCommandClick).toHaveBeenCalledWith('/vitals');
  });
});

describe('VitalsWidget', () => {
  const vitals = {
    resonance: 88.6,
    entropy: 12.2,
    stability: 75,
    cpu: 40,
    memory: 60,
    latency: 150,
    errors: 0,
  };

  it('rounds the cognitive vectors and shows the contextual counts', () => {
    render(<VitalsWidget vitals={vitals} memoryCount={5} logCount={9} />);
    expect(screen.getByText('89%')).toBeInTheDocument(); // rounded resonance
    expect(screen.getByText('12%')).toBeInTheDocument(); // rounded entropy
    expect(screen.getByText('5 Concept Nodes')).toBeInTheDocument();
    expect(screen.getByText('9 Log Packets')).toBeInTheDocument();
    expect(screen.getByText('150 ms')).toBeInTheDocument();
    expect(screen.getByText('0 Faults')).toBeInTheDocument();
  });
});

describe('LogsWidget', () => {
  it('shows an empty-state message when there are no logs', () => {
    render(<LogsWidget logs={[]} />);
    expect(screen.getByText('No logged packets found.')).toBeInTheDocument();
  });

  it('renders each log entry with its level and message', () => {
    const logs = [
      { id: '1', timestamp: Date.now(), level: 'ERROR', source: 'SYS', message: 'kernel panic' },
    ] as any;
    render(<LogsWidget logs={logs} />);
    expect(screen.getByText('kernel panic')).toBeInTheDocument();
    expect(screen.getByText('[ERROR]')).toBeInTheDocument();
    expect(screen.getByText('(SYS):')).toBeInTheDocument();
  });
});
