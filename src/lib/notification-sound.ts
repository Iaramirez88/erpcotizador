export function playNotificationBellSound() {
  if (typeof window === 'undefined') return

  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return

  try {
    const context = new AudioContextClass()
    const gain = context.createGain()
    const startAt = context.currentTime

    gain.connect(context.destination)

    const ring = (offset: number, startFrequency: number, endFrequency: number, peakGain: number, duration: number) => {
      const oscillator = context.createOscillator()
      const oscillatorGain = context.createGain()

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(startFrequency, startAt + offset)
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency, startAt + offset + duration)

      oscillatorGain.gain.setValueAtTime(0.0001, startAt + offset)
      oscillatorGain.gain.exponentialRampToValueAtTime(peakGain, startAt + offset + 0.02)
      oscillatorGain.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + duration)

      oscillator.connect(oscillatorGain)
      oscillatorGain.connect(gain)
      oscillator.start(startAt + offset)
      oscillator.stop(startAt + offset + duration + 0.02)
    }

    ring(0, 1760, 1320, 0.06, 0.18)
    ring(0.08, 1320, 990, 0.04, 0.24)

    window.setTimeout(() => {
      void context.close().catch(() => undefined)
    }, 450)
  } catch {
    return
  }
}