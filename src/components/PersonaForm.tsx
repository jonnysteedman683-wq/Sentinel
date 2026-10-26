import React, { useState } from 'react';
import { db } from '../firebase.js'; // Need to ensure firebase is exported
import { doc, setDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase.js';

export function PersonaForm() {
  const [user] = useAuthState(auth);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [signature, setSignature] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'users', user.uid, 'persona', 'default'), {
        name,
        description,
        signature,
        updatedAt: Date.now()
      });
      alert('Persona saved!');
    } catch (err) {
      console.error(err);
      alert('Failed to save persona');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <form onSubmit={handleSubmit} className="p-4 border rounded shadow-sm">
      <h2 className="text-xl font-bold mb-4">Custom Persona</h2>
      <input type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)} className="w-full mb-2 p-2 border" required />
      <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} className="w-full mb-2 p-2 border" required />
      <input type="text" placeholder="Signature" value={signature} onChange={e => setSignature(e.target.value)} className="w-full mb-2 p-2 border" required />
      <button type="submit" disabled={saving} className="bg-blue-500 text-white p-2 rounded">
        {saving ? 'Saving...' : 'Save Persona'}
      </button>
    </form>
  );
}
