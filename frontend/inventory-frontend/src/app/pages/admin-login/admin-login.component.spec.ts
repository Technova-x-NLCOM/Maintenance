import { AdminLoginComponent } from './admin-login.component';
import { FormBuilder } from '@angular/forms';

describe('AdminLoginComponent (unit)', () => {
  let component: AdminLoginComponent;
  const fb = new FormBuilder();
  const fakeRouter: any = { navigate: jasmine.createSpy('navigate') };
  const fakeAuth: any = { checkPasswordSet: () => ({ pipe: () => ({ subscribe: () => {} }) }), setInitialPassword: () => ({ pipe: () => ({ subscribe: () => {} }) }), login: () => ({ pipe: () => ({ subscribe: () => {} }) }) };
  const fakeCdr: any = { markForCheck: () => {}, detectChanges: () => {} };

  beforeEach(() => {
    component = new AdminLoginComponent(fb, fakeRouter as any, fakeAuth as any, fakeCdr as any);
    component.ngOnInit();
  });

  it('toggles password visibility', () => {
    const before = component.showPassword;
    component.togglePasswordVisibility();
    expect(component.showPassword).toBe(!before);
  });

  it('submitSetPassword validates mismatch and missing identifier', () => {
    component.setPasswordForm.patchValue({ password: 'abc12345', password_confirmation: 'different' });
    component.submitSetPassword();
    expect(component.setPasswordError).toBe('Passwords do not match.');

    component.setPasswordForm.patchValue({ password: 'abc12345', password_confirmation: 'abc12345' });
    component.loginForm.patchValue({ identifier: '' });
    component.submitSetPassword();
    expect(component.setPasswordError).toContain('Please enter your username');
  });

  it('onSubmit shows toast when fields missing', () => {
    spyOn(component, 'showToast');
    component.loginForm.patchValue({ identifier: '', password: '' });
    component.onSubmit();
    expect(component.showToast).toHaveBeenCalled();
  });
});
