/**
 * قائمة التحاليل المعتمدة للطلب من العيادة والرد من المخبر (مرتبة كما في النظام الورقي).
 */
export const LAB_TEST_CATALOG = [
  { id: 'ldl', label: 'LDL' },
  { id: 'cbc', label: 'CBC' },
  { id: 'pregnancy_test', label: 'Pregnancy Test' },
  { id: 'hb_hct', label: 'HB+HCT' },
  { id: 'sgpt_alt', label: 'SGPT ( ALT )' },
  { id: 'urine_analysis', label: 'URINE ANALYSIS' },
  { id: 'bilirubin_td', label: 'BILIRUBIN(T+D)' },
  { id: 'blood_group', label: 'BLOOD GROUP' },
  { id: 'cbc_platelets', label: 'CBC + Platelets' },
  { id: 'glucose', label: 'GLUCOSE' },
  { id: 'creatinine', label: 'CREATININE' },
  { id: 'crp_quantitative', label: 'CRP ( Quantitative )' },
  { id: 'wright_test', label: 'Wright Test' },
  { id: 'widal_test', label: 'WIDAL TEST' },
  { id: 'cholesterol', label: 'CHOLESTEROL' },
  { id: 'esr', label: 'ESR' },
] as const

export function labelsFromLabTestIds(ids: Iterable<string>): string[] {
  const idSet = new Set(ids)
  return LAB_TEST_CATALOG.filter((t) => idSet.has(t.id)).map((t) => t.label)
}

export function parseRequestedLabTests(value: unknown): string[] {
  if (value == null) return []
  if (Array.isArray(value)) {
    return value.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
  }
  return []
}
