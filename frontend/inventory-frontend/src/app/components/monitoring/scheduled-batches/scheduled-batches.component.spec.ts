import { of } from 'rxjs';
import { ScheduledBatchesComponent } from './scheduled-batches.component';

describe('ScheduledBatchesComponent (unit)', () => {
  let component: ScheduledBatchesComponent;
  const fakeBatchService: any = {
    listProgramPlans: jasmine.createSpy('listProgramPlans').and.returnValue(
      of({
        data: [
          { plan_id: 1, template_name: 'Week 1', status: 'planned', planned_date: '2026-05-27' },
        ],
      }),
    ),
    getProgramPlan: jasmine.createSpy('getProgramPlan').and.returnValue(
      of({
        data: {
          plan: { plan_id: 1, template_name: 'Week 1', status: 'planned', planned_date: '2026-05-27' },
          issuance: null,
        },
      }),
    ),
  };
  const fakeToast: any = { success: () => {}, error: () => {} };
  const fakeCdr: any = { detectChanges: () => {} };

  beforeEach(() => {
    component = new ScheduledBatchesComponent(fakeBatchService as any, fakeCdr as any, fakeToast as any);
  });

  it('loads plans and details for a selected plan', () => {
    component.loadPlans();
    expect(fakeBatchService.listProgramPlans).toHaveBeenCalled();
    expect(component.plans.length).toBe(1);

    component.selectPlan({ plan_id: 1, template_name: 'Week 1', status: 'planned', planned_date: '2026-05-27' } as any);
    expect(fakeBatchService.getProgramPlan).toHaveBeenCalledWith(1);
    expect(component.selectedPlan?.plan.plan_id).toBe(1);
  });

  it('maps statuses to tag classes', () => {
    expect(component.getStatusClass('planned')).toBe('tag-planned');
    expect(component.getStatusClass('ready')).toBe('tag-ready');
    expect(component.getStatusClass('unknown')).toBe('');
  });
});