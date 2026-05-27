import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent (unit)', () => {
  let component: DashboardComponent;
  const fakeAuth: any = { currentUser$: { subscribe: (fn: any) => fn(null) } };
  const fakeHttp: any = {};
  const fakeRouter: any = { events: { pipe: () => ({ subscribe: () => {} }) } };
  const fakeRoute: any = { snapshot: { component: null } };
  const fakeCdr: any = { detectChanges: () => {} };
  const fakeNgZone: any = { run: (fn: any) => fn() };

  beforeEach(() => {
    component = new DashboardComponent(fakeAuth, fakeHttp, fakeRouter, fakeRoute, fakeCdr, fakeNgZone);
  });

  it('topPriorityMessage when loading', () => {
    component.stats = null;
    expect(component.topPriorityMessage).toContain('Loading');
  });

  it('topPriorityMessage pending alerts takes precedence', () => {
    component.stats = { totalUsers:0, activeUsers:0, totalItems:0, lowStockItems:0, totalTransactions:0, pendingAlerts:2, totalCategories:0, expiringItems:0 };
    expect(component.topPriorityMessage).toContain('pending alert');
  });

  it('getTrendClass returns correct class', () => {
    expect(component.getTrendClass('up')).toBe('trend-up');
    expect(component.getTrendClass('steady')).toBe('trend-steady');
  });

  it('getActionClass and getAlertClass map values', () => {
    expect(component.getActionClass('INSERT')).toBe('action-insert');
    expect(component.getActionClass('UNKNOWN')).toBe('');
    expect(component.getAlertClass('critical')).toBe('alert-critical');
  });

  it('getAlertRoute heuristics', () => {
    const r1 = component.getAlertRoute({ alert_id: '1', type: 'role', message: 'created role', severity: 'info', created_at: '', acknowledged: false });
    expect(r1).toContain('/roles');
    const r2 = component.getAlertRoute({ alert_id: '2', type: 'stock', message: 'low stock', severity: 'warning', created_at: '', acknowledged: false });
    expect(r2).toContain('/inventory/items');
  });

  it('formatDate and getRelativeTime produce strings', () => {
    const now = new Date().toISOString();
    expect(component.formatDate(now)).toContain(',');
    expect(component.getRelativeTime(new Date().toISOString())).toMatch(/Just now|min|hr|day/);
  });

  it('trackBy functions', () => {
    expect(component.trackByAlert(0, { alert_id: 5, type:'', message:'', severity:'info', created_at:'', acknowledged:false })).toBe(5);
    expect(component.trackByLog(0, { log_id: 7, table_name:'', record_id:0, action:'INSERT', performed_by:1, ip_address:'', created_at:'' })).toBe(7);
  });
});
