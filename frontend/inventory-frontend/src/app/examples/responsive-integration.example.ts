// Example: Enhanced Component Integration with ResponsiveService

import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ResponsiveService, BreakpointState } from '../services/responsive.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-enhanced-transaction',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Desktop/Tablet Layout -->
    <div class="transaction-layout" [class.mobile-layout]="breakpoint.isMobile">
      
      <!-- Main Content Area -->
      <section class="catalog-panel">
        <!-- Your existing catalog content -->
      </section>

      <!-- Mobile FAB (only visible on mobile) -->
      <button 
        class="mobile-drawer-fab" 
        *ngIf="breakpoint.isMobileM"
        (click)="toggleDrawer()"
        [class.has-items]="hasItems"
        [attr.aria-label]="drawerOpen ? 'Close list' : 'Open list'"
      >
        <svg *ngIf="!drawerOpen" viewBox="0 0 24 24" width="24" height="24">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M9 9h6v6H9z"/>
        </svg>
        <svg *ngIf="drawerOpen" viewBox="0 0 24 24" width="24" height="24">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
        <span class="fab-badge" *ngIf="itemCount > 0">{{ itemCount }}</span>
      </button>

      <!-- Mobile Backdrop -->
      <div 
        class="mobile-drawer-backdrop" 
        *ngIf="breakpoint.isMobileM"
        [class.is-open]="drawerOpen"
        (click)="closeDrawer()"
      ></div>

      <!-- Responsive Drawer -->
      <div 
        class="drawer-container"
        [class.drawer-open]="drawerOpen"
        [class.mobile-drawer]="breakpoint.isMobileM"
        [class.desktop-drawer]="!breakpoint.isMobileM"
      >
        <!-- Drawer Tab (desktop only) -->
        <button 
          class="drawer-tab"
          *ngIf="!breakpoint.isMobileM"
          (click)="toggleDrawer()"
        >
          <span>Transaction List</span>
          <span class="badge" *ngIf="itemCount > 0">{{ itemCount }}</span>
        </button>

        <!-- Drawer Content -->
        <div class="drawer-content">
          <!-- Drag handle for mobile -->
          <div class="drag-handle" *ngIf="breakpoint.isMobileM"></div>
          
          <!-- Your existing drawer content -->
          <div class="drawer-header">
            <h2>Transaction List</h2>
            <button 
              class="close-btn"
              (click)="closeDrawer()"
              aria-label="Close"
            >×</button>
          </div>
          
          <!-- List content -->
          <div class="drawer-body">
            <!-- Your transaction items -->
          </div>
          
          <!-- Footer actions -->
          <div class="drawer-footer" [class.mobile-footer]="breakpoint.isMobileM">
            <button class="btn btn-secondary">Clear</button>
            <button class="btn btn-primary">Submit</button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class EnhancedTransactionComponent implements OnInit, OnDestroy {
  breakpoint: BreakpointState = {
    isMobile: false,
    isMobileS: false,
    isMobileM: false,
    isTablet: false,
    isDesktop: true,
    width: 1024
  };
  
  drawerOpen = false;
  itemCount = 0;
  hasItems = false;
  
  private subscription = new Subscription();

  constructor(private responsiveService: ResponsiveService) {}

  ngOnInit() {
    // Subscribe to breakpoint changes
    this.subscription.add(
      this.responsiveService.breakpoint$.subscribe((breakpoint: BreakpointState) => {
        this.breakpoint = breakpoint;
        this.handleBreakpointChange(breakpoint);
      })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  private handleBreakpointChange(breakpoint: BreakpointState) {
    // Auto-close drawer when switching from mobile to desktop
    if (!breakpoint.isMobileM && this.drawerOpen) {
      this.drawerOpen = false;
    }
    
    // Adjust drawer behavior based on screen size
    if (breakpoint.isMobileS) {
      // Ultra-compact mobile adjustments
      this.adjustForMobileS();
    } else if (breakpoint.isMobileM) {
      // Standard mobile adjustments
      this.adjustForMobileM();
    }
  }

  toggleDrawer() {
    this.drawerOpen = !this.drawerOpen;
    
    // Add body scroll lock on mobile when drawer is open
    if (this.breakpoint.isMobileM) {
      document.body.style.overflow = this.drawerOpen ? 'hidden' : '';
    }
  }

  closeDrawer() {
    this.drawerOpen = false;
    
    // Remove body scroll lock
    if (this.breakpoint.isMobileM) {
      document.body.style.overflow = '';
    }
  }

  private adjustForMobileS() {
    // Specific adjustments for very small screens (320px)
    console.log('Adjusting for Mobile S (320px)');
  }

  private adjustForMobileM() {
    // Specific adjustments for mobile (375px)
    console.log('Adjusting for Mobile M (375px)');
  }

  // Utility methods for template
  get shouldShowFAB(): boolean {
    return this.responsiveService.shouldShowFAB();
  }

  get shouldUseBottomSheet(): boolean {
    return this.responsiveService.shouldUseBottomSheet();
  }
}

// Example SCSS for the enhanced component
/*
.transaction-layout {
  display: flex;
  height: 100vh;
  
  &.mobile-layout {
    flex-direction: column;
  }
}

.catalog-panel {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

// Mobile FAB
.mobile-drawer-fab {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #2563eb;
  color: white;
  border: none;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  transition: all 0.3s ease;
  
  &:hover {
    background: #1d4ed8;
    transform: scale(1.05);
  }
  
  &.has-items {
    background: #dc2626;
    animation: pulse 2s infinite;
  }
  
  .fab-badge {
    position: absolute;
    top: -8px;
    right: -8px;
    background: #ef4444;
    color: white;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    font-size: 12px;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid white;
  }
}

// Mobile backdrop
.mobile-drawer-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 998;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease;
  
  &.is-open {
    opacity: 1;
    visibility: visible;
  }
}

// Drawer container
.drawer-container {
  &.desktop-drawer {
    position: fixed;
    top: 0;
    right: 0;
    height: 100vh;
    width: 440px;
    transform: translateX(100%);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    
    &.drawer-open {
      transform: translateX(0);
    }
  }
  
  &.mobile-drawer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: auto;
    max-height: 85vh;
    transform: translateY(100%);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border-radius: 20px 20px 0 0;
    
    &.drawer-open {
      transform: translateY(0);
    }
  }
}

// Drawer content
.drawer-content {
  height: 100%;
  background: white;
  display: flex;
  flex-direction: column;
  
  .mobile-drawer & {
    border-radius: 20px 20px 0 0;
    max-height: 85vh;
    
    // Drag handle
    &::before {
      content: '';
      position: absolute;
      top: 8px;
      left: 50%;
      transform: translateX(-50%);
      width: 40px;
      height: 4px;
      background: #cbd5e1;
      border-radius: 2px;
    }
  }
}

.drawer-footer {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  border-top: 1px solid #e5e7eb;
  
  &.mobile-footer {
    flex-direction: column-reverse;
    
    .btn {
      width: 100%;
    }
  }
}

// Animations
@keyframes pulse {
  0%, 100% {
    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
  }
  50% {
    box-shadow: 0 4px 20px rgba(220, 38, 38, 0.6);
  }
}

// Mobile-specific adjustments
@media (max-width: 320px) {
  .mobile-drawer-fab {
    width: 48px;
    height: 48px;
    bottom: 16px;
    right: 16px;
  }
  
  .drawer-content {
    padding: 0.5rem;
  }
}
*/