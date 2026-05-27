import { of } from 'rxjs';
import { LocationsManagementComponent } from './locations-management.component';

describe('LocationsManagementComponent (unit)', () => {
  let component: LocationsManagementComponent;
  const fakeMaintenance: any = {
    listRows: jasmine.createSpy('listRows').and.returnValue(
      of({
        data: [
          { location_id: 1, location_code: 'LOCATION-001', location_name: 'Main Warehouse', is_active: 1 },
          { location_id: 2, location_code: 'LOCATION-002', location_name: 'Remote Store', is_active: 0 },
        ],
      }),
    ),
    createRow: jasmine.createSpy('createRow').and.returnValue(of({ location_code: 'LOCATION-003' })),
    updateRow: jasmine.createSpy('updateRow').and.returnValue(of({})),
    deleteRow: jasmine.createSpy('deleteRow').and.returnValue(of({})),
  };
  const fakeToast: any = { success: jasmine.createSpy('success'), error: jasmine.createSpy('error') };
  const fakeCdr: any = { detectChanges: () => {} };

  beforeEach(() => {
    component = new LocationsManagementComponent(fakeMaintenance as any, fakeToast as any, fakeCdr as any);
  });

  it('loads rows and filters them by search term', () => {
    component.loadRows();

    expect(fakeMaintenance.listRows).toHaveBeenCalledWith('locations', { perPage: 500 });
    expect(component.totalLocations).toBe(2);
    expect(component.activeLocations).toBe(1);

    component.searchTerm = 'remote';
    expect(component.displayedRows.length).toBe(1);
  });

  it('suggests the next location code and validates saves', () => {
    component.rows = [
      { location_id: 1, location_code: 'LOCATION-001', location_name: 'Main Warehouse', is_active: 1 },
      { location_id: 2, location_code: 'LOCATION-002', location_name: 'Remote Store', is_active: 0 },
    ];

    component.startNew();
    expect(component.form.location_code).toBe('LOCATION-003');

    component.form.location_name = 'Annex';
    component.save();

    expect(fakeMaintenance.createRow).toHaveBeenCalled();
    expect(fakeToast.success).toHaveBeenCalled();
  });
});