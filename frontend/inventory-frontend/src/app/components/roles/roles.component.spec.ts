import { RolesComponent } from './roles.component';

describe('RolesComponent (unit)', () => {
  let component: RolesComponent;
  const fakeRbac: any = { getRoles: () => ({ subscribe: () => {} }), getPermissions: () => ({ subscribe: () => {} }), givePermission: () => ({ toPromise: async () => {} }), updatePermissionFlags: () => ({ toPromise: async () => {} }) };
  const fakeCdr: any = { detectChanges: () => {} };

  beforeEach(() => {
    component = new RolesComponent(fakeRbac as any, fakeCdr as any);
  });

  it('startEdit skips super_admin', () => {
    const role = { role_id: 1, role_name: 'super_admin', permissions: [] } as any;
    component.startEdit(role);
    expect(component.editingRoleId).toBeNull();
  });

  it('pivotFor returns pivot object when present', () => {
    const role = { role_id: 2, role_name: 'user', permissions: [{ permission_id: 5, pivot: { can_read: true } }] } as any;
    const p = component.pivotFor(role, 5);
    expect(p).toBeDefined();
    if (p) expect(p.can_read).toBeTrue();
  });

  it('toggleFlag flips permission flag', () => {
    component.editPermissions = { 10: { can_create: false, can_read: false, can_update: false, can_delete: false } } as any;
    component.toggleFlag(10, 'can_create');
    expect(component.editPermissions[10].can_create).toBeTrue();
  });
});
