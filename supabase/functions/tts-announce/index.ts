const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * نقطة استدعاء اختيارية لإعلان نصي من الخادم.
 * الواجهة الحالية تعتمد على Web Speech في المتصفح؛ يمكن لاحقاً ربط TTS خارجي هنا.
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const raw: unknown = await req.json().catch(() => null)
    const text =
      raw !== null &&
      typeof raw === 'object' &&
      'text' in raw &&
      typeof (raw as { text: unknown }).text === 'string'
        ? (raw as { text: string }).text.trim()
        : ''
    if (!text) {
      return new Response(JSON.stringify({ error: 'text required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'invalid request' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
