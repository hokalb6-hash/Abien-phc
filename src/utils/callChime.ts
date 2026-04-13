/**
 * جرس قصير عند الاستدعاء — Web Audio غالباً أوثق من TTS على أجهزة التلفاز/اللوحات.
 * يجب استدعاء resumeCallAudioContext() بعد تفاعل المستخدم (مثل زر تفعيل الصوت).
 */
let audioCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null
  if (!audioCtx) audioCtx = new Ctx()
  return audioCtx
}

export async function resumeCallAudioContext(): Promise<void> {
  const ctx = getCtx()
  if (!ctx) return
  if (ctx.state === 'suspended') await ctx.resume()
}

/**
 * يُستدعى **متزامناً** داخل onClick (قبل أي await/setState) — مطلوب على Chrome/Android ولوحات الذكية
 * حتى يُعتبر استئناف Web Audio ضمن «تفاعل المستخدم» ولا يُرفض.
 */
export function primeCallAudioInUserGesture(): void {
  const ctx = getCtx()
  if (!ctx) return
  if (ctx.state === 'suspended') void ctx.resume()
}

function playChimeOscillator(ctx: AudioContext): void {
  const t0 = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(880, t0)
  osc.frequency.exponentialRampToValueAtTime(660, t0 + 0.12)

  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28)

  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + 0.3)
}

/**
 * جرس الاستدعاء. بعد النقر غالباً يكون السياق لا يزال suspended؛ resume() غير متزامن
 * لذلك ننتظر اكتماله ثم نشغّل الجرس — وإلا يبقى التفعيل بلا أي صوت مسموع.
 */
export function playCallChime(): void {
  try {
    const ctx = getCtx()
    if (!ctx) return

    const tryPlay = () => {
      if (ctx.state !== 'running') return
      playChimeOscillator(ctx)
    }

    tryPlay()
    if (ctx.state === 'suspended') {
      void ctx.resume().then(tryPlay).catch(() => {})
    }
  } catch {
    /* متصفحات بدون Web Audio أو سياسة تشغيل */
  }
}
