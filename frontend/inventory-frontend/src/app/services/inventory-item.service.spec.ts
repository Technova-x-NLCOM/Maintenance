import { InventoryItemService } from './inventory-item.service';
import { of } from 'rxjs';

describe('InventoryItemService (unit, no TestBed)', () => {
  let service: InventoryItemService;
  let fakeHttp: any;

  beforeEach(() => {
    localStorage.clear();
    fakeHttp = {
      get: jasmine.createSpy('get'),
      post: jasmine.createSpy('post'),
      put: jasmine.createSpy('put'),
      patch: jasmine.createSpy('patch')
    };

    service = new InventoryItemService(fakeHttp as any);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('list should call get with query params', () => {
    fakeHttp.get.and.returnValue(of({ success: true, message: 'ok', data: { data: [], current_page: 2, last_page: 1, per_page: 10, total: 0 } }));
    service.list({ page: 2, per_page: 10, search: 'abc', is_active: true }).subscribe();
    expect(fakeHttp.get).toHaveBeenCalled();
    const calledWith = fakeHttp.get.calls.mostRecent().args[0] as string;
    expect(calledWith).toContain('/inventory/items');
  });

  it('create should call post with FormData', () => {
    const fd = new FormData();
    fd.append('item_code', 'X');
    fakeHttp.post.and.returnValue(of({ success: true, message: 'ok', data: {} }));

    service.create(fd).subscribe();

    expect(fakeHttp.post).toHaveBeenCalled();
    const args = fakeHttp.post.calls.mostRecent().args;
    expect((args[0] as string)).toContain('/inventory/items');
    expect(args[1]).toBe(fd);
  });
});
