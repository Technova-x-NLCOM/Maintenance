import { Injectable, signal } from '@angular/core';

export interface ToastState {
  visible: boolean;
  message: string;
  type: 'success' | 'error';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly state = signal<ToastState>({ visible: false, message: '', type: 'success' });

  private timeout?: ReturnType<typeof setTimeout>;

  show(type: 'success' | 'error', message: string, duration = 3500): void {
    if (this.timeout !== undefined) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }
    this.state.set({ visible: true, message, type });
    this.timeout = setTimeout(() => {
      this.state.set({ visible: false, message: '', type });
      this.timeout = undefined;
    }, duration);
  }

  success(message: string, duration = 3500): void {
    this.show('success', message, duration);
  }

  error(message: string, duration = 3500): void {
    this.show('error', message, duration);
  }

  hide(): void {
    if (this.timeout !== undefined) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }
    this.state.set({ visible: false, message: '', type: 'success' });
  }
}
