# Page Header Optimization Guide

This guide shows how to implement condensed, space-efficient page headers across all modules in the inventory management system.

## Quick Implementation

### 1. Using the New PageHeaderComponent (Recommended)

```html
<!-- Basic condensed header -->
<app-page-header
  title="Inventory Management"
  subtitle="Manage your inventory items and stock levels"
  [compact]="true">
</app-page-header>

<!-- Header with tooltip for long descriptions -->
<app-page-header
  title="Stock Adjustment"
  subtitle="Use this kiosk to correct stock discrepancies from physical count. This process helps maintain accurate inventory records and ensures proper stock tracking across all locations."
  [showTooltip]="true">
</app-page-header>

<!-- Header with collapsible description -->
<app-page-header
  title="Batch Distribution"
  subtitle="Distribute inventory items across multiple locations in batches. This feature allows you to efficiently manage stock allocation and maintain optimal inventory levels."
  [collapsible]="true">
</app-page-header>

<!-- Ultra-compact header for mobile/dense layouts -->
<app-page-header
  title="Categories"
  subtitle="Manage item categories"
  [compact]="true">
</app-page-header>
```

### 2. Using CSS Classes on Existing Headers

If you can't immediately switch to the new component, apply these classes:

```html
<!-- Apply condensed spacing -->
<header class="page-header header-condensed">
  <div class="header-text">
    <h1 class="page-title">Item Registration</h1>
    <p class="subtitle">Add or edit items here</p>
  </div>
</header>

<!-- Ultra-compact for mobile -->
<header class="page-header header-ultra-compact">
  <div class="header-text">
    <h1 class="page-title">Settings</h1>
    <p class="subtitle">Configure system preferences</p>
  </div>
</header>

<!-- With tooltip functionality -->
<header class="page-header header-with-tooltip">
  <div class="header-text">
    <div class="title-row">
      <h1 class="page-title">Transaction History</h1>
      <button class="tooltip-trigger" (click)="toggleTooltip()">
        <svg><!-- info icon --></svg>
      </button>
    </div>
    <p class="subtitle" [class.tooltip-visible]="showTooltip">
      View all inventory transactions including receipts, issuances, and adjustments
    </p>
  </div>
</header>
```

## Space Savings Achieved

### Before Optimization:
- Header height: ~80-100px
- Title font size: 1.5rem (24px)
- Padding: 24px vertical
- Margin bottom: 24px

### After Optimization:
- Header height: ~60-70px (25-30% reduction)
- Title font size: 1.25rem (20px)
- Padding: 12-16px vertical
- Margin bottom: 16-20px
- **Total vertical space saved: 30-40px per page**

## Implementation Examples by Module

### Inventory Master
```html
<!-- Items page -->
<app-page-header
  title="Item Registration & Updates"
  subtitle="Add or edit items here. Click Add new item to create one, or Edit on a row to update existing items."
  [showTooltip]="true">
</app-page-header>

<!-- Categories page -->
<app-page-header
  title="Category Management"
  subtitle="Create, organize, update, and remove item categories."
  [compact]="true">
</app-page-header>
```

### Monitoring
```html
<!-- Stock report -->
<app-page-header
  title="Stock Report"
  eyebrow="Inventory Monitoring"
  subtitle="View current stock levels and identify items requiring attention."
  [collapsible]="true">
</app-page-header>
```

### Transactions
```html
<!-- Receiving -->
<app-page-header
  title="Stock Receiving (IN)"
  subtitle="Record incoming inventory items and update stock levels."
  [compact]="true">
</app-page-header>

<!-- Issuance -->
<app-page-header
  title="Stock Issuance (OUT)"
  subtitle="Choose items, add them to an issuance list, then submit all lines in one action."
  [compact]="true">
</app-page-header>
```

### Settings & Administration
```html
<!-- System settings -->
<app-page-header
  title="System Settings"
  eyebrow="Configuration"
  subtitle="Configure system preferences and operational parameters."
  [compact]="true">
</app-page-header>

<!-- User management -->
<app-page-header
  title="User Management"
  eyebrow="Administration"
  subtitle="Manage user accounts, roles, and permissions."
  [compact]="true">
</app-page-header>
```

## Responsive Behavior

The optimized headers automatically adjust for different screen sizes:

- **Desktop (>768px)**: Standard condensed spacing
- **Tablet (768px)**: Slightly reduced padding, stacked actions
- **Mobile (<480px)**: Ultra-compact mode, minimal spacing

## Accessibility Features

- Proper ARIA labels for interactive elements
- Keyboard navigation support
- Screen reader friendly
- High contrast ratios maintained
- Focus indicators for tooltip/collapse buttons

## Migration Checklist

1. ✅ Import PageHeaderComponent in your module
2. ✅ Replace existing page headers with `<app-page-header>`
3. ✅ Add appropriate props (title, subtitle, compact, etc.)
4. ✅ Test tooltip/collapsible functionality
5. ✅ Verify responsive behavior
6. ✅ Check accessibility with screen readers

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

All modern browsers with CSS Grid and Flexbox support.