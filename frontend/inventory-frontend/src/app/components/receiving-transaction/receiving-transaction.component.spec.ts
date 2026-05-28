import { ReceivingTransactionComponent } from './receiving-transaction.component';

describe('ReceivingTransactionComponent (unit)', () => {
  let component: ReceivingTransactionComponent;
  const fakeItemService: any = { getOptions: () => ({ subscribe: () => {} }), getLocationOptions: () => ({ subscribe: () => {} }), getReceivingItems: () => ({ subscribe: () => {} }), list: () => ({ subscribe: () => {} }) };
  const fakeRouter: any = {};
  const fakeCdr: any = { detectChanges: () => {} };

  beforeEach(() => {
    component = new ReceivingTransactionComponent(fakeItemService as any, fakeRouter as any, fakeCdr as any);
  });

  it('computeExpiry sets computedExpiryDate from shelf_life_days', () => {
    component.selectedItem = { item_id:1, item_code:'X', item_description:'', category_name:'', measurement_unit:null, shelf_life_days: 10, image_url:null, current_stock:0, is_active:true } as any;
    component.purchaseDate = '2026-01-01';
    component.computeExpiry();
    expect(component.computedExpiryDate).toMatch(/2026-01-/);
  });

  it('getEffectiveExpiryDate respects override', () => {
    component.computedExpiryDate = '2026-02-01';
    component.expiryDate = '2026-03-01';
    component.expiryDateOverride = true;
    expect(component.getEffectiveExpiryDate()).toBe('2026-03-01');
    component.expiryDateOverride = false;
    expect(component.getEffectiveExpiryDate()).toBe('2026-02-01');
  });

  it('canAddToList enforces required fields', () => {
    component.selectedItem = null;
    component.quantity = 1;
    expect(component.canAddToList()).toBeFalse();

    component.selectedItem = { item_id:1, item_code:'X', item_description:'', category_name:'', measurement_unit:null, shelf_life_days: null, image_url:null, current_stock:0, is_active:true } as any;
    component.quantity = 1;
    component.confirmBatchNumber = '  ';
    expect(component.canAddToList()).toBeFalse();
  });
});
