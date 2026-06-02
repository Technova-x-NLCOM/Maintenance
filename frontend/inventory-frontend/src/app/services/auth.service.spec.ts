import { AuthService, AuthResponse, User } from './auth.service';
import { of } from 'rxjs';

describe('AuthService (unit, no TestBed)', () => {
  let service: AuthService;
  let fakeHttp: any;

  beforeEach(() => {
    localStorage.clear();
    fakeHttp = {
      post: jasmine.createSpy('post'),
      get: jasmine.createSpy('get')
    };

    // Avoid triggering HTTP in constructor because getToken returns null (localStorage cleared)
    service = new AuthService(fakeHttp as any);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('login should call http.post and set token + user', (done) => {
    const fakeUser: User = {
      user_id: 1,
      username: 'tester',
      email: 't@example.com',
      first_name: 'T',
      last_name: 'User',
      contact_info: null,
      role: 'inventory_manager',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const fakeResp: AuthResponse = {
      message: 'OK',
      access_token: 'tok_123',
      token_type: 'Bearer',
      expires_in: 3600,
      user: fakeUser
    };

    fakeHttp.post.and.returnValue(of(fakeResp));

    service.login('id', 'pw', 'inventory_manager').subscribe(resp => {
      expect(resp.access_token).toBe('tok_123');
      expect(localStorage.getItem('access_token')).toBe('tok_123');
      expect(service.getCurrentUser()?.username).toBe('tester');
      done();
    });
    expect(fakeHttp.post).toHaveBeenCalled();
  });

  it('forgotPassword should call http.post and return response', () => {
    fakeHttp.post.and.returnValue(of({ success: true, message: 'ok' }));
    service.forgotPassword('a@b.com').subscribe(resp => {
      expect(resp.message).toBe('ok');
    });
    expect(fakeHttp.post).toHaveBeenCalled();
  });

  it('getFriendlyErrorMessage handles throttle and fallback', () => {
    const throttled = service.getFriendlyErrorMessage({ status: 429 } as any, 'fallback');
    expect(throttled).toContain('Too many requests');

    const withMessage = service.getFriendlyErrorMessage({ error: { message: 'X' } } as any, 'fallback');
    expect(withMessage).toBe('X');

    const fallback = service.getFriendlyErrorMessage({}, 'fallback');
    expect(fallback).toBe('fallback');
  });
});
