/**
 * The dialogue box: typewriter text, multi-page messages, and choice prompts.
 *
 * Scenes drive it with `show()` and then call `next()` when the confirm action
 * fires; `isActive` tells the scene to route input here instead of the world.
 */

import Phaser from 'phaser';
import { COLORS, DEPTHS, FONTS, LAYOUT, VIEW_HEIGHT, VIEW_WIDTH } from './Theme';
import { Panel } from './Panel';

export interface TextBoxOptions {
  width?: number;
  height?: number;
  /** Milliseconds per character; 0 prints instantly. */
  speedMs?: number;
  showArrow?: boolean;
}

export class TextBox extends Phaser.GameObjects.Container {
  private readonly panel: Panel;
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly nameTag: Phaser.GameObjects.Text;
  private readonly arrow: Phaser.GameObjects.Text;

  private pages: string[] = [];
  private pageIndex = 0;
  private charsShown = 0;
  private fullText = '';
  private onComplete: (() => void) | null = null;
  private timer?: Phaser.Time.TimerEvent;
  private arrowTween?: Phaser.Tweens.Tween;
  private visibilityTween?: Phaser.Tweens.Tween;
  private visibilityEpoch = 0;
  /** Resting y captured on the first show, after any caller setY. */
  private restY?: number;

