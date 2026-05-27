import { SettingsComponent } from './settings.component';

describe('SettingsComponent (unit)', () => {
  let component: SettingsComponent;
  const fakeHttp: any = {};
  const fakeCdr: any = { detectChanges: () => {} };
  const fakeAuth: any = { currentUser$: { subscribe: (fn: any) => fn(null) } };
  const fakeRbac: any = { roleHasPermission: () => false, getCurrentRole: () => ({ subscribe: () => {} }) };

  beforeEach(() => {
    component = new SettingsComponent(fakeHttp as any, fakeCdr as any, fakeAuth as any, fakeRbac as any);
  });

  it('formatKey capitalizes and replaces underscores', () => {
    expect(component.formatKey('test_key_name')).toBe('Test Key Name');
  });

  it('normalizeSettings handles arrays and records', () => {
    const arr = [{ setting_id: 1, setting_key: 'k', setting_value: 'v', description: null, updated_by: null, updated_at: '' }];
    expect((component as any).normalizeSettings(arr).length).toBe(1);
    expect((component as any).normalizeSettings({ data: arr }).length).toBe(1);
    expect((component as any).normalizeSettings(null)).toEqual([]);
  });

  it('hasPermission respects super_admin and rbac', () => {
    component.loadingRole = false;
    component['currentRole'] = null;
    component['user'] = { role: 'inventory_manager' } as any;
    expect(component.hasPermission('x')).toBeFalse();
    component['user'] = { role: 'super_admin' } as any;
    expect(component.hasPermission('x')).toBeTrue();
  });
});
