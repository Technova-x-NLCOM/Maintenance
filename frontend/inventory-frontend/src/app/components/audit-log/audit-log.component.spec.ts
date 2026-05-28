import { of } from 'rxjs';
import { AuditLogComponent } from './audit-log.component';

describe('AuditLogComponent (unit)', () => {
  let component: AuditLogComponent;
  const fakeMaintenance: any = {
    listRows: jasmine.createSpy('listRows').and.returnValue(
      of({
        data: [
          {
            log_id: 1,
            table_name: 'categories',
            record_id: 9,
            action: 'INSERT',
            performed_by: 2,
            performed_by_name: 'Admin User',
            ip_address: '127.0.0.1',
            created_at: '2026-05-27T00:00:00Z',
          },
        ],
        page: 1,
        perPage: 25,
        total: 1,
      }),
    ),
  };
  const fakeCategory: any = {
    getOptions: jasmine.createSpy('getOptions').and.returnValue(
      of({
        data: {
          categories: [{ category_id: 1, category_name: 'Medicine', parent_category_id: null }],
        },
      }),
    ),
  };
  const fakeCdr: any = { detectChanges: () => {} };

  beforeEach(() => {
    component = new AuditLogComponent(fakeMaintenance as any, fakeCategory as any, fakeCdr as any);
  });

  it('loadLogs requests audit logs and updates state', () => {
    component.loadLogs();

    expect(fakeMaintenance.listRows).toHaveBeenCalledWith('audit_log', {
      page: 1,
      perPage: 25,
      search: undefined,
      extraParams: {
        excludeTables: 'inventory_transactions',
        sortOrder: 'newest',
      },
    });
    expect(component.logs.length).toBe(1);
    expect(component.total).toBe(1);
    expect(component.loading).toBeFalse();
  });

  it('maps actions, tables, and module types', () => {
    const log = {
      log_id: 1,
      table_name: 'category_items',
      record_id: 9,
      action: 'INSERT',
      performed_by: 2,
      ip_address: '127.0.0.1',
      created_at: '2026-05-27T00:00:00Z',
    } as any;

    expect(component.getActionBadgeClass(log)).toBe('badge-add');
    expect(component.getFriendlyTableName('users')).toBe('User Account');
    expect(component.getModuleType(log)).toBe('Category');
  });

  it('toggleExpanded switches the active log id', () => {
    component.toggleExpanded(12);
    expect(component.expandedLogId).toBe(12);
    component.toggleExpanded(12);
    expect(component.expandedLogId).toBeNull();
  });

  it('shows only important fields for created items', () => {
    const log = {
      log_id: 2,
      table_name: 'items',
      record_id: 10,
      action: 'INSERT',
      new_values: {
        item_id: 10,
        item_code: 'MED-001',
        item_description: 'Paracetamol',
        category_id: 1,
        image_url: 'items/photo.jpg',
        created_by: 2,
        created_at: '2026-05-27T00:00:00Z',
        updated_at: '2026-05-27T00:00:00Z',
        reorder_level: 0,
        is_active: 1,
      },
      performed_by: 2,
      ip_address: '127.0.0.1',
      created_at: '2026-05-27T00:00:00Z',
    } as any;

    component['categoryNameById'] = new Map([[1, 'Medicine']]);
    const fields = component.getCreationFields(log);
    const labels = fields.map((field) => field.label);

    expect(labels).toContain('Item code');
    expect(labels).toContain('Item name');
    expect(labels).toContain('Category');
    expect(labels).not.toContain('Item Id');
    expect(labels).not.toContain('Created By');
    expect(fields.find((field) => field.label === 'Category')?.value).toBe('Medicine');
    expect(fields.find((field) => field.label === 'Image')?.value).toBe('Has image');
  });

  it('describes update changes in plain language', () => {
    const log = {
      log_id: 3,
      table_name: 'categories',
      record_id: 5,
      action: 'UPDATE',
      old_values: { category_name: 'Old Name', parent_category_id: null },
      new_values: { category_name: 'New Name', parent_category_id: null },
      performed_by: 2,
      ip_address: '127.0.0.1',
      created_at: '2026-05-27T00:00:00Z',
    } as any;

    const updates = component.getUpdateFields(log);
    expect(updates.length).toBe(1);
    expect(updates[0].label).toBe('Category name');
    expect(component.getUpdateChangeSentence(updates[0])).toContain('Old Name');
    expect(component.getUpdateChangeSentence(updates[0])).toContain('New Name');
  });
});