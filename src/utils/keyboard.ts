import { KeybindingPair, StorageVault } from '../types';

/**
 * Format a KeyboardEvent into a human-readable keybinding string.
 * Example: 'Ctrl+B', 'Alt+ArrowLeft', 'Space', 'Enter', '1', 'D', 'F'
 */
export function formatKeyEvent(e: KeyboardEvent | React.KeyboardEvent): string {
  const parts: string[] = [];

  // Meta (Win key) is reported separately from Ctrl: collapsing the two made
  // Meta chords indistinguishable from Ctrl chords and a bare Meta keypress
  // display as "Ctrl".
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.metaKey) parts.push('Meta');
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

  // Modifier-only keypress: report just the modifiers (bare Meta → 'Meta')
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
    return parts.join('+');
  }

  parts.push(key);
  return parts.join('+');
}

// Common aliases so stored/hand-edited bindings like 'Esc' or 'Del' still match
// the canonical names formatKeyEvent produces ('Escape', 'Delete').
const KEY_ALIASES: Record<string, string> = { esc: 'escape', del: 'delete' };
const normalizeKeyName = (k: string): string => KEY_ALIASES[k] || k;

/**
 * Test if a KeyboardEvent matches a configured single keybinding string.
 */
export function matchesKeybinding(e: KeyboardEvent, binding?: string): boolean {
  if (!binding || !binding.trim()) return false;

  // Compare as a modifier SET + key instead of strict string equality, so
  // bindings written in any modifier order ('Shift+Ctrl+P') match the event.
  const eventParts = formatKeyEvent(e).split('+').map((p) => p.trim().toLowerCase()).filter(Boolean);
  const eventKey = normalizeKeyName(eventParts[eventParts.length - 1]);
  const eventMods = new Set(eventParts.slice(0, -1));

  const bindingParts = binding.trim().split('+').map((p) => p.trim().toLowerCase()).filter(Boolean);
  const bindingKey = normalizeKeyName(bindingParts[bindingParts.length - 1]);
  const bindingMods = new Set(bindingParts.slice(0, -1));

  const sameMods = eventMods.size === bindingMods.size && [...eventMods].every((m) => bindingMods.has(m));
  if (sameMods && eventKey === bindingKey) return true;

  // Single key fallback without modifiers (e.g. '1', 'Q', 'D', 'Space', 'Delete', 'Enter', 'Backspace')
  if (!e.ctrlKey && !e.altKey && !e.metaKey) {
    if (bindingKey === 'space' && (e.code === 'Space' || e.key === ' ')) return true;
    if (bindingKey === 'enter' && e.key === 'Enter') return true;
    if (bindingKey === 'escape' && (e.key === 'Escape' || e.key === 'Esc')) return true;
    if (bindingKey === 'delete' && (e.key === 'Delete' || e.code === 'Delete')) return true;
    if (bindingKey === 'backspace' && (e.key === 'Backspace' || e.code === 'Backspace')) return true;
    if (normalizeKeyName(e.key.toLowerCase()) === bindingKey) return true;
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
