const fileTracks = {
  rattle: { src: '/sounds/fortune-rattle.mp3', volume: 0.3 },
  paperSlide: { src: '/sounds/paper-slide.mp3', volume: 0.2 },
  ignition: { src: '/sounds/paper-ignition.mp3', volume: 0.28 },
  fire: { src: '/sounds/fire-crackle-loop.mp3', volume: 0.2 },
  nezha: { src: '/sounds/nezha-voice.mp3', volume: 0.32 },
}

export const SOUND_PREFERENCE_KEY = 'buru-wentian-sound-enabled-v1'

export function readSoundPreference() {
  try {
    const savedPreference = localStorage.getItem(SOUND_PREFERENCE_KEY)
    return savedPreference === null ? true : savedPreference === 'true'
  } catch {
    return true
  }
}

export function createSoundController() {
  const players = new Map()
  const fades = new Map()
  const fallbackLoops = new Map()
  const playerGenerations = new Map()
  const activeSources = new Set()
  let context = null
  let masterGain = null
  let enabled = false
  let noiseBuffer = null
  let lastClickAt = 0
  let voiceActive = false
  let activeVoiceErrorHandler = null
  let resumePromise = null

  function setVoiceActive(value) {
    voiceActive = value
    const firePlayer = players.get('fire')
    // Leave an in-progress fire fade in charge of its own volume ramp.
    if (firePlayer && !fades.has('fire')) {
      firePlayer.volume = voiceActive ? fileTracks.fire.volume * 0.3 : fileTracks.fire.volume
    }
  }

  function trackVolume(name) {
    if (name === 'fire' && voiceActive) return fileTracks.fire.volume * 0.3
    return fileTracks[name]?.volume ?? 0
  }

  function ensureContext() {
    if (typeof window === 'undefined') return null
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) {
      console.error('[sound] Web Audio API is unavailable in this browser')
      return null
    }

    if (!context || context.state === 'closed') {
      try {
        context = new AudioContextClass()
        masterGain = context.createGain()
        masterGain.gain.value = enabled ? 0.32 : 0
        masterGain.connect(context.destination)
        console.info(`[sound] AudioContext created: state=${context.state}; muted=${!enabled}`)
      } catch (error) {
        context = null
        masterGain = null
        console.error('[sound] AudioContext creation failed', error)
        return null
      }
    }

    return context
  }

  async function resumeContext(audioContext) {
    if (!audioContext) return false
    if (audioContext.state === 'running') return true
    if (resumePromise) return resumePromise
    resumePromise = (async () => {
      try {
        if (audioContext.state === 'suspended') await audioContext.resume()
        const resumed = audioContext.state === 'running'
        console.info(`[sound] AudioContext resume check: state=${audioContext.state}; muted=${!enabled}`)
        if (!resumed) console.warn(`[sound] AudioContext is not running (state=${audioContext.state}); playback may be blocked`)
        return resumed
      } catch (error) {
        console.error(`[sound] AudioContext resume failed: state=${audioContext.state}`, error)
        return false
      }
    })()
    try {
      return await resumePromise
    } finally {
      resumePromise = null
    }
  }

  function makeNoiseBuffer(audioContext) {
    if (noiseBuffer && noiseBuffer.sampleRate === audioContext.sampleRate) return noiseBuffer
    const length = Math.ceil(audioContext.sampleRate * 0.06)
    noiseBuffer = audioContext.createBuffer(1, length, audioContext.sampleRate)
    const samples = noiseBuffer.getChannelData(0)
    for (let index = 0; index < length; index += 1) {
      const envelope = 1 - index / length
      samples[index] = (Math.random() * 2 - 1) * envelope
    }
    return noiseBuffer
  }

  function scheduleTone(audioContext, frequency, {
    startAt = audioContext.currentTime,
    duration = 0.5,
    level = 0.06,
    waveform = 'sine',
    endFrequency,
  } = {}) {
    const oscillator = audioContext.createOscillator()
    const envelope = audioContext.createGain()
    oscillator.type = waveform
    oscillator.frequency.setValueAtTime(frequency, startAt)
    if (endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(
        endFrequency,
        startAt + Math.min(0.055, duration * 0.35),
      )
    }
    envelope.gain.setValueAtTime(0.0001, startAt)
    envelope.gain.exponentialRampToValueAtTime(level, startAt + 0.006)
    envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
    oscillator.connect(envelope)
    envelope.connect(masterGain)
    oscillator.onended = () => {
      activeSources.delete(oscillator)
      oscillator.disconnect()
      envelope.disconnect()
    }
    activeSources.add(oscillator)
    oscillator.start(startAt)
    oscillator.stop(startAt + duration + 0.02)
  }

  function scheduleWoodenAttack(audioContext, startAt, level = 0.045) {
    const source = audioContext.createBufferSource()
    const filter = audioContext.createBiquadFilter()
    const envelope = audioContext.createGain()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(1050, startAt)
    filter.Q.setValueAtTime(0.7, startAt)
    envelope.gain.setValueAtTime(0.0001, startAt)
    envelope.gain.exponentialRampToValueAtTime(level, startAt + 0.002)
    envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.035)
    source.buffer = makeNoiseBuffer(audioContext)
    source.connect(filter)
    filter.connect(envelope)
    envelope.connect(masterGain)
    source.onended = () => {
      activeSources.delete(source)
      source.disconnect()
      filter.disconnect()
      envelope.disconnect()
    }
    activeSources.add(source)
    source.start(startAt)
    source.stop(startAt + 0.04)
  }

  function playWoodTap(audioContext, { pitch = 190, delay = 0, level = 0.1 } = {}) {
    const startAt = audioContext.currentTime + delay
    scheduleWoodenAttack(audioContext, startAt, level * 0.34)
    scheduleTone(audioContext, pitch, {
      startAt,
      duration: 0.23,
      level,
      waveform: 'sine',
      endFrequency: pitch * 0.91,
    })
    scheduleTone(audioContext, pitch * 2.37, {
      startAt,
      duration: 0.12,
      level: level * 0.3,
      waveform: 'triangle',
      endFrequency: pitch * 2.08,
    })
    scheduleTone(audioContext, pitch * 4.18, {
      startAt,
      duration: 0.055,
      level: level * 0.08,
      waveform: 'sine',
    })
  }

  function playBell(audioContext, pitch, delay = 0, brightness = 1) {
    const startAt = audioContext.currentTime + delay
    scheduleTone(audioContext, pitch, {
      startAt, duration: 1.12, level: 0.08 * brightness,
    })
    scheduleTone(audioContext, pitch * 2.01, {
      startAt, duration: 0.78, level: 0.026 * brightness,
    })
    scheduleTone(audioContext, pitch * 3.92, {
      startAt, duration: 0.48, level: 0.012 * brightness,
    })
    scheduleTone(audioContext, pitch * 5.43, {
      startAt, duration: 0.27, level: 0.004 * brightness,
    })
  }

  // These four local recordings are optional. Keep their normal file playback,
  // but give each a Web Audio equivalent so missing files never mean silence.
  function playNoiseSweep(audioContext, {
    duration = 0.35, level = 0.06, startFrequency = 500,
    endFrequency = 2400, filterType = 'lowpass', q = 0.7,
  } = {}) {
    const startAt = audioContext.currentTime
    const source = audioContext.createBufferSource()
    const filter = audioContext.createBiquadFilter()
    const envelope = audioContext.createGain()
    source.buffer = makeNoiseBuffer(audioContext)
    source.loop = true
    filter.type = filterType
    filter.Q.setValueAtTime(q, startAt)
    filter.frequency.setValueAtTime(startFrequency, startAt)
    filter.frequency.exponentialRampToValueAtTime(endFrequency, startAt + duration * 0.75)
    envelope.gain.setValueAtTime(0.0001, startAt)
    envelope.gain.exponentialRampToValueAtTime(level, startAt + Math.min(0.04, duration * 0.2))
    envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
    source.connect(filter)
    filter.connect(envelope)
    envelope.connect(masterGain)
    source.onended = () => {
      activeSources.delete(source)
      source.disconnect()
      filter.disconnect()
      envelope.disconnect()
    }
    activeSources.add(source)
    source.start(startAt)
    source.stop(startAt + duration + 0.01)
    return source
  }

  function startFallbackLoop(name) {
    if (fallbackLoops.has(name)) return
    const interval = name === 'rattle' ? 112 : 145
    const tick = () => {
      if (!enabled || !context || context.state !== 'running') return
      if (name === 'rattle') {
        playWoodTap(context, {
          pitch: 145 + Math.random() * 100,
          level: 0.035 + Math.random() * 0.035,
        })
        if (Math.random() > 0.48) {
          window.setTimeout(() => {
            if (enabled && context?.state === 'running') {
              playWoodTap(context, { pitch: 170 + Math.random() * 90, level: 0.025 })
            }
          }, 28 + Math.random() * 35)
        }
      } else {
        playNoiseSweep(context, {
          duration: 0.055 + Math.random() * 0.09,
          level: 0.012 + Math.random() * 0.018,
          startFrequency: 650 + Math.random() * 850,
          endFrequency: 1200 + Math.random() * 1100,
          filterType: 'bandpass',
          q: 0.45,
        })
      }
    }
    tick()
    const timer = window.setInterval(tick, interval)
    fallbackLoops.set(name, timer)
    console.info(`[sound] synthesized fallback loop started: name=${name}; context=${context?.state}`)
  }

  function stopFallbackLoop(name) {
    const timer = fallbackLoops.get(name)
    if (timer === undefined) return
    window.clearInterval(timer)
    fallbackLoops.delete(name)
    console.info(`[sound] synthesized fallback loop stopped: name=${name}`)
  }

  async function playFallback(name, { loop = false, onEnded } = {}) {
    if (!enabled) return
    const audioContext = ensureContext()
    if (!audioContext || !(await resumeContext(audioContext)) || !enabled) return
    try {
      if (name === 'rattle' || name === 'fire') {
        if (loop) startFallbackLoop(name)
        else if (name === 'rattle') {
          playWoodTap(audioContext, { pitch: 165, level: 0.055 })
          playWoodTap(audioContext, { pitch: 218, delay: 0.09, level: 0.045 })
        } else playNoiseSweep(audioContext, { duration: 0.55, level: 0.035, startFrequency: 650, endFrequency: 1250, filterType: 'bandpass' })
        console.info(`[sound] synthesized file fallback scheduled: name=${name}; context=${audioContext.state}`)
        return
      }
      if (name === 'paperSlide') {
        const source = playNoiseSweep(audioContext, { duration: 0.38, level: 0.047, startFrequency: 420, endFrequency: 3200, filterType: 'bandpass', q: 0.55 })
        source.addEventListener('ended', onEnded, { once: true })
      } else if (name === 'ignition') {
        const source = playNoiseSweep(audioContext, { duration: 0.46, level: 0.085, startFrequency: 380, endFrequency: 2100, filterType: 'lowpass', q: 0.65 })
        playWoodTap(audioContext, { pitch: 92, level: 0.045 })
        source.addEventListener('ended', onEnded, { once: true })
      }
      console.info(`[sound] synthesized file fallback scheduled: name=${name}; context=${audioContext.state}`)
    } catch (error) {
      console.error(`[sound] synthesized file fallback failed: name=${name}; context=${audioContext.state}`, error)
      onEnded?.()
    }
  }

  async function playSynth(name) {
    if (!enabled) {
      console.info(`[sound] synthesized effect skipped: name=${name}; muted=true; context=${context?.state ?? 'not-created'}`)
      return
    }
    const audioContext = ensureContext()
    if (!audioContext || !(await resumeContext(audioContext)) || !enabled) return

    try {
      if (name === 'drawTap') {
        playWoodTap(audioContext, { pitch: 172, level: 0.12 })
      } else if (name === 'revealChime') {
        playBell(audioContext, 784, 0, 0.9)
      } else if (name === 'woodFish') {
        playWoodTap(audioContext, { pitch: 218, level: 0.13 })
      } else if (name === 'meritChime') {
        playBell(audioContext, 587.33, 0, 0.72)
        playBell(audioContext, 783.99, 0.13, 0.86)
        playBell(audioContext, 987.77, 0.27, 1)
      } else if (name === 'paperPlace') {
        playWoodTap(audioContext, { pitch: 285, level: 0.075 })
      } else if (name === 'taskComplete') {
        playWoodTap(audioContext, { pitch: 246.94, level: 0.095 })
        playWoodTap(audioContext, { pitch: 369.99, delay: 0.085, level: 0.065 })
      }
      console.info(`[sound] synthesized effect scheduled: name=${name}; context=${audioContext.state}; muted=${!enabled}`)
    } catch (error) {
      console.error(`[sound] synthesized effect failed: name=${name}; context=${audioContext.state}`, error)
    }
  }

  function scheduleUiClick(audioContext) {
    const now = performance.now()
    if (now - lastClickAt < 55) return
    lastClickAt = now

    const startAt = audioContext.currentTime
    const lowPass = audioContext.createBiquadFilter()
    const noiseEnvelope = audioContext.createGain()
    const noise = audioContext.createBufferSource()
    lowPass.type = 'lowpass'
    lowPass.frequency.setValueAtTime(980, startAt)
    noise.buffer = makeNoiseBuffer(audioContext)
    noiseEnvelope.gain.setValueAtTime(0.0001, startAt)
    noiseEnvelope.gain.exponentialRampToValueAtTime(0.032, startAt + 0.002)
    noiseEnvelope.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.038)
    noise.connect(lowPass)
    lowPass.connect(noiseEnvelope)
    noiseEnvelope.connect(masterGain)
    noise.onended = () => {
      activeSources.delete(noise)
      noise.disconnect()
      lowPass.disconnect()
      noiseEnvelope.disconnect()
    }
    activeSources.add(noise)
    noise.start(startAt)
    noise.stop(startAt + 0.045)

    const oscillator = audioContext.createOscillator()
    const toneEnvelope = audioContext.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(230, startAt)
    oscillator.frequency.exponentialRampToValueAtTime(175, startAt + 0.055)
    toneEnvelope.gain.setValueAtTime(0.0001, startAt)
    toneEnvelope.gain.exponentialRampToValueAtTime(0.095, startAt + 0.003)
    toneEnvelope.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.07)
    oscillator.connect(toneEnvelope)
    toneEnvelope.connect(masterGain)
    oscillator.onended = () => {
      activeSources.delete(oscillator)
      oscillator.disconnect()
      toneEnvelope.disconnect()
    }
    activeSources.add(oscillator)
    oscillator.start(startAt)
    oscillator.stop(startAt + 0.075)

    const overtone = audioContext.createOscillator()
    const overtoneEnvelope = audioContext.createGain()
    overtone.type = 'triangle'
    overtone.frequency.setValueAtTime(460, startAt)
    overtoneEnvelope.gain.setValueAtTime(0.0001, startAt)
    overtoneEnvelope.gain.exponentialRampToValueAtTime(0.022, startAt + 0.002)
    overtoneEnvelope.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.042)
    overtone.connect(overtoneEnvelope)
    overtoneEnvelope.connect(masterGain)
    overtone.onended = () => {
      activeSources.delete(overtone)
      overtone.disconnect()
      overtoneEnvelope.disconnect()
    }
    activeSources.add(overtone)
    overtone.start(startAt)
    overtone.stop(startAt + 0.047)
    console.info(`[sound] UI wooden click scheduled: context=${audioContext.state}; muted=false; duration=75ms`)
  }

  function playClick() {
    if (!enabled) {
      console.info(`[sound] UI click skipped: muted=true; context=${context?.state ?? 'not-created'}`)
      return
    }
    const audioContext = ensureContext()
    if (!audioContext) return
    if (audioContext.state === 'running') {
      try {
        scheduleUiClick(audioContext)
      } catch (error) {
        console.error('[sound] UI wooden click failed', error)
      }
      return
    }

    void resumeContext(audioContext).then((resumed) => {
      if (!resumed || !enabled) return
      try {
        scheduleUiClick(audioContext)
      } catch (error) {
        console.error('[sound] UI wooden click failed after resume', error)
      }
    })
  }

  function getPlayer(name) {
    const track = fileTracks[name]
    if (!track || typeof Audio === 'undefined') return null
    if (!players.has(name)) {
      const player = new Audio(track.src)
      player.preload = 'auto'
      player.volume = track.volume
      players.set(name, player)
    }
    return players.get(name)
  }

  function cancelFade(name) {
    const frame = fades.get(name)
    if (frame) window.cancelAnimationFrame(frame)
    fades.delete(name)
  }

  function playFile(name, { loop = false, onEnded, onError } = {}) {
    console.info(`[sound] file effect requested: name=${name}; muted=${!enabled}; context=${context?.state ?? 'not-created'}`)
    if (name === 'nezha') setVoiceActive(false)
    const player = getPlayer(name)
    if (!player) {
      const error = new Error(`Audio player unavailable for ${name}`)
      if (name !== 'nezha' && fileTracks[name]) void playFallback(name, { loop, onEnded })
      else if (onError) onError(error)
      else onEnded?.()
      return
    }

    const generation = (playerGenerations.get(name) ?? 0) + 1
    playerGenerations.set(name, generation)
    cancelFade(name)
    player.pause()
    try { player.currentTime = 0 } catch { /* Media metadata may not be loaded yet. */ }
    player.loop = loop
    player.volume = trackVolume(name)
    if (name === 'nezha') setVoiceActive(true)

    let continued = false
    const continueOnce = (outcome, error) => {
      if (continued || playerGenerations.get(name) !== generation) return
      continued = true
      player.onended = null
      player.onerror = null
      if (name === 'nezha') {
        activeVoiceErrorHandler = null
        setVoiceActive(false)
      }
      if (outcome === 'ended') onEnded?.()
      else {
        console.warn(`[sound] using synthesized fallback after file failure: name=${name}`, error)
        if (name !== 'nezha') void playFallback(name, { loop, onEnded })
        else if (onError) onError(error)
        else onEnded?.()
      }
    }

    if (name === 'nezha') activeVoiceErrorHandler = (error) => continueOnce('error', error)
    player.onended = loop ? null : () => continueOnce('ended')
    player.onerror = () => continueOnce('error', new Error(`Audio playback error for ${name}`))
    try {
      const playback = player.play()
      playback?.catch((error) => {
        console.warn(`[sound] file playback failed: name=${name}; src=${fileTracks[name].src}`, error)
        continueOnce('error', error)
      })
    } catch (error) {
      console.warn(`[sound] file playback failed: name=${name}; src=${fileTracks[name].src}`, error)
      continueOnce('error', error)
    }
  }

  function play(name, options = {}) {
    if (!enabled) {
      console.info(`[sound] effect skipped: name=${name}; muted=true; context=${context?.state ?? 'not-created'}`)
      return
    }
    if (name === 'drawTap' || name === 'revealChime' || name === 'woodFish' ||
      name === 'meritChime' || name === 'paperPlace' || name === 'taskComplete') {
      void playSynth(name)
      return
    }
    playFile(name, options)
  }

  function stop(name, fadeMs = 0) {
    stopFallbackLoop(name)
    const player = players.get(name)
    if (!player) {
      playerGenerations.set(name, (playerGenerations.get(name) ?? 0) + 1)
      if (name === 'nezha') setVoiceActive(false)
      return
    }
    cancelFade(name)

    if (name === 'nezha') {
      const onVoiceStopped = activeVoiceErrorHandler
      activeVoiceErrorHandler = null
      player.pause()
      player.loop = false
      player.onended = null
      player.onerror = null
      player.volume = trackVolume(name)
      setVoiceActive(false)
      try { player.currentTime = 0 } catch { /* No-op if metadata is unavailable. */ }
      onVoiceStopped?.(new Error('Nezha voice playback stopped before ending'))
      playerGenerations.set(name, (playerGenerations.get(name) ?? 0) + 1)
      return
    }

    playerGenerations.set(name, (playerGenerations.get(name) ?? 0) + 1)

    if (!fadeMs || player.paused) {
      player.pause()
      player.loop = false
      player.onended = null
      player.onerror = null
      player.volume = trackVolume(name)
      try { player.currentTime = 0 } catch { /* No-op if metadata is unavailable. */ }
      return
    }

    const initialVolume = player.volume
    const startedAt = performance.now()
    const fadeFrame = (now) => {
      const progress = Math.min(1, (now - startedAt) / fadeMs)
      player.volume = initialVolume * (1 - progress)
      if (progress >= 1 || !enabled) {
        player.pause()
        player.loop = false
        player.volume = trackVolume(name)
        try { player.currentTime = 0 } catch { /* No-op if metadata is unavailable. */ }
        fades.delete(name)
        return
      }
      fades.set(name, window.requestAnimationFrame(fadeFrame))
    }
    fades.set(name, window.requestAnimationFrame(fadeFrame))
  }

  function stopSynths() {
    if (!context) return
    const stopAt = context.currentTime + 0.015
    for (const source of activeSources) {
      try { source.stop(stopAt) } catch { /* A source may already be stopping. */ }
    }
    activeSources.clear()
  }

  function stopAll() {
    for (const name of [...fallbackLoops.keys()]) stopFallbackLoop(name)
    for (const name of players.keys()) stop(name)
    stopSynths()
  }

  function setEnabled(value) {
    enabled = value
    console.info(`[sound] mute state changed: muted=${!enabled}; context=${context?.state ?? 'not-created'}`)
    if (enabled && context && masterGain) {
      const activeContext = context
      const activeMasterGain = masterGain
      void resumeContext(activeContext).then((resumed) => {
        if (!resumed || !enabled || context !== activeContext) return
        activeMasterGain.gain.cancelScheduledValues(activeContext.currentTime)
        activeMasterGain.gain.setTargetAtTime(0.32, activeContext.currentTime, 0.015)
      })
    } else if (!enabled) {
      stopAll()
      if (context && masterGain && context.state !== 'closed') {
        masterGain.gain.cancelScheduledValues(context.currentTime)
        masterGain.gain.setTargetAtTime(0, context.currentTime, 0.006)
      }
    }
  }

  return {
    play,
    playClick,
    stop,
    stopAll,
    setEnabled,
    destroy() {
      stopAll()
      for (const player of players.values()) {
        player.removeAttribute('src')
        player.load()
      }
      players.clear()
      playerGenerations.clear()
      for (const timer of fallbackLoops.values()) window.clearInterval(timer)
      fallbackLoops.clear()
      if (context && context.state !== 'closed') context.close().catch(() => {})
      context = null
      masterGain = null
      noiseBuffer = null
    },
  }
}
