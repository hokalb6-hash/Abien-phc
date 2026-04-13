/**
 * تنسيقات عرض للواجهة العربية
 */

export function formatQueueNumber(n: number): string {
  return new Intl.NumberFormat('ar-YE', { minimumIntegerDigits: 1 }).format(n)
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('ar-YE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

/** تسمية عربية لحالة الدور في قائمة الانتظار */
export function queueStatusLabel(status: string): string {
  const map: Record<string, string> = {
    waiting: 'في الانتظار',
    called: 'تم الاستدعاء',
    in_service: 'قيد الكشف',
    completed: 'مكتمل',
    cancelled: 'ملغى',
  }
  return map[status] ?? status
}

/** تسمية عربية لنوع العيادة (العيادات الثلاث المعتمدة + قيم قديمة للعرض فقط) */
export function clinicTypeLabel(type: string): string {
  const map: Record<string, string> = {
    internal: 'العيادة الداخلية',
    gynecology: 'العيادة النسائية',
    pediatrics: 'عيادة الأطفال',
    er: 'الإسعاف — زيارة مباشرة',
  }
  return map[type] ?? type
}

/** تسمية عربية لحالة التحويل (مخبر / إسعاف) */
export function referralStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: 'معلق',
    in_progress: 'قيد التنفيذ',
    completed: 'مكتمل',
  }
  return map[status] ?? status
}
