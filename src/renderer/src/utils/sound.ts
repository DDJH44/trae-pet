/**
 * 提醒提示音：Web Audio 合成两声「叮-咚」，无需音频文件
 */
let ctx: AudioContext | null = null

export function playReminderChime(): void {
  try {
    if (!ctx) ctx = new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    const note = (freq: number, start: number, dur: number): void => {
      const osc = ctx!.createOscillator()
      const gain = ctx!.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(gain)
      gain.connect(ctx!.destination)
      const t = ctx!.currentTime + start
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      osc.start(t)
      osc.stop(t + dur)
    }
    note(880, 0, 0.16) // 叮
    note(1318, 0.18, 0.22) // 咚（E6，明亮）
  } catch {
    // 音频不可用时静默跳过，不影响其他提醒通道
  }
}
