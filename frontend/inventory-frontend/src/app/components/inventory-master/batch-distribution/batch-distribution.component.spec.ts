import { BatchDistributionComponent } from './batch-distribution.component';

describe('BatchDistributionComponent (unit)', () => {
  let component: BatchDistributionComponent;
  const fakeBatchService: any = {
    listProgramPlans: () => ({ subscribe: () => {} }),
    listTemplates: () => ({ subscribe: () => {} }),
    listItemOptions: () => ({ subscribe: () => {} }),
  };
  const fakeToast: any = { success: () => {}, error: () => {} };
  const fakeCdr: any = { detectChanges: () => {} };

  beforeEach(() => {
    component = new BatchDistributionComponent(fakeBatchService as any, fakeCdr as any, fakeToast as any);
  });

  it('derives labels from the selected distribution type', () => {
    expect(component.selectedDistributionType).toBe('feeding_program');
    expect(component.targetCountLabel).toBe('Target Attendees');
    expect(component.perUnitLabel).toBe('Amount per Serving');
    expect(component.targetUnitNounPlural).toBe('Attendees');

    component.templates = [
      { template_id: 1, template_name: 'Relief', distribution_type: 'relief_goods', base_unit_count: 10, notes: '' } as any,
    ];
    component.selectedTemplateId = 1;

    expect(component.selectedDistributionType).toBe('relief_goods');
    expect(component.targetCountLabel).toBe('Number of Relief Packs');
    expect(component.perUnitLabel).toBe('Items per Pack');
    expect(component.targetUnitNounPlural).toBe('Packs');
  });

  it('normalizes the target unit count', () => {
    component.targetUnitCount = 123.9;
    expect(component.normalizedTargetUnitCount).toBe(123);

    component.targetUnitCount = -1;
    expect(component.normalizedTargetUnitCount).toBe(0);
  });
});