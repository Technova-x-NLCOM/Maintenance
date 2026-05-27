import { HeaderComponent } from './header.component';

describe('HeaderComponent (unit)', () => {
  let component: HeaderComponent;

  beforeEach(() => {
    component = new HeaderComponent();
  });

  it('creates instance', () => {
    expect(component).toBeTruthy();
  });

  it('emits menuToggle when toggleMenu is called', () => {
    spyOn(component.menuToggle, 'emit');
    component.toggleMenu();
    expect(component.menuToggle.emit).toHaveBeenCalled();
  });

  it('requests fullscreen when toggling from non-fullscreen', () => {
    const el: any = document.documentElement as any;
    const requestSpy = spyOn(el, 'requestFullscreen').and.callFake(() => {});
    component.isFullscreen = false;
    component.toggleFullscreen();
    expect(requestSpy).toHaveBeenCalled();
  });

  it('updates isFullscreen on onFullscreenChange based on document.fullscreenElement', () => {
    Object.defineProperty(document, 'fullscreenElement', { value: {}, configurable: true });
    component.onFullscreenChange();
    expect(component.isFullscreen).toBeTrue();

    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
    component.onFullscreenChange();
    expect(component.isFullscreen).toBeFalse();
  });
});
