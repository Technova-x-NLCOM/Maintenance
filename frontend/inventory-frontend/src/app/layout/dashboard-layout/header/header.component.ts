import { Component, EventEmitter, HostListener, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent {
  @Output() menuToggle = new EventEmitter<void>();
  isFullscreen = false;

  private requestFullscreen(elem: Element): void {
    const el = elem as any;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
  }

  private exitFullscreen(): void {
    const doc = document as any;
    if (doc.exitFullscreen) doc.exitFullscreen();
    else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
    else if (doc.mozCancelFullScreen) doc.mozCancelFullScreen();
    else if (doc.msExitFullscreen) doc.msExitFullscreen();
  }

  toggleFullscreen(): void {
    if (!this.isFullscreen) {
      this.requestFullscreen(document.documentElement);
    } else {
      this.exitFullscreen();
    }
  }

  toggleMenu(): void {
    this.menuToggle.emit();
  }

  @HostListener('window:resize')
  onFullscreenChange(): void {
    const doc = document as any;
    const fullscreenEl =
      doc.fullscreenElement ||
      doc.mozFullScreenElement ||
      doc.webkitFullscreenElement ||
      doc.msFullscreenElement;
    this.isFullscreen = fullscreenEl != null;
  }
}
