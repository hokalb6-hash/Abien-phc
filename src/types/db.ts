/**
 * أنواع TypeScript مطابقة لجداول Supabase العامة.
 * عدّل الأسماء/الحقول إن اختلفت لديك في قاعدة البيانات الفعلية.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

/** أدوار المستخدمين في النظام (قيمة عمود profiles.role) */
export type AppRole =
  | 'admin'
  /** قديم: التسجيل أصبح للمريض عبر /check-in؛ يُفضّل إزالة الدور من الحسابات أو تحويله */
  | 'reception'
  | 'clinic'
  | 'lab'
  | 'er'
  | 'pharmacy'
  | 'display'

/** حالة سجل دور في قائمة الانتظار */
export type QueueStatus =
  | 'waiting'
  | 'called'
  | 'in_service'
  | 'completed'
  | 'cancelled'

/** حالة التحويل (مخبر / إسعاف) */
export type ReferralStatus = 'pending' | 'in_progress' | 'completed'

export interface Database {
  public: {
    Tables: {
      patients: {
        Row: {
          id: string
          full_name: string
          national_id: string | null
          phone: string | null
          date_of_birth: string | null
          gender: string | null
          address: string | null
          notes: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          full_name: string
          national_id?: string | null
          phone?: string | null
          date_of_birth?: string | null
          gender?: string | null
          address?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          full_name?: string
          national_id?: string | null
          phone?: string | null
          date_of_birth?: string | null
          gender?: string | null
          address?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          role: AppRole
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id: string
          full_name?: string | null
          role?: AppRole
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          full_name?: string | null
          role?: AppRole
          created_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      queues: {
        Row: {
          id: string
          patient_id: string
          clinic_type: string
          status: QueueStatus
          queue_number: number
          /** يوم تقديم الخدمة (توقيت المركز — أبين سمعان / Asia/Aden) */
          service_date: string
          diagnosis_id: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          patient_id: string
          clinic_type: string
          status?: QueueStatus
          /** يُملأ غالباً عبر تريغر / assign_queue_number في قاعدة البيانات */
          queue_number?: number
          service_date?: string
          diagnosis_id?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          patient_id?: string
          clinic_type?: string
          status?: QueueStatus
          queue_number?: number
          service_date?: string
          diagnosis_id?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'queues_patient_id_fkey'
            columns: ['patient_id']
            referencedRelation: 'patients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'queues_diagnosis_id_fkey'
            columns: ['diagnosis_id']
            referencedRelation: 'diagnoses'
            referencedColumns: ['id']
          },
        ]
      }
      diagnoses: {
        Row: {
          id: string
          code: string | null
          name_ar: string
          description: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          code?: string | null
          name_ar: string
          description?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          code?: string | null
          name_ar?: string
          description?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      medications: {
        Row: {
          id: string
          name: string
          form: string | null
          unit: string | null
          default_dosage: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          form?: string | null
          unit?: string | null
          default_dosage?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          form?: string | null
          unit?: string | null
          default_dosage?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      prescriptions: {
        Row: {
          id: string
          queue_id: string
          medication_id: string
          dosage: string
          frequency: string
          duration: string
          dispensed: boolean
          dispensed_at: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          queue_id: string
          medication_id: string
          dosage: string
          frequency: string
          duration: string
          dispensed?: boolean
          dispensed_at?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          queue_id?: string
          medication_id?: string
          dosage?: string
          frequency?: string
          duration?: string
          dispensed?: boolean
          dispensed_at?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'prescriptions_queue_id_fkey'
            columns: ['queue_id']
            referencedRelation: 'queues'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'prescriptions_medication_id_fkey'
            columns: ['medication_id']
            referencedRelation: 'medications'
            referencedColumns: ['id']
          },
        ]
      }
      referrals: {
        Row: {
          id: string
          queue_id: string
          department: string
          from_department: string | null
          status: ReferralStatus
          notes: string | null
          /** خدمة الطوارئ المسجّلة عند الإكمال (قسم er) */
          service_provided: string | null
          /** أسماء التحاليل المطلوبة من العيادة (مصفوفة JSON نصوص) */
          requested_lab_tests: Json
          /** نتائج التحاليل يُدخلها المخبر عند الإكمال */
          lab_results: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          queue_id: string
          department: string
          from_department?: string | null
          status?: ReferralStatus
          notes?: string | null
          service_provided?: string | null
          requested_lab_tests?: Json
          lab_results?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          queue_id?: string
          department?: string
          from_department?: string | null
          status?: ReferralStatus
          notes?: string | null
          service_provided?: string | null
          requested_lab_tests?: Json
          lab_results?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'referrals_queue_id_fkey'
            columns: ['queue_id']
            referencedRelation: 'queues'
            referencedColumns: ['id']
          },
        ]
      }
      queue_diagnoses: {
        Row: {
          queue_id: string
          diagnosis_id: string
          created_at: string
        }
        Insert: {
          queue_id: string
          diagnosis_id: string
          created_at?: string
        }
        Update: {
          queue_id?: string
          diagnosis_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'queue_diagnoses_queue_id_fkey'
            columns: ['queue_id']
            referencedRelation: 'queues'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'queue_diagnoses_diagnosis_id_fkey'
            columns: ['diagnosis_id']
            referencedRelation: 'diagnoses'
            referencedColumns: ['id']
          },
        ]
      }
      patient_announcements: {
        Row: {
          id: string
          title: string | null
          message: string
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          title?: string | null
          message: string
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          title?: string | null
          message?: string
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          action: string
          table_name: string | null
          record_id: string | null
          payload: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          table_name?: string | null
          record_id?: string | null
          payload?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string
          table_name?: string | null
          record_id?: string | null
          payload?: Json | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      /** إن كانت الدالة تُستدعى من العميل؛ غالباً الترقيم يتم عبر تريغر عند الإدراج */
      assign_queue_number: {
        Args: { p_clinic_type?: string | null } | Record<string, never>
        Returns: number
      }
      today_aden: {
        Args: Record<string, never>
        Returns: string
      }
      tomorrow_aden: {
        Args: Record<string, never>
        Returns: string
      }
      can_book_clinic_tomorrow: {
        Args: { p_clinic_type: string }
        Returns: Json
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Patient = Database['public']['Tables']['patients']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Queue = Database['public']['Tables']['queues']['Row']
export type Diagnosis = Database['public']['Tables']['diagnoses']['Row']
export type Medication = Database['public']['Tables']['medications']['Row']
export type Prescription = Database['public']['Tables']['prescriptions']['Row']
export type Referral = Database['public']['Tables']['referrals']['Row']
export type QueueDiagnosisLink = Database['public']['Tables']['queue_diagnoses']['Row']
export type PatientAnnouncement = Database['public']['Tables']['patient_announcements']['Row']
export type AuditLog = Database['public']['Tables']['audit_logs']['Row']
