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
  const fakeCdr: any = { detectChanges: () => {} };

  beforeEach(() => {
    component = new AuditLogComponent(fakeMaintenance as any, fakeCdr as any);
  });

  it('loadLogs requests audit logs and updates state', () => {
    component.loadLogs();

    expect(fakeMaintenance.listRows).toHaveBeenCalledWith('audit_log', {
      page: 1,
      perPage: 25,
      search: undefined,
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
});