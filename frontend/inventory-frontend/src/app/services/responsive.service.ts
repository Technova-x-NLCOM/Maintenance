import { Injectable } from '@angular/core';
import { BehaviorSubject, fromEvent } from 'rxjs';
import { distinctUntilChanged, map, startWith } from 'rxjs/operators';

export interface BreakpointState {
  isMobile: boolean;
  isMobileS: boolean;
  isMobileM: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
}

@Injectable({
  providedIn: 'root'
})
export class ResponsiveService {
  private readonly breakpointSubject = new BehaviorSubject<BreakpointState>(this.getBreakpointState());
  readonly breakpoint$ = this.breakpointSubject.asObservable();

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }

    fromEvent(window, 'resize')
      .pipe(
        startWith(null),
        map(() => this.getBreakpointState()),
        distinctUntilChanged((a, b) => a.width === b.width)
      )
      .subscribe((state) => {
        this.breakpointSubject.next(state);
      });
  }

  shouldShowFAB(): boolean {
    const state = this.breakpointSubject.value;
    return state.isMobileS || state.isMobileM;
  }

  shouldUseBottomSheet(): boolean {
    return this.breakpointSubject.value.isMobileM;
  }

  private getBreakpointState(): BreakpointState {
    const width = typeof window === 'undefined' ? 1024 : window.innerWidth;
    const isMobileS = width <= 320;
    const isMobileM = width <= 425;
    const isMobile = width <= 576;
    const isTablet = width > 576 && width <= 1024;
    const isDesktop = width > 1024;

    return {
      isMobile,
      isMobileS,
      isMobileM,
      isTablet,
      isDesktop,
      width
    };
  }
}
