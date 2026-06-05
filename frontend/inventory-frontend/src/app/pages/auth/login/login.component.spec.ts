import { LoginComponent } from './login.component';
import { FormBuilder } from '@angular/forms';
import { of, throwError } from 'rxjs';

describe('LoginComponent (unit)', () => {
  let component: LoginComponent;
  let authSpy: any;
  const fb = new FormBuilder();

  beforeEach(() => {
    authSpy = jasmine.createSpyObj('AuthService', ['forgotPassword', 'login', 'checkPasswordSet', 'setInitialPassword', 'getFriendlyErrorMessage']);
    const routerStub: any = { navigate: jasmine.createSpy('navigate') };
    const cdrStub: any = { markForCheck: () => {}, detectChanges: () => {} };

    component = new LoginComponent(fb, routerStub, authSpy, cdrStub);
    component.ngOnInit();
  });

  it('creates and initializes forms', () => {
    expect(component).toBeTruthy();
    expect(component.loginForm).toBeDefined();
    expect(component.forgotPasswordForm).toBeDefined();
    // setPasswordForm has been removed - no longer testing it
  });

  it('toggles password visibility', () => {
    const before = component.showPassword;
    component.togglePasswordVisibility();
    expect(component.showPassword).toBe(!before);
  });

  it('switches to forgot password form and back', () => {
    component.showForgotPasswordForm();
    expect(component.currentFormState).toBe('forgotPassword');
    component.backToLogin();
    expect(component.currentFormState).toBe('login');
  });

  it('onSubmit shows toast when identifier is missing', () => {
    spyOn(component, 'showToast');
    component.loginForm.patchValue({ identifier: '', password: '' });
    component.onSubmit();
    expect(component.showToast).toHaveBeenCalledWith('Please enter your username or email.');
  });

  it('sendResetLink calls authService and updates state on success', () => {
    spyOn(component, 'showToast');
    component.forgotPasswordForm.patchValue({ email: 'user@example.com' });
    authSpy.forgotPassword.and.returnValue(of({}));

    component.sendResetLink();

    expect(authSpy.forgotPassword).toHaveBeenCalledWith('user@example.com');
    expect(component.currentFormState).toBe('success');
    expect(component.showToast).toHaveBeenCalled();
  });

  it('sendResetLink shows toast on error', () => {
    spyOn(component, 'showToast');
    component.forgotPasswordForm.patchValue({ email: 'user@example.com' });
    authSpy.forgotPassword.and.returnValue(throwError(() => ({ name: 'Error' })));

    component.sendResetLink();

    expect(component.showToast).toHaveBeenCalled();
  });
});
