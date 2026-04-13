/** العيادات الثلاث المعتمدة في المركز */
export const CLINIC_TYPES = ['internal', 'gynecology', 'pediatrics'] as const
export type ClinicTypeValue = (typeof CLINIC_TYPES)[number]

export const CLINIC_LABELS: Record<ClinicTypeValue, string> = {
  internal: 'العيادة الداخلية',
  gynecology: 'العيادة النسائية',
  pediatrics: 'عيادة الأطفال',
}
