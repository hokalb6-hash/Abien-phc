/** أنواع دنيا لـ Edge Functions؛ وقت التشغيل الفعلي هو Deno على Supabase. */
declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
}
