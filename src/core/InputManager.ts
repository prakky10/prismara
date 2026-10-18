/**
 * One input abstraction for keyboard, gamepad and the on-screen touch pad.
 *
 * Scenes ask for *actions* ("up", "confirm") rather than keys, so the same code
 * drives a desktop keyboard, a controller and a phone. `justPressed` is
 * edge-triggered and survives the whole frame, which is what menus want.
 */

import Phaser from 'phaser';

export type InputAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'confirm'
  | 'cancel'
  | 'menu'
  | 'run'
  | 'interact'
  | 'page-left'
  | 'page-right';

/** Virtual buttons the touch pad can press. */
export const TOUCH_ACTIONS: InputAction[] = [
  'up',
  'down',
  'left',
  'right',
  'confirm',
  'cancel',
  'menu',
];

interface Binding {
  keys: string[];
  gamepadButtons: number[];
}

const BINDINGS: Record<InputAction, Binding> = {
  up: { keys: ['UP', 'W'], gamepadButtons: [12] },
  down: { keys: ['DOWN', 'S'], gamepadButtons: [13] },
  left: { keys: ['LEFT', 'A'], gamepadButtons: [14] },
  right: { keys: ['RIGHT', 'D'], gamepadButtons: [15] },
  confirm: { keys: ['Z', 'SPACE', 'ENTER'], gamepadButtons: [0] },
  cancel: { keys: ['X', 'ESC', 'BACKSPACE'], gamepadButtons: [1] },
  menu: { keys: ['C', 'TAB'], gamepadButtons: [9] },
  run: { keys: ['SHIFT'], gamepadButtons: [10] },
  interact: { keys: ['Z', 'SPACE', 'ENTER'], gamepadButtons: [0] },
  'page-left': { keys: ['Q', 'OPEN_BRACKET'], gamepadButtons: [4] },
  'page-right': { keys: ['E', 'CLOSED_BRACKET'], gamepadButtons: [5] },
};

export class InputManager {
  private readonly scene: Phaser.Scene;
  private readonly cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly keys = new Map<string, Phaser.Input.Keyboard.Key>();
  private readonly down = new Set<InputAction>();
  private readonly justPressedSet = new Set<InputAction>();
  private readonly justReleasedSet = new Set<InputAction>();

  /** Touch pad buttons currently held, set by the TouchPad component. */
  private readonly touchDown = new Set<InputAction>();

  /** Set false while a text field or transition should swallow input. */
  enabled = true;

  /** Freeze everything (used during cutscenes and animations). */
  locked = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const kb = scene.input.keyboard;
    if (kb) {
      this.cursors = kb.createCursorKeys();
      for (const binding of Object.values(BINDINGS)) {
        for (const keyName of binding.keys) {
          if (!this.keys.has(keyName)) {
            this.keys.set(keyName, kb.addKey(keyName, true, false));
          }
        }
      }
      // Stop the browser scrolling the page with arrows/space.
      kb.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT', 'SPACE']);
    }

