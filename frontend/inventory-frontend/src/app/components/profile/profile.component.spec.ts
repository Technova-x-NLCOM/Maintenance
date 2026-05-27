import { of } from 'rxjs';
import { ProfileComponent } from './profile.component';

describe('ProfileComponent (unit)', () => {
  let component: ProfileComponent;
  const user = {
    user_id: 1,
    first_name: 'Jane',
    last_name: 'Doe',
    email: 'jane@example.com',
    contact_info: '0917-000-0000',
    role: 'super_admin',
  } as any;
  const fakeAuth: any = {
    currentUser$: { subscribe: (fn: any) => fn(user) },
    me: jasmine.createSpy('me').and.returnValue(of(user)),
    logout: jasmine.createSpy('logout').and.returnValue(of(void 0)),
  };
  const fakeRouter: any = { navigate: jasmine.createSpy('navigate') };
  const fakeHttp: any = { put: jasmine.createSpy('put').and.returnValue(of({ message: 'ok', user })) };
  const fakeCdr: any = { detectChanges: () => {} };

  beforeEach(() => {
    component = new ProfileComponent(fakeAuth as any, fakeRouter as any, fakeHttp as any, fakeCdr as any);
    component.ngOnInit();
  });

  it('hydrates the current user and opens the edit modal', () => {
    component.openEditModal();

    expect(component.user).toEqual(user);
    expect(component.showEditModal).toBeTrue();
    expect(component.editForm.first_name).toBe('Jane');
    expect(component.editForm.email).toBe('jane@example.com');
  });

  it('validates password changes before calling the API', () => {
    component.openPasswordModal();
    component.passwordForm.new_password = 'short';
    component.passwordForm.confirm_password = 'mismatch';

    component.changePassword();

    expect(component.passwordError).toBe('New passwords do not match.');
    expect(fakeHttp.put).not.toHaveBeenCalled();
  });

  it('logs out through the auth service and routes to login', () => {
    component.logout();

    expect(fakeAuth.logout).toHaveBeenCalled();
    expect(fakeRouter.navigate).toHaveBeenCalledWith(['/login']);
  });
});