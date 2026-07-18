import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../src/App';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
const jest = vi;

// Mock the API layer and Firebase
jest.mock('../src/lib/api', () => ({
  fetchNudgeMemory: jest.fn().mockResolvedValue(null),
  logSystemEvent: jest.fn(),
  fetchConsolidationProposal: jest.fn().mockResolvedValue(null),
  confirmMemory: jest.fn(),
  getLatestUnconsolidatedChatId: jest.fn().mockResolvedValue(null),
  fetchInsight: jest.fn().mockResolvedValue(null),
  saveInsightMemory: jest.fn(),
  ingestTelemetry: jest.fn()
}));

jest.mock('../src/firebase', () => ({
  auth: {},
  db: {},
  signInAnonymously: jest.fn().mockResolvedValue({ user: { uid: 'test-user-123' } }),
  onAuthStateChanged: jest.fn((auth, cb) => {
    cb({ uid: 'test-user-123' });
    return () => {};
  }),
  handleFirestoreError: jest.fn()
}));

describe('Arcane Quantum Brain - Main Application', () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    jest.clearAllMocks();
    // Clear local storage for clean state
    localStorage.clear();
  });

  it('renders the landing screen by default', () => {
    render(<App />);
    expect(screen.getByText(/Neural Link/i)).toBeInTheDocument();
  });

  it('shows the onboarding wizard on first load in dashboard', () => {
    render(<App />);
    
    // Simulate clicking Begin to enter dashboard
    const beginButton = screen.getByText(/Neural Link/i);
    fireEvent.click(beginButton);
    
    // Welcome step of onboarding should be visible
    expect(screen.getByText('Welcome to Arcane Quantum Brain')).toBeInTheDocument();
  });

  it('hides onboarding wizard if previously completed', () => {
    localStorage.setItem('onboardingComplete', 'true');
    render(<App />);
    
    // Simulate clicking Begin to enter dashboard
    const beginButton = screen.getByText(/Neural Link/i);
    fireEvent.click(beginButton);
    
    // Onboarding should not be visible
    expect(screen.queryByText('Welcome to Arcane Quantum Brain')).not.toBeInTheDocument();
    
    // Instead we should see the main dashboard elements
    expect(screen.getByText('AQB')).toBeInTheDocument();
  });
});
