import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast-outlet',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast-outlet.component.html',
  styleUrls: ['./toast-outlet.component.scss']
})
export class ToastOutletComponent {
  constructor(public toastService: ToastService) {}

  dismiss(id: number): void {
    this.toastService.remove(id);
  }
}
