# Storage Management Component

## Overview
Unified component that merges **Storage Locations** (CRUD management) and **Storage Inventory** (monitoring) into a single tabbed interface.

## Features

### KPI Summary Bar (Always Visible)
1. **Registered Locations** - Total locations in master data
2. **Active Storage Points** - Locations currently holding inventory
3. **Total Items Tracked** - Unique items across all locations
4. **Low Stock Alerts** - Locations with low-stock items

### Tab 1: Locations (CRUD)
- View all storage locations in a table
- Search by code or name
- Create new locations with auto-generated codes
- Edit existing locations
- Delete locations (with confirmation)
- Active/Inactive status management

### Tab 2: Inventory (Monitoring)
- View inventory grouped by storage location
- Expandable location cards showing items
- Search by location or item details
- Filter by specific location (dropdown)
- Toggle "Low stock only" filter
- Real-time stock status indicators

## Component Structure

```
storage-management/
├── storage-management.component.ts      # Component logic
├── storage-management.component.html    # Template
├── storage-management.component.scss    # Styles
└── README.md                            # This file
```

## Services Used

- **MaintenanceService** - Location CRUD operations
- **InventoryItemService** - Storage inventory queries
- **ToastService** - User notifications

## Data Models

- **LocationRow** - Master data location record
- **StorageInventoryLocation** - Location with inventory metrics
- **StorageInventoryItem** - Item within a location
- **LocationOption** - Dropdown filter options

## Usage

### Route
```
/dashboard/inventory/storage-management
```

### Component Selector
```html
<app-storage-management></app-storage-management>
```

### Permissions Required
- `manage_locations` - For CRUD operations (Tab 1)
- `view_inventory` - For monitoring (Tab 2)

## State Management

### Local State Variables
- `activeTab` - Current tab ('locations' | 'inventory')
- `locationRows` - Master data locations
- `inventoryLocations` - Inventory data by location
- `showLocationForm` - Modal visibility
- `editingLocationId` - ID of location being edited
- `expandedLocations` - Set of expanded location cards

### Change Detection
Uses **OnPush** strategy for optimal performance.

## API Endpoints

### Locations (Tab 1)
- `GET /maintenance/locations/rows` - List locations
- `POST /maintenance/locations/rows` - Create location
- `PUT /maintenance/locations/rows/:id` - Update location
- `DELETE /maintenance/locations/rows/:id` - Delete location

### Inventory (Tab 2)
- `GET /inventory/transactions/storage-inventory` - Get inventory by location
- `GET /inventory/locations/options` - Get location dropdown options

## Styling

Uses existing IMS design system classes:
- `.stats-grid`, `.stat-card` - KPI cards
- `.hero-card` - Top banner
- `.tabs-nav`, `.tab-button` - Tab navigation
- `.data-table` - Tables
- `.modal-overlay`, `.modal-box` - Modal form
- `.btn`, `.form-control` - Buttons and inputs

Custom styles in `storage-management.component.scss` for:
- Tab navigation
- Location cards (Inventory tab)
- Expandable sections
- Responsive layout

## Integration

See `STORAGE_MANAGEMENT_INTEGRATION.md` in the project root for complete integration checklist.

### Quick Start
1. Add route to `app.routes.ts`
2. Update navigation menu links
3. Test locally
4. Deploy

## Migration Notes

This component replaces:
- `LocationsManagementComponent` (`/inventory/locations`)
- `StorageInventoryComponent` (`/monitoring/storage-inventory`)

**Benefits:**
- Eliminates redundant KPI metrics
- Single source of truth for location data
- Better UX with unified interface
- Reduced code duplication

## Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Accessibility
- Keyboard navigation supported
- ARIA labels on interactive elements
- Focus management in modals
- Screen reader compatible

## Performance
- OnPush change detection
- Client-side filtering (no API calls on search)
- Lazy loading of location details
- Optimized re-renders with trackBy functions

## Future Enhancements
- [ ] Persist active tab in URL query params
- [ ] Export locations to CSV
- [ ] Bulk location operations
- [ ] Location usage analytics
- [ ] QR code generation for locations
- [ ] Location capacity management

## Version History

### v1.0.0 (Current)
- Initial release
- Merged Locations and Storage Inventory components
- Unified KPI metrics
- Tabbed interface

## Support
For issues or questions, contact the development team.