    // Gamepad: polled in update(), but also handle connect/disconnect.
    scene.input.gamepad?.once('connected', () => {
      /* pad is now available via scene.input.gamepad */
    });
  }

  /** Call once per frame, before anything reads the state. */
  update(): void {
    const pressed = new Set<InputAction>();

    if (this.enabled && !this.locked) {
      for (const [action, binding] of Object.entries(BINDINGS) as Array<[InputAction, Binding]>) {
        let isDown = false;

        // Keyboard.
        for (const keyName of binding.keys) {
          const key = this.keys.get(keyName);
          if (key?.isDown) {
            isDown = true;
            break;
          }
        }
        // Special-cased cursor keys use Phaser's own objects.
        if (!isDown && this.cursors) {
          if (action === 'up' && this.cursors.up.isDown) isDown = true;
          if (action === 'down' && this.cursors.down.isDown) isDown = true;
          if (action === 'left' && this.cursors.left.isDown) isDown = true;
          if (action === 'right' && this.cursors.right.isDown) isDown = true;
          if (action === 'confirm' && this.cursors.space.isDown) isDown = true;
        }
        // Gamepad.
        if (!isDown) {
          const pads = this.scene.input.gamepad?.gamepads ?? [];
          for (const pad of pads) {
            if (!pad) continue;
            for (const index of binding.gamepadButtons) {
              if (pad.buttons[index]?.pressed) {
                isDown = true;
                break;
              }
            }
            if (isDown) break;
          }
        }
        // Touch.
        if (!isDown && this.touchDown.has(action)) isDown = true;

        if (isDown) pressed.add(action);
      }
    }

    this.justPressedSet.clear();
    this.justReleasedSet.clear();
    for (const action of pressed) {
      if (!this.down.has(action)) this.justPressedSet.add(action);
    }
    for (const action of this.down) {
      if (!pressed.has(action)) this.justReleasedSet.add(action);
    }
    this.down.clear();
    for (const action of pressed) this.down.add(action);
  }

  isDown(action: InputAction): boolean {
    return this.enabled && this.down.has(action);
  }

  justPressed(action: InputAction): boolean {
    return this.enabled && this.justPressedSet.has(action);
  }

  justReleased(action: InputAction): boolean {
    return this.enabled && this.justReleasedSet.has(action);
  }

  /**
   * Menu navigation helper: returns the direction of a fresh press, handling
   * repeat when a direction is held (after `repeatDelayMs`).
   */
  direction(now: number, firstDelay = 380, repeatDelay = 130): -1 | 0 | 1 | { vertical: -1 | 0 | 1 } {
    // Vertical convenience used by most menus; horizontal is read separately.
    const up = this.justPressed('up');
    const down = this.justPressed('down');
    if (up) return -1;
    if (down) return 1;
    if (now - this.lastNavAt > firstDelay + repeatDelay) {
      // Held navigation is handled by scenes calling pollRepeat.
    }
    return 0;
  }

  private lastNavAt = 0;

  /**
   * Repeat-friendly vertical navigation. Returns -1/0/1 and manages its own
   * timer so holding a direction scrolls a list.
   */
  verticalNav(time: number, firstDelay = 360, repeatDelay = 120): -1 | 0 | 1 {
    const up = this.isDown('up');
    const down = this.isDown('down');
    const upFresh = this.justPressed('up');
    const downFresh = this.justPressed('down');

    if (upFresh || downFresh) {
      this.lastNavAt = time;
      this.navDirection = upFresh ? -1 : 1;
      return this.navDirection;
    }
    if (!up && !down) {
      this.navDirection = 0;
      return 0;
    }
    const held = up ? -1 : down ? 1 : 0;
    if (held === this.navDirection || this.navDirection === 0) {
      const delay = this.navDirection === 0 ? firstDelay : repeatDelay;
      if (time - this.lastNavAt >= delay) {
        this.lastNavAt = time;
        this.navDirection = held;
        return held;
      }
    }
    return 0;
  }

  private navDirection: -1 | 0 | 1 = 0;

  /** Same as verticalNav but for horizontal lists. */
  horizontalNav(time: number, firstDelay = 360, repeatDelay = 120): -1 | 0 | 1 {
    const left = this.isDown('left');
    const right = this.isDown('right');
    const leftFresh = this.justPressed('left');
    const rightFresh = this.justPressed('right');

    if (leftFresh || rightFresh) {
      this.lastNavAtH = time;
      this.navDirectionH = leftFresh ? -1 : 1;
      return this.navDirectionH;
    }
    if (!left && !right) {
      this.navDirectionH = 0;
      return 0;
    }
    const held = left ? -1 : right ? 1 : 0;
    if (held === this.navDirectionH || this.navDirectionH === 0) {
      const delay = this.navDirectionH === 0 ? firstDelay : repeatDelay;
      if (time - this.lastNavAtH >= delay) {
        this.lastNavAtH = time;
        this.navDirectionH = held;
        return held;
      }
    }
    return 0;
  }

  private lastNavAtH = 0;
  private navDirectionH: -1 | 0 | 1 = 0;

  /** Called by the touch pad when a virtual button is pressed/released. */
  setTouch(action: InputAction, isDown: boolean): void {
    if (isDown) this.touchDown.add(action);
    else this.touchDown.delete(action);
  }

  clearTouch(): void {
    this.touchDown.clear();
  }

  /** A 2D movement vector in tile units, from any device. */
  movementVector(): { x: number; y: number } {
    const x = (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
    const y = (this.isDown('down') ? 1 : 0) - (this.isDown('up') ? 1 : 0);
    if (x !== 0 && y !== 0) return { x, y: 0 };
    return { x, y };
  }

  destroy(): void {
    this.keys.forEach((key) => key.destroy());
    this.keys.clear();
  }
}
