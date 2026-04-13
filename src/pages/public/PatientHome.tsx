import { Link } from 'react-router-dom'
import {
  Activity,
  Clock,
  HeartPulse,
  Home,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react'
import { BrandMark } from '../../components/BrandMark'
import { PatientAnnouncementBanner } from '../../components/PatientAnnouncementBanner'
import { Card } from '../../components/ui/Card'
import { SITE_DEVELOPER_CREDIT_AR } from '../../constants/brand'
import { isSupabaseConfigured } from '../../lib/supabase'

/**
 * صور محلية من مجلد `public/landing/` — تُعرض دائماً مع الموقع دون الاعتماد على الإنترنت.
 * (مأخوذة أصلاً من Unsplash — أطباء ذكور في سياق عيادي.)
 */
const IMG = {
  hero: `${import.meta.env.BASE_URL}landing/hero-doctor.jpg`,
  care: `${import.meta.env.BASE_URL}landing/care-consultation.jpg`,
  phcClinic: `${import.meta.env.BASE_URL}landing/phc-doctor.jpg`,
} as const

const btnPrimary =
  'inline-flex items-center justify-center rounded-xl bg-teal-500 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-teal-900/25 transition hover:bg-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 motion-safe:hover:scale-[1.02] motion-reduce:hover:scale-100'
const btnSecondary =
  'inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/10 px-5 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 motion-safe:hover:scale-[1.02] motion-reduce:hover:scale-100'

/** زر «ابدأ الحجز» في الشريط السفلي — أسود دون تعارض مع أزرار التيل */
const btnCtaBlack =
  'inline-flex shrink-0 items-center justify-center rounded-xl bg-neutral-950 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-black/40 ring-1 ring-white/10 transition hover:bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 motion-safe:hover:scale-[1.02] motion-reduce:hover:scale-100'

const featureItems = [
  {
    icon: HeartPulse,
    title: 'رعاية منظّمة',
    text: 'تنسيق بين العيادة والمخبر والصيدلية ضمن مسار واحد للمراجع.',
  },
  {
    icon: Clock,
    title: 'توفير الوقت',
    text: 'احجز دورك إلكترونياً وتجنّب الانتظار في الاستقبال لأخذ رقم يدوي.',
  },
  {
    icon: ShieldCheck,
    title: 'خصوصية وأمان',
    text: 'بياناتك تُدار عبر نظام مركزي مع صلاحيات واضحة للطاقم الطبي.',
  },
] as const

/**
 * واجهة الزائر غير المسجّل: صفحة بداية احترافية مع حركات وصور طبية.
 */
export default function PatientHome() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <PatientAnnouncementBanner />

      {!isSupabaseConfigured ? (
        <div
          className="border-b border-amber-500/30 bg-amber-950/80 px-4 py-3 text-center text-sm text-amber-100"
          role="status"
        >
          <strong>وضع المعاينة:</strong> لم يُعثر على ملف <code className="rounded bg-amber-900/60 px-1">.env</code> أو مفاتيح
          Supabase. أضف <code className="rounded bg-amber-900/60 px-1">VITE_SUPABASE_URL</code> و
          <code className="rounded bg-amber-900/60 px-1">VITE_SUPABASE_ANON_KEY</code> ثم أعد تشغيل{' '}
          <code className="rounded bg-amber-900/60 px-1">npm run dev</code> ليعمل الحجز والدخول.
        </div>
      ) : null}

      {/* ——— Hero ——— */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={IMG.hero}
            alt="طبيب ذكر يعمل في بيئة عيادة"
            className="h-full w-full object-cover opacity-40 motion-safe:animate-ken-burns motion-reduce:animate-none"
            decoding="async"
            fetchPriority="high"
          />
          <div
            className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/92 to-slate-950"
            aria-hidden
          />
          <div
            className="absolute -start-[20%] top-1/4 h-72 w-72 rounded-full bg-teal-500/20 blur-3xl motion-safe:animate-float motion-reduce:animate-none"
            aria-hidden
          />
          <div
            className="absolute -end-[10%] bottom-0 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl motion-safe:animate-float motion-reduce:animate-none"
            style={{ animationDelay: '1s' }}
            aria-hidden
          />
        </div>

        <div className="relative mx-auto flex max-w-6xl flex-col gap-12 px-4 pb-16 pt-14 lg:flex-row lg:items-center lg:gap-10 lg:pb-24 lg:pt-20">
          <div className="max-w-xl flex-1">
            <div
              className="motion-safe:animate-fade-in-up motion-reduce:animate-none"
              style={{ animationDelay: '0ms' }}
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-500/10 px-3 py-1 text-xs font-medium text-teal-200">
                <Activity className="h-3.5 w-3.5" aria-hidden />
                منصة صحية متكاملة
              </span>
            </div>
            <div
              className="mt-5 flex flex-wrap items-center gap-4 motion-safe:animate-fade-in-up motion-reduce:animate-none"
              style={{ animationDelay: '80ms' }}
            >
              <BrandMark
                size={56}
                className="rounded-xl bg-white/10 p-1.5 ring-1 ring-white/20 shadow-lg shadow-black/20"
              />
              <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white md:text-5xl lg:text-[2.75rem]">
                أبين الصحي
              </h1>
            </div>
            <p
              className="mt-4 text-lg leading-relaxed text-slate-300 md:text-xl motion-safe:animate-fade-in-up motion-reduce:animate-none"
              style={{ animationDelay: '140ms' }}
            >
              احجز دورك في العيادة <span className="font-semibold text-teal-300">من منزلك</span> عبر الهاتف أو
              الحاسوب — دون الحاجة للمرور على الاستقبال لأخذ رقم يدوياً.
            </p>

            <div
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap motion-safe:animate-fade-in-up motion-reduce:animate-none"
              style={{ animationDelay: '220ms' }}
            >
              <Link to="/check-in" className={`${btnPrimary} sm:min-w-[200px]`}>
                احجز دوري الآن
              </Link>
              <Link to="/login" className={`${btnSecondary} sm:min-w-[180px]`}>
                دخول الموظفين
              </Link>
            </div>
            <p
              className="mt-6 text-sm text-slate-500 motion-safe:animate-fade-in motion-reduce:animate-none"
              style={{ animationDelay: '320ms' }}
            >
              الموظفون فقط يحتاجون تسجيل الدخول. المريض لا يحتاج حساباً.
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-md flex-1 lg:mx-0 lg:max-w-none">
            <div
              className="motion-safe:animate-fade-in-up-slow motion-reduce:animate-none"
              style={{ animationDelay: '200ms' }}
            >
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl shadow-black/40 backdrop-blur-sm">
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src={IMG.care}
                    alt="طبيب ذكر يستشير مريضاً في عيادة أولية"
                    className="h-full w-full object-cover transition duration-700 motion-safe:hover:scale-105 motion-reduce:hover:scale-100"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 to-transparent p-4 pt-16">
                  <p className="text-sm font-medium text-white">متابعة زيارتك بسهولة</p>
                  <p className="mt-1 text-xs text-slate-300">رقم الدور يظهر على شاشة الانتظار في المركز.</p>
                </div>
              </div>
              <div className="absolute -bottom-4 -start-4 hidden w-40 overflow-hidden rounded-xl border border-teal-500/20 shadow-xl sm:block motion-safe:animate-float motion-reduce:animate-none [animation-duration:6s]">
                <img
                  src={IMG.phcClinic}
                  alt="طبيب ذكر في معطف أبيض — مركز رعاية أولية"
                  className="h-28 w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ——— Features ——— */}
      <section className="relative border-t border-white/5 bg-slate-900/50 px-4 py-16 backdrop-blur-sm">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          {featureItems.map((item, i) => (
            <div
              key={item.title}
              className="motion-safe:animate-fade-in-up motion-reduce:animate-none"
              style={{ animationDelay: `${200 + i * 90}ms` }}
            >
              <Card className="h-full border-white/10 bg-slate-900/80 p-6 text-start shadow-lg shadow-black/20 transition motion-safe:hover:border-teal-500/30 motion-safe:hover:-translate-y-0.5 motion-reduce:hover:translate-y-0">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300">
                  <item.icon className="h-5 w-5" aria-hidden />
                </span>
                <h2 className="mt-4 text-lg font-bold text-white">{item.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.text}</p>
              </Card>
            </div>
          ))}
        </div>
      </section>

      {/* ——— Steps + secondary visual ——— */}
      <section className="px-4 py-16">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <h2 className="text-2xl font-bold text-white md:text-3xl">كيف يعمل الحجز؟</h2>
            <p className="mt-2 text-slate-400">ثلاث خطوات بسيطة لإكمال الطلب قبل وصولك.</p>
            <ul className="mt-8 flex flex-col gap-5">
              {[
                {
                  n: '1',
                  icon: Home,
                  text: 'أكمل النموذج من منزلك أو أي مكان لديك فيه إنترنت.',
                },
                {
                  n: '2',
                  icon: Stethoscope,
                  text: 'ستحصل على رقم دور فوري، ويظهر على شاشة الدور في المركز.',
                },
                {
                  n: '3',
                  icon: Activity,
                  text: 'تقدَّم إلى العيادة في الوقت المناسب دون المرور على الاستقبال لأخذ رقم.',
                },
              ].map((step, i) => (
                <li
                  key={step.n}
                  className="flex gap-4 rounded-xl border border-white/5 bg-white/[0.03] p-4 motion-safe:animate-fade-in-up motion-reduce:animate-none"
                  style={{ animationDelay: `${300 + i * 100}ms` }}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-700 text-sm font-bold text-white shadow-lg shadow-teal-900/40">
                    {step.n}
                  </span>
                  <span className="flex min-w-0 flex-1 items-start gap-3 pt-1">
                    <step.icon className="mt-0.5 h-5 w-5 shrink-0 text-teal-400" aria-hidden />
                    <span className="text-sm leading-relaxed text-slate-300">{step.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="order-1 lg:order-2">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 motion-safe:animate-fade-in-up-slow motion-reduce:animate-none">
              <img
                src={IMG.phcClinic}
                alt="طبيب ذكر في بيئة عيادة للرعاية الصحية الأولية"
                className="aspect-[5/4] w-full object-cover lg:aspect-auto lg:min-h-[320px]"
                loading="lazy"
                decoding="async"
              />
              <div
                className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent"
                aria-hidden
              />
              <p className="absolute bottom-4 start-4 end-4 text-sm text-slate-200">
                نسعى لتجربة انتظار أوضح للمراجع وللطاقم على حدٍّ سواء.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ——— CTA strip ——— */}
      <section className="border-t border-white/5 bg-gradient-to-l from-teal-900/40 via-slate-900 to-slate-950 px-4 py-14">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 text-center md:flex-row md:text-start">
          <div className="motion-safe:animate-fade-in-up motion-reduce:animate-none">
            <h2 className="text-xl font-bold text-white md:text-2xl">جاهز لحجز دورك؟</h2>
            <p className="mt-2 max-w-xl text-sm text-slate-400">
              يستغرق التسجيل دقائق معدودة. يمكنك العودة لاحقاً لتعديل البيانات قبل الحضور إن احتجت.
            </p>
          </div>
          <Link to="/check-in" className={btnCtaBlack}>
            ابدأ الحجز
          </Link>
        </div>
      </section>

      <footer className="space-y-3 border-t border-white/5 px-4 py-6 text-center text-xs text-slate-600">
        <p className="font-medium text-slate-500">{SITE_DEVELOPER_CREDIT_AR}</p>
        <p>
          الصور مُخزَّنة مع الموقع في مجلد <code className="text-slate-500">public/landing</code> لتظهر حتى دون اتصال
          خارجي؛ المصدر الأصلي للتصوير المخزَّن:{' '}
          <a
            href="https://unsplash.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 underline decoration-slate-700 underline-offset-2 transition hover:text-slate-400"
          >
            Unsplash
          </a>
          .
        </p>
      </footer>
    </div>
  )
}
