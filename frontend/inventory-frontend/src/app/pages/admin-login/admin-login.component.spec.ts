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

  // Tests for removed set password functionality have been removed

  it('onSubmit shows toast when fields missing', () => {
    spyOn(component, 'showToast');
    component.loginForm.patchValue({ identifier: '', password: '' });
    component.onSubmit();
    expect(component.showToast).toHaveBeenCalled();
  });

  it('forgot password modal opens and validates email', () => {
    // extend fakeAuth for forgotPassword
    (fakeAuth as any).forgotPassword = () => ({ pipe: () => ({ subscribe: () => {} }) });

    component.openForgotPasswordModal();
    expect(component.showForgotPasswordModal).toBeTrue();

    // submitting without email should set error
    component.submitForgotPassword();
    expect(component.forgotPasswordError).toContain('Please enter your email');
  });

  it('submitForgotPassword calls auth service and shows toast on success', () => {
    const spyForgot = jasmine.createSpy('forgotPassword').and.returnValue({ pipe: () => ({ subscribe: (obj: any) => obj.next({ message: 'sent' }) }) });
    (fakeAuth as any).forgotPassword = spyForgot;
    spyOn(component, 'showToast');

    component.openForgotPasswordModal();
    component.forgotPasswordForm.patchValue({ email: 'me@example.com' });
    component.submitForgotPassword();

    expect(spyForgot).toHaveBeenCalledWith('me@example.com');
    expect(component.showForgotPasswordModal).toBeFalse();
    expect(component.showToast).toHaveBeenCalled();
  });
});
