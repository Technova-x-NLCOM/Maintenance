import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  features = [
    {
      title: 'Inventory Tracking',
      description: 'Real-time tracking of all items in your inventory',
      icon: '📦',
    },
    {
      title: 'Resource Distribution',
      description: 'Efficiently manage and distribute essential resources to communities in need',
      icon: '🤝',
    },
    {
      title: 'Reports & Analytics',
      description: 'Generate detailed reports and analytics for better decision making',
      icon: '📊',
    },
    {
      title: 'User Management',
      description: 'Manage admin and staff accounts with role-based access control',
      icon: '👥',
    },
  ];
}
