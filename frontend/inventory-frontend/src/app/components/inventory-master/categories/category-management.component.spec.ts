import { of } from 'rxjs';
import { CategoryManagementComponent } from './category-management.component';

describe('CategoryManagementComponent (unit)', () => {
  let component: CategoryManagementComponent;
  const fakeCategoryService: any = {
    list: jasmine.createSpy('list').and.returnValue(
      of({
        data: [
          { category_id: 1, category_name: 'Rice', parent_category_id: null, description: '' },
          { category_id: 2, category_name: 'Canned Goods', parent_category_id: null, description: '' },
        ],
      }),
    ),
  };
  const fakeToast: any = { success: () => {}, error: () => {} };
  const fakeCdr: any = { detectChanges: () => {} };

  beforeEach(() => {
    component = new CategoryManagementComponent(fakeCategoryService as any, fakeCdr as any, fakeToast as any);
  });

  it('loads categories and paginates them', () => {
    component.loadCategories();

    expect(fakeCategoryService.list).toHaveBeenCalledWith(undefined);
    expect(component.categories.length).toBe(2);
    expect(component.parentOptions.length).toBe(2);
    expect(component.pagedCategories.length).toBe(2);
  });

  it('starts and closes the category form', () => {
    component.startNew();

    expect(component.showForm).toBeTrue();
    expect(component.selectedCategoryId).toBeNull();

    component.editCategory({ category_id: 7, category_name: 'Fresh', parent_category_id: null, description: 'desc' } as any);
    expect(component.selectedCategoryId).toBe(7);
    expect(component.formData.category_name).toBe('Fresh');

    component.closeForm();
    expect(component.showForm).toBeFalse();
    expect(component.selectedCategoryId).toBeNull();
  });
});