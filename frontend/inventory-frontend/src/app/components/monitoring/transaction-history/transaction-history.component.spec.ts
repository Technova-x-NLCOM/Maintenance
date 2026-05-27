import { DatePipe } from '@angular/common';
import { of } from 'rxjs';
import { TransactionHistoryComponent } from './transaction-history.component';

describe('TransactionHistoryComponent (unit)', () => {
  let component: TransactionHistoryComponent;
  const fakeHttp: any = {
    get: jasmine.createSpy('get').and.returnValue(
      of({
        data: {
          data: [
            {
              transaction_type: 'IN',
              reference_number: 'REF-1',
              item_code: 'ITM-1',
              item_description: 'Item 1',
              batch_number: 'B1',
              batch_location_name: 'Main',
              quantity: 5,
              measurement_unit: 'pcs',
              destination: 'Shelf A',
              reason: 'Restock',
              performed_by_name: 'Admin',
              transaction_date: '2026-05-27T00:00:00Z',
            },
          ],
          current_page: 1,
          last_page: 3,
          total: 20,
        },
      }),
    ),
  };
  const fakeDatePipe: any = { transform: (_: any, format: string) => (format.includes('h:mm') ? 'May 27, 2026, 8:00 AM' : 'May 27, 2026') };
  const fakeToast: any = { success: () => {}, error: () => {} };
  const fakeCdr: any = { detectChanges: () => {} };

  beforeEach(() => {
    component = new TransactionHistoryComponent(fakeHttp as any, fakeCdr as any, fakeDatePipe as DatePipe, fakeToast as any);
  });

  it('loads transactions and tracks pagination', () => {
    component.load(1);

    expect(fakeHttp.get).toHaveBeenCalled();
    expect(component.transactions.length).toBe(1);
    expect(component.lastPage).toBe(3);
    expect(component.total).toBe(20);
  });

  it('returns a range of pages and clears filters', () => {
    expect(component.pageRange(3, 7)).toEqual([1, 2, 3, 4, 5]);

    component.search = 'rice';
    component.type = 'IN';
    component.dateFrom = '2026-05-01';
    component.dateTo = '2026-05-31';

    const loadSpy = spyOn(component, 'load').and.stub();
    component.clear();

    expect(component.search).toBe('');
    expect(component.type).toBe('');
    expect(loadSpy).toHaveBeenCalledWith(1);
  });
});