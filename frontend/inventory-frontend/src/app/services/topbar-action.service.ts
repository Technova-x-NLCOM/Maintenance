import { Injectable } from '@angular/core';

/**
 * Lets routed pages register how the global topbar Print action should behave.
 * When no handler is set, the layout shows a toast instead of printing.
 */
@Injectable({ providedIn: 'root' })
export class TopbarActionService {
  private printHandler: (() => void) | null = null;

  setPrintHandler(handler: (() => void) | null): void {
    this.printHandler = handler;
  }

  runPrint(): void {
    if (this.printHandler) {
      this.printHandler();
    }
  }

  hasPrintHandler(): boolean {
    return this.printHandler !== null;
  }
}
