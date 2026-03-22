import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toastsSubject = new BehaviorSubject<ToastMessage[]>([]);
  readonly toasts$ = this.toastsSubject.asObservable();
  private nextId = 1;

  success(message: string): void {
    this.show(message, 'success');
  }

  error(message: string): void {
    this.show(message, 'error');
  }

  info(message: string): void {
    this.show(message, 'info');
  }

  show(message: string, type: ToastType = 'info', durationMs = 3200): void {
    const toast: ToastMessage = {
      id: this.nextId++,
      message,
      type
    };

    const current = this.toastsSubject.value;
    this.toastsSubject.next([...current, toast]);

    if (durationMs > 0) {
      setTimeout(() => this.remove(toast.id), durationMs);
    }
  }

  remove(id: number): void {
    const filtered = this.toastsSubject.value.filter(t => t.id !== id);
    this.toastsSubject.next(filtered);
  }
}
