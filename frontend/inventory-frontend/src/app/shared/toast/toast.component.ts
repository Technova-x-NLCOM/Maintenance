import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="app-toast"
      [class.app-toast--visible]="toast().visible"
      [class.app-toast--success]="toast().type === 'success'"
      [class.app-toast--error]="toast().type === 'error'"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <svg *ngIf="toast().type === 'success'" class="app-toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/>
        <path d="M8 12l3 3 5-6"/>
      </svg>
      <svg *ngIf="toast().type === 'error'" class="app-toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
      <span class="app-toast__message">{{ toast().message }}</span>
    </div>
  `,
  styles: [`
    .app-toast {
      position: fixed;
      top: 24px;
      right: 24px;
      transform: translateX(120%);
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 22px;
      border-radius: 12px;
      font-size: 0.9375rem;
      font-weight: 600;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10);
      z-index: 9999;
      min-width: 280px;
      max-width: 400px;
      pointer-events: none;
      transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.22s ease;
      opacity: 0;
      white-space: pre-line;
    }

    .app-toast--visible {
      transform: translateX(0);
      opacity: 1;
      pointer-events: auto;
    }

    .app-toast--success {
      background: #16a34a;
      color: #fff;
    }

    .app-toast--error {
      background: #dc2626;
      color: #fff;
    }

    .app-toast__icon {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

    .app-toast__message {
      flex: 1;
      line-height: 1.4;
    }
  `]
})
export class ToastComponent {
  protected readonly toastService = inject(ToastService);
  readonly toast = this.toastService.state;
}
