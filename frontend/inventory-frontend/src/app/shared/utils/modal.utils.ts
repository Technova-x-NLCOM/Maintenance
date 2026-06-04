/**
 * ModalUtils
 * ----------
 * Global utility for modal behaviour shared across all components.
 *
 * BOUNCE GUARD
 * When the user clicks outside a busy modal (or presses Escape while saving),
 * call ModalUtils.bounce(selector) to shake the modal instead of closing it.
 * This gives clear visual feedback that the action is in progress.
 *
 * Usage in any component TypeScript:
 *
 *   import { ModalUtils } from '../../../shared/utils/modal.utils';
 *
 *   // e.g. when user tries to close while saving:
 *   if (this.saving) {
 *     ModalUtils.bounce('.app-modal');
 *     return;
 *   }
 *
 * The selector should match the modal shell element — typically '.app-modal'
 * for form modals or '.app-modal-confirm' for confirmation dialogs.
 * If multiple modals of the same type are in the DOM, pass a more specific
 * selector such as '.app-modal.my-feature-modal'.
 */
export class ModalUtils {
  private static readonly BOUNCE_KEYFRAMES: Keyframe[] = [
    { transform: 'scale(1)' },
    { transform: 'scale(1.05)' },
    { transform: 'scale(0.97)' },
    { transform: 'scale(1.02)' },
    { transform: 'scale(1)' },
  ];

  private static readonly BOUNCE_OPTIONS: KeyframeAnimationOptions = {
    duration: 400,
    easing: 'ease',
  };

  /**
   * Animate a modal element with the standard bounce guard effect.
   *
   * @param selector  CSS selector for the modal element (default: '.app-modal')
   */
  static bounce(selector = '.app-modal'): void {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) return;
    el.animate(ModalUtils.BOUNCE_KEYFRAMES, ModalUtils.BOUNCE_OPTIONS);
  }

  /**
   * Bounce the confirmation dialog (shorthand).
   */
  static bounceConfirm(): void {
    ModalUtils.bounce('.app-modal-confirm');
  }
}
