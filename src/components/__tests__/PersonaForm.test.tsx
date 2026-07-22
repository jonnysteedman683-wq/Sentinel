import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../firebase.js', () => ({ db: { __db: true }, auth: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => 'persona-doc-ref'),
  setDoc: vi.fn(async () => {}),
}));
vi.mock('react-firebase-hooks/auth', () => ({ useAuthState: vi.fn(() => [null]) }));

import { doc, setDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { PersonaForm } from '../PersonaForm.js';

function signInAs(uid: string | null) {
  vi.mocked(useAuthState).mockReturnValue([uid ? ({ uid } as any) : null, false, undefined] as any);
}

function fillForm() {
  fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Nova' } });
  fireEvent.change(screen.getByPlaceholderText('Description'), {
    target: { value: 'calm and precise' },
  });
  fireEvent.change(screen.getByPlaceholderText('Signature'), { target: { value: '~N' } });
}

beforeEach(() => {
  vi.mocked(setDoc)
    .mockReset()
    .mockResolvedValue(undefined as any);
  vi.mocked(doc).mockClear();
  vi.stubGlobal('alert', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PersonaForm', () => {
  it('renders nothing when there is no signed-in user', () => {
    signInAs(null);
    const { container } = render(<PersonaForm />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the form for a signed-in user', () => {
    signInAs('user-1');
    render(<PersonaForm />);
    expect(screen.getByText('Custom Persona')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();
  });

  it('persists the persona to the user document on submit', async () => {
    signInAs('user-1');
    render(<PersonaForm />);
    fillForm();
    fireEvent.click(screen.getByText('Save Persona'));

    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));
    expect(doc).toHaveBeenCalledWith(expect.anything(), 'users', 'user-1', 'persona', 'default');
    expect(setDoc).toHaveBeenCalledWith(
      'persona-doc-ref',
      expect.objectContaining({ name: 'Nova', description: 'calm and precise', signature: '~N' }),
    );
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Persona saved!'));
  });

  it('alerts the user when saving fails', async () => {
    signInAs('user-1');
    vi.mocked(setDoc).mockRejectedValueOnce(new Error('offline'));
    render(<PersonaForm />);
    fillForm();
    fireEvent.click(screen.getByText('Save Persona'));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Failed to save persona'));
  });
});