  /** True while a message is on screen. */
  isActive = false;
  private choiceActive = false;
  private choiceOptions: string[] = [];
  private choiceIndex = 0;
  private onChoice: ((index: number) => void) | null = null;
  private choiceTexts: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene, options: TextBoxOptions = {}) {
    const width = options.width ?? VIEW_WIDTH - 48;
    const height = options.height ?? 122;
    super(scene, VIEW_WIDTH / 2, VIEW_HEIGHT - height / 2 - 18);

    this.panel = new Panel(scene, 0, 0, { width, height, glow: COLORS.panelGlow });
    this.add(this.panel);

    this.nameTag = scene.add
      .text(-width / 2 + 18, -height / 2 - 12, '', {
        fontFamily: FONTS.body,
        fontSize: '13px',
        color: '#7fffe5',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5);
    this.add(this.nameTag);

    this.bodyText = scene.add.text(-width / 2 + 20, -height / 2 + 18, '', {
      fontFamily: FONTS.body,
      fontSize: '17px',
      color: '#f2f6ff',
      wordWrap: { width: width - 44 },
      lineSpacing: 6,
    });
    this.add(this.bodyText);

    this.arrow = scene.add
      .text(width / 2 - 22, height / 2 - 16, '\u25bc', {
        fontFamily: FONTS.body,
        fontSize: '14px',
        color: '#7fffe5',
      })
      .setOrigin(0.5, 0.5)
      .setVisible(false);
    this.add(this.arrow);

    this.speedMs = options.speedMs ?? LAYOUT.textSpeedMs;
    this.showArrow = options.showArrow ?? true;

    this.setDepth(DEPTHS.textbox);
    this.setVisible(false);
    scene.add.existing(this);
  }

  private readonly speedMs: number;
  private readonly showArrow: boolean;

  private clearTyping(): void {
    this.timer?.remove();
    this.timer = undefined;
  }

  /** Drop the in-flight show/hide tween and invalidate its callback. */
  private retireVisibilityTween(): void {
    this.visibilityEpoch += 1;
    this.visibilityTween?.stop();
    this.visibilityTween = undefined;
  }

  /** Show one or more pages of text. `onDone` fires after the last page. */
  show(text: string | string[], onDone?: () => void, speaker?: string): void {
    this.pages = Array.isArray(text) ? text.slice() : [text];
    this.pageIndex = 0;
    this.onComplete = onDone ?? null;
    this.isActive = true;
    this.clearTyping();
    this.retireVisibilityTween();
    const restY = this.restY ?? this.y;
    this.restY = restY;
    this.y = restY;
    this.setVisible(true);
    this.nameTag.setText(speaker ?? '');
    this.setAlpha(0);
    this.visibilityTween = this.scene.tweens.add({
      targets: this,
      alpha: 1,
      duration: 140,
      y: restY - 6,
    });
    this.startPage();
  }

  /** Replace the text without re-animating the box. */
  setText(text: string): void {
    this.pages = [text];
    this.pageIndex = 0;
    this.startPage();
  }

  private startPage(): void {
    this.fullText = this.pages[this.pageIndex] ?? '';
    this.charsShown = 0;
    this.bodyText.setText('');
    this.arrow.setVisible(false);
    this.arrowTween?.stop();

    if (this.speedMs <= 0) {
      this.charsShown = this.fullText.length;
      this.bodyText.setText(this.fullText);
      this.finishPage();
      return;
    }

    this.timer?.remove();
    this.timer = this.scene.time.addEvent({
      delay: this.speedMs,
      loop: true,
      callback: () => this.revealNext(),
    });
  }

  private revealNext(): void {
    this.charsShown += 1;
    this.bodyText.setText(this.fullText.slice(0, this.charsShown));
    if (this.charsShown >= this.fullText.length) {
      this.finishPage();
    }
  }

  private finishPage(): void {
    this.timer?.remove();
    this.timer = undefined;
    if (this.showArrow && this.pageIndex < this.pages.length - 1) {
      this.arrow.setVisible(true);
      this.arrowTween = this.scene.tweens.add({
        targets: this.arrow,
        y: this.arrow.y + 4,
        duration: 480,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  /** True when the current page has finished typing. */
  get pageComplete(): boolean {
    return this.charsShown >= this.fullText.length;
  }

  /**
   * Handle a confirm press. Reveals the rest of a page, or advances to the next
   * page, or finishes the message. Returns true when the input was consumed.
   */
  advance(): boolean {
    if (!this.isActive) return false;
    if (!this.pageComplete) {
      this.charsShown = this.fullText.length;
      this.bodyText.setText(this.fullText);
      this.finishPage();
      return true;
    }
    if (this.pageIndex < this.pages.length - 1) {
      this.pageIndex += 1;
      this.startPage();
      return true;
    }
    this.hide();
    this.onComplete?.();
    return true;
  }

  hide(): void {
    this.isActive = false;
    this.clearTyping();
    this.arrowTween?.stop();
    this.arrowTween = undefined;
    this.retireVisibilityTween();
    const epoch = this.visibilityEpoch;
    if (!this.visible) return;
    this.visibilityTween = this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 120,
      onComplete: () => {
        if (epoch !== this.visibilityEpoch) return;
        this.visibilityTween = undefined;
        const restY = this.restY;
        if (restY !== undefined) this.y = restY;
        this.setVisible(false);
      },
    });
  }

  /**
   * Show a prompt with a list of choices. Up/down are handled by the caller
   * through `moveChoice`, confirm through `confirmChoice`.
   */
  showChoice(prompt: string, options: string[], onChoose: (index: number) => void): void {
    this.choiceActive = true;
    this.choiceOptions = options.slice();
    this.choiceIndex = 0;
    this.onChoice = onChoose;
    this.show(prompt);

    const startY = -Math.floor(this.panel.panelHeight / 2) + 46;
    this.choiceTexts.forEach((t) => t.destroy());
    this.choiceTexts = this.choiceOptions.map((option, index) => {
      const t = this.scene.add
        .text(20, startY + index * 24, `${index === 0 ? '\u25b6' : ' '} ${option}`, {
          fontFamily: FONTS.body,
          fontSize: '16px',
          color: index === 0 ? '#7fffe5' : '#f2f6ff',
        })
        .setOrigin(0, 0.5);
      this.add(t);
      return t;
    });
  }

  get isChoosing(): boolean {
    return this.choiceActive;
  }

  moveChoice(delta: number): void {
    if (!this.choiceActive || this.choiceOptions.length === 0) return;
    this.choiceIndex =
      (this.choiceIndex + delta + this.choiceOptions.length) % this.choiceOptions.length;
    this.choiceTexts.forEach((text, index) => {
      const selected = index === this.choiceIndex;
      text.setText(`${selected ? '\u25b6' : ' '} ${this.choiceOptions[index]}`);
      text.setColor(selected ? '#7fffe5' : '#f2f6ff');
    });
  }

  confirmChoice(): boolean {
    if (!this.choiceActive) return false;
    const index = this.choiceIndex;
    const callback = this.onChoice;
    this.choiceActive = false;
    this.choiceTexts.forEach((t) => t.destroy());
    this.choiceTexts = [];
    this.onChoice = null;
    this.hide();
    callback?.(index);
    return true;
  }

  override destroy(fromScene?: boolean): void {
    if (!this.scene) return;
    this.visibilityEpoch += 1;
    this.clearTyping();
    this.arrowTween?.stop();
    this.arrowTween = undefined;
    this.visibilityTween?.stop();
    this.visibilityTween = undefined;
    super.destroy(fromScene);
  }
}
