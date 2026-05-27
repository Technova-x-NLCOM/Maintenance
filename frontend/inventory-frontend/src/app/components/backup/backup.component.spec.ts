import { HttpHeaders } from '@angular/common/http';
import { of } from 'rxjs';
import { BackupComponent } from './backup.component';

describe('BackupComponent (unit)', () => {
  let component: BackupComponent;
  const fakeHttp: any = {
    post: jasmine.createSpy('post').and.returnValue(
      of({
        body: new Blob(['backup'], { type: 'application/octet-stream' }),
        headers: new HttpHeaders({
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': 'attachment; filename="backup.sql"',
        }),
      }),
    ),
  };
  const fakeToast: any = { success: () => {}, error: () => {} };
  const fakeCdr: any = { detectChanges: () => {} };

  beforeEach(() => {
    component = new BackupComponent(fakeHttp as any, fakeCdr as any, fakeToast as any);
  });

  it('toggles modal state and file selection', () => {
    component.showCreateConfirmModal();
    expect(component.showCreateConfirm).toBeTrue();

    component.closeCreateConfirmModal();
    expect(component.showCreateConfirm).toBeFalse();

    component.onFileSelected({ target: { files: [new File(['x'], 'db.sql')] } } as any);
    expect(component.uploadingFile?.name).toBe('db.sql');
  });

  it('restoreFromUploadedFile is ignored when no file is selected', () => {
    component.restoreFromUploadedFile();
    expect(component.restoring).toBeFalse();
    expect(fakeHttp.post).not.toHaveBeenCalled();
  });

  it('createBackup returns early while already creating', () => {
    component.creating = true;
    component.createBackup();
    expect(fakeHttp.post).not.toHaveBeenCalled();
  });
});