import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { PatientAnnouncement } from '../types/db'

const STORAGE_KEY = 'abien_patient_ann_dismissed_id'

/**
 * شريط إعلان للزوار (الرئيسية / الحجز): يعرض آخر إعلان مفعّل من الإدارة.
 */
export function PatientAnnouncementBanner() {
  const [active, setActive] = useState<Pick<PatientAnnouncement, 'id' | 'title' | 'message'> | null>(null)
  const [visible, setVisible] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('patient_announcements')
      .select('id, title, message')
      .eq('is_active', true)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      const msg = error.message || ''
      if (msg.includes('patient_announcements') || msg.includes('does not exist') || error.code === '42P01') {
        setActive(null)
        setVisible(false)
      }
      return
    }
    if (!data) {
      setActive(null)
      setVisible(false)
      return
    }
    const row = data as Pick<PatientAnnouncement, 'id' | 'title' | 'message'>
    setActive(row)
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY)
      setVisible(dismissed !== row.id)
    } catch {
      setVisible(true)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const ch = supabase
      .channel('patient-announcements-public')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patient_announcements' }, () => {
        void load()
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [load])

  function dismiss() {
    if (!active) return
    try {
      localStorage.setItem(STORAGE_KEY, active.id)
    } catch {
      /* ignore */
    }
    setVisible(false)
  }

  if (!active || !visible) return null

  return (
    <div
      role="region"
      aria-label="إعلان من المركز"
      className="relative border-b border-teal-200 bg-gradient-to-l from-teal-50 to-teal-100/90 px-4 py-3 text-teal-950 shadow-sm"
    >
      <div className="mx-auto flex max-w-3xl items-start gap-3">
        <div className="min-w-0 flex-1 text-center sm:text-start">
          {active.title ? <p className="font-bold text-teal-900">{active.title}</p> : null}
          <p className={`whitespace-pre-wrap text-sm leading-relaxed text-teal-950 ${active.title ? 'mt-1' : ''}`}>
            {active.message}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg p-1.5 text-teal-800 transition hover:bg-teal-200/60"
          aria-label="إخفاء الإعلان"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
