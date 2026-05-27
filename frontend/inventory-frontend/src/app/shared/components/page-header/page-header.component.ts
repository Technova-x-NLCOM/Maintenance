import { Component, Input, Output, EventEmitter, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './page-header.component.html',
  styleUrls: ['./page-header.component.scss'],
  animations: [
    trigger('slideDown', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-8px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ opacity: 0, transform: 'translateY(-8px)' }))
      ])
    ])
  ]
})
export class PageHeaderComponent {
  @Input() title: string = '';
  @Input() subtitle: string = '';
  @Input() eyebrow: string = '';
  @Input() icon: string = '';
  @Input() showTooltip: boolean = false;
  @Input() collapsible: boolean = false;
  @Input() compact: boolean = false;
  @Input() actions: TemplateRef<any> | null = null;
  
  @Output() tooltipToggle = new EventEmitter<void>();
  
  isDescriptionExpanded: boolean = false;
  showTooltipContent: boolean = false;

  toggleDescription(): void {
    if (this.collapsible) {
      this.isDescriptionExpanded = !this.isDescriptionExpanded;
    }
  }

  toggleTooltip(): void {
    if (this.showTooltip) {
      this.showTooltipContent = !this.showTooltipContent;
      this.tooltipToggle.emit();
    }
  }
}