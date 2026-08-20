import { KeybindingPair, StorageVault } from '../types';

/**
 * Format a KeyboardEvent into a human-readable keybinding string.
 * Example: 'Ctrl+B', 'Alt+ArrowLeft', 'Space', 'Enter', '1', 'D', 'F'
 */
export function formatKeyEvent(e: KeyboardEvent | React.KeyboardEvent): string {
  const parts: string[] = [];

  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');

  let key = e.key;

  // Normalize special keys
  if (key === ' ') {
    key = 'Space';
  } else if (key === 'Delete' || key === 'Del') {
    key = 'Delete';
  } else if (key.length === 1) {
    key = key.toUpperCase();
  }

  // Avoid duplicate modifier names
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
    return parts.join('+');
  }

  parts.push(key);
  return parts.join('+');
}

/**
 * Test if a KeyboardEvent matches a configured single keybinding string.
 */
export function matchesKeybinding(e: KeyboardEvent, binding?: string): boolean {
  if (!binding || !binding.trim()) return false;

  const eventFormatted = formatKeyEvent(e).toLowerCase();
  const bindingNormalized = binding.trim().toLowerCase();

  if (eventFormatted === bindingNormalized) return true;

  // Single key fallback without modifiers (e.g. '1', 'Q', 'D', 'Space', 'Delete', 'Enter', 'Backspace')
  if (!e.ctrlKey && !e.altKey && !e.metaKey) {
    if (bindingNormalized === 'space' && (e.code === 'Space' || e.key === ' ')) return true;
    if (bindingNormalized === 'enter' && e.key === 'Enter') return true;
    if (bindingNormalized === 'escape' && (e.key === 'Escape' || e.key === 'Esc')) return true;
    if ((bindingNormalized === 'delete' || bindingNormalized === 'del') && (e.key === 'Delete' || e.code === 'Delete')) return true;
    if (bindingNormalized === 'backspace' && (e.key === 'Backspace' || e.code === 'Backspace')) return true;
    if (e.key.toLowerCase() === bindingNormalized) return true;
  }

  return false;
}

/**
 * Test if a KeyboardEvent matches either the primary OR secondary keybinding of an action.
 */
export function matchesActionBinding(
  e: KeyboardEvent, 
  pair?: KeybindingPair | string
): boolean {
  if (!pair) return false;
  if (typeof pair === 'string') {
    return matchesKeybinding(e, pair);
  }
  if (matchesKeybinding(e, pair.primary)) return true;
  if (pair.secondary && matchesKeybinding(e, pair.secondary)) return true;
  return false;
}

/**
 * Test if a KeyboardEvent matches either the 1st or 2nd shortcut key of a vault.
 */
export function matchesVaultBinding(e: KeyboardEvent, vault: StorageVault): boolean {
  if (matchesKeybinding(e, vault.shortcutKey)) return true;
  if (vault.secondaryKey && matchesKeybinding(e, vault.secondaryKey)) return true;
  return false;
}

/**
 * Helper to normalize KeybindingPair for backwards compatibility with string configs.
 */
export function normalizeKeybindingPair(
  raw: any, 
  defaultPrimary: string = '', 
  defaultSecondary: string = ''
): KeybindingPair {
  if (!raw) return { primary: defaultPrimary, secondary: defaultSecondary };
  if (typeof raw === 'string') return { primary: raw, secondary: defaultSecondary };
  return {
    primary: raw.primary !== undefined ? raw.primary : defaultPrimary,
    secondary: raw.secondary !== undefined ? raw.secondary : defaultSecondary,
  };
}
