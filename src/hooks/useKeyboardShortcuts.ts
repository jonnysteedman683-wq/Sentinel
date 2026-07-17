import { useEffect } from 'react';

type ShortcutAction = () => void;

interface ShortcutMap {
  [key: string]: ShortcutAction;
}

/**
 * @param {ShortcutMap} shortcuts - Map of key combinations to actions
 * @example useKeyboardShortcuts({ 'ctrl+m': () => setActiveTab('Memory') });
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const ctrl = event.ctrlKey || event.metaKey;
      const shift = event.shiftKey;
      const alt = event.altKey;

      // Construct a string representation of the shortcut
      let combo = '';
      if (ctrl) combo += 'ctrl+';
      if (alt) combo += 'alt+';
      if (shift) combo += 'shift+';
      combo += key;

      if (shortcuts[combo]) {
        event.preventDefault();
        shortcuts[combo]();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}
