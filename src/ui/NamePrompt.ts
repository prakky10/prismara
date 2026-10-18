/**
 * Name entry.
 *
 * Phaser has no text field, so this overlays a real (but styled) HTML input on
 * top of the canvas — which is also what makes it work with a phone keyboard.
 */

import Phaser from 'phaser';
import { FONTS, VIEW_HEIGHT, VIEW_WIDTH } from './Theme';

const MAX_LENGTH = 12;

export function promptName(
  scene: Phaser.Scene,
  label: string,
  initial = '',
  placeholder = 'Trainer',
): Promise<string> {
  return new Promise((resolve) => {
    const canvas = scene.game.canvas;
    const rect = canvas.getBoundingClientRect();

    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.left = `${rect.left}px`;
    overlay.style.top = `${rect.top}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.gap = '14px';
    overlay.style.background = 'rgba(5, 7, 15, 0.82)';
    overlay.style.zIndex = '20';
    overlay.style.fontFamily = FONTS.body;

    const scale = rect.width / VIEW_WIDTH;

    const title = document.createElement('div');
    title.textContent = label;
    title.style.color = '#f2f6ff';
    title.style.fontSize = `${Math.round(20 * scale)}px`;
    title.style.letterSpacing = '0.04em';
    title.style.textAlign = 'center';

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = MAX_LENGTH;
    input.value = initial;
    input.placeholder = placeholder;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.style.width = `${Math.round(260 * scale)}px`;
    input.style.padding = `${Math.round(10 * scale)}px ${Math.round(16 * scale)}px`;
    input.style.fontSize = `${Math.round(18 * scale)}px`;
    input.style.fontFamily = FONTS.body;
    input.style.textAlign = 'center';
    input.style.borderRadius = `${Math.round(10 * scale)}px`;
    input.style.border = '2px solid #3d5480';
    input.style.background = '#111a30';
    input.style.color = '#f2f6ff';
    input.style.outline = 'none';

    const hint = document.createElement('div');
    hint.textContent = 'Press Enter to confirm';
    hint.style.color = '#6d7d99';
    hint.style.fontSize = `${Math.round(13 * scale)}px`;

    overlay.append(title, input, hint);
    document.body.appendChild(overlay);

    // Pause game input so typing does not drive menus.
    const manager = scene.input;
    manager.enabled = false;

    const cleanup = (value: string) => {
      window.removeEventListener('keydown', onKey, true);
      overlay.remove();
      manager.enabled = true;
      resolve(value.trim().slice(0, MAX_LENGTH) || placeholder);
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        cleanup(input.value);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        cleanup(initial || placeholder);
      }
      event.stopPropagation();
    };

    window.addEventListener('keydown', onKey, true);
    window.setTimeout(() => input.focus(), 30);

    // Mobile: confirm via the keyboard's go button.
    input.addEventListener('keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Enter') {
        event.preventDefault();
        cleanup(input.value);
      }
    });

    void VIEW_HEIGHT;
  });
}
