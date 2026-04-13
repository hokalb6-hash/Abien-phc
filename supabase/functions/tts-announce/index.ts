/**
 * نطق عربي مجاني عبر خدمة Microsoft Edge Read Aloud (بدون مفتاح API).
 * يُرجع { audioBase64 } ليتوافق مع src/lib/ttsEdge.ts و supabase.functions.invoke.
 */
const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_CHARS = 500
const TRUSTED_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const WS_PATH =
  'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1' +
  `?TrustedClientToken=${TRUSTED_TOKEN}`

const DEFAULT_VOICE = 'ar-SA-ZariyahNeural'

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function isSafeNeuralVoiceName(v: string): boolean {
  return /^[a-z]{2}-[a-z]{2}-[a-z0-9]+neural$/i.test(v)
}

function indexOfSubarray(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer
    }
    return i
  }
  return -1
}

function concatUint8(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const c of chunks) {
    out.set(c, off)
    off += c.length
  }
  return out
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk)
    for (let j = 0; j < sub.length; j++) {
      binary += String.fromCharCode(sub[j]!)
    }
  }
  return btoa(binary)
}

function connectId(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

/**
 * يطابق منطق مكتبة edge-tts الخفيفة: WebSocket + SSML → مقاطع MP3.
 */
function synthesizeEdgeReadAloud(text: string, voice: string): Promise<Uint8Array> {
  const audioSep = new TextEncoder().encode('Path:audio\r\n')
  const chunks: Uint8Array[] = []

  return new Promise((resolve, reject) => {
    let settled = false
    const url = `${WS_PATH}&ConnectionId=${connectId()}`
    // Deno / Supabase Edge يدعمان headers هنا؛ تعريف TypeScript الافتراضي لـ WebSocket لا يتضمنها.
    const ws = new WebSocket(url, {
      headers: {
        Host: 'speech.platform.bing.com',
        Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.5060.66 Safari/537.36 Edg/103.0.1264.44',
      },
    } as unknown as string[])
    ws.binaryType = 'arraybuffer'

    const timer = setTimeout(() => {
      finish(new Error('انتهت مهلة توليد الصوت'))
    }, 25_000)

    function finish(err: Error | null, audio?: Uint8Array) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        ws.close()
      } catch {
        /* ignore */
      }
      if (err) reject(err)
      else if (audio) resolve(audio)
      else reject(new Error('لا يوجد صوت'))
    }

    ws.onerror = () => finish(new Error('فشل اتصال TTS'))

    ws.onopen = () => {
      const speechConfig = JSON.stringify({
        context: {
          synthesis: {
            audio: {
              metadataoptions: { sentenceBoundaryEnabled: false, wordBoundaryEnabled: false },
              outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
            },
          },
        },
      })
      const configMessage =
        `X-Timestamp:${Date()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n${speechConfig}`
      ws.send(configMessage)

      const reqId = connectId()
      const ssmlMessage =
        `X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${Date()}Z\r\nPath:ssml\r\n\r\n` +
        `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='ar-SA'>` +
        `<voice name='${voice}'><prosody pitch='+0Hz' rate='+0%' volume='+0%'>${escapeXml(
          text,
        )}</prosody></voice></speak>`
      ws.send(ssmlMessage)
    }

    ws.onmessage = (ev) => {
      void (async () => {
        try {
          if (typeof ev.data === 'string') {
            if (ev.data.includes('turn.end')) {
              const merged = concatUint8(chunks)
              if (merged.length === 0) {
                finish(new Error('لم يُستلم صوت'))
                return
              }
              finish(null, merged)
            }
            return
          }
          let buf: ArrayBuffer
          if (ev.data instanceof ArrayBuffer) buf = ev.data
          else if (ev.data instanceof Blob) buf = await ev.data.arrayBuffer()
          else {
            finish(new Error('نوع رسالة غير مدعوم'))
            return
          }
          const data = new Uint8Array(buf)
          const idx = indexOfSubarray(data, audioSep)
          if (idx === -1) return
          chunks.push(data.subarray(idx + audioSep.length))
        } catch (e) {
          finish(e instanceof Error ? e : new Error(String(e)))
        }
      })()
    }
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const rawText =
    typeof body === 'object' && body !== null && 'text' in body
      ? String((body as { text: unknown }).text)
      : ''
  const text = rawText.replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS)
  if (!text) {
    return new Response(JSON.stringify({ error: 'Text is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let voice = DEFAULT_VOICE
  if (typeof body === 'object' && body !== null && 'voiceName' in body) {
    const v = String((body as { voiceName: unknown }).voiceName).trim()
    if (isSafeNeuralVoiceName(v)) voice = v
  }

  try {
    const mp3 = await synthesizeEdgeReadAloud(text, voice)
    const audioBase64 = bytesToBase64(mp3)
    return new Response(JSON.stringify({ audioBase64 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[tts-announce]', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
