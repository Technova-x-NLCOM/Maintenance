import { DatePipe } from '@angular/common';
import { of } from 'rxjs';
import { StockReportComponent } from './stock-report.component';

describe('StockReportComponent (unit)', () => {
  let component: StockReportComponent;
  const fakeHttp: any = {
    get: jasmine.createSpy('get').and.returnValue(
      of({
        data: {
          data: [],
          current_page: 1,
          per_page: 10,
          last_page: 1,
          total: 0,
        },
      }),
    ),
  };
  const fakeItemService: any = {
    getOptions: () => ({ subscribe: () => {} }),
  };
  const fakeCategoryService: any = {
    getOptions: () => ({ subscribe: () => {} }),
  };
  const fakeDatePipe: any = { transform: (_: any, format: string) => (format.includes('h:mm') ? 'May 27, 2026, 8:00 AM' : 'May 27, 2026') };
  const fakeToast: any = { success: () => {}, error: () => {} };
  const fakeCdr: any = { detectChanges: () => {} };

  beforeEach(() => {
    component = new StockReportComponent(
      fakeHttp as any,
      fakeItemService as any,
      fakeCategoryService as any,
      fakeCdr as any,
      fakeDatePipe as DatePipe,
      fakeToast as any,
    );
  });

  it('updates filter labels when a category or location is selected', () => {
    spyOn(component, 'onCategoryFilterChange').and.stub();
    spyOn(component, 'onLocationFilterChange').and.stub();

    component.selectCategoryFilter({ category_id: 3, category_name: 'Grains' });
    component.selectLocationFilter({ location_id: 4, location_name: 'Warehouse' } as any);

    expect(component.selectedCategoryLabel).toBe('Grains');
    expect(component.selectedLocationLabel).toBe('Warehouse');
    expect(component.onCategoryFilterChange).toHaveBeenCalled();
    expect(component.onLocationFilterChange).toHaveBeenCalled();
  });

  it('toggles combobox dropdowns and responds to keyboard input', () => {
    const event = { key: 'ArrowDown', preventDefault: jasmine.createSpy('preventDefault') } as any;

    component.onLocationComboboxKeydown(event);
    expect(component.locationFilterOpen).toBeTrue();

    component.filteredCategoryOptions = [{ category_id: 1, category_name: 'Rice' }];
    component.categoryFilterOpen = true;
    component.onCategoryComboboxKeydown({ key: 'Enter', preventDefault: jasmine.createSpy('preventDefault') } as any);
    expect(component.activeCategoryOptionIndex).toBe(-1);
  });
});