/**
 * تواريخ تقويمية للمركز (بدون الاعتماد على خادم).
 * التوقيت الفني: Asia/Aden (UTC+3 كسائر اليمن) — التسمية المعروضة للمستخدم: «أبين سمعان».
 */
export const LOCAL_CALENDAR_IANA = 'Asia/Aden' as const

/** للنصوص العربية في الواجهة (لا يغيّر المنطقة الزمنية الفنية) */
export const LOCAL_TIMEZONE_LABEL_AR = 'أبين سمعان'

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function localCalendarYMD(ref: Date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: LOCAL_CALENDAR_IANA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = fmt.formatToParts(ref)
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    parseInt(parts.find((p) => p.type === t)?.value ?? '0', 10)
  return { y: get('year'), m: get('month'), d: get('day') }
}

export function todayAdenYMD(): string {
  const { y, m, d } = localCalendarYMD()
  return `${y}-${pad2(m)}-${pad2(d)}`
}

/** اليوم التالي للتقويم الميلادي بعد «اليوم» بنفس التوقيت المحلي للمركز */
export function tomorrowAdenYMD(): string {
  const { y, m, d } = localCalendarYMD()
  const next = new Date(Date.UTC(y, m - 1, d + 1))
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`
}
