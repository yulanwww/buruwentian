import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createSoundController, readSoundPreference, SOUND_PREFERENCE_KEY } from './soundEffects'
import './App.css'

const STORAGE_KEY = 'buru-wentian-state-v1'
const starterTasks = [
  { id: 'starter-1', text: '喝一杯温水', done: false },
  { id: 'starter-2', text: '整理一下桌面', done: false },
  { id: 'starter-3', text: '给重要的人发个消息', done: false },
]
const fortunes = [
  { name: '上上签', note: '心有所向，慢慢来也是一种勇敢。' },
  { name: '上签', note: '今日有光，先做好眼前这一件小事。' },
  { name: '中吉签', note: '不必事事圆满，开始就是好兆头。' },
  { name: '顺意签', note: '轻装前行，答案会在路上出现。' },
  { name: '福气签', note: '善意有回响，今天也记得对自己好一点。' },
]

function readSavedState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return { tasks: starterTasks, merit: 0, error: '' }

    const parsed = JSON.parse(saved)
    if (
      !Array.isArray(parsed.tasks) ||
      !Number.isInteger(parsed.merit) ||
      parsed.merit < 0
    ) {
      return {
        tasks: starterTasks,
        merit: 0,
        error: '本地记录无法识别，已为你准备新的签筒。',
      }
    }

    const tasks = parsed.tasks.filter(
      (task) =>
        task &&
        typeof task.id === 'string' &&
        typeof task.text === 'string' &&
        typeof task.done === 'boolean',
    )
    return { tasks, merit: parsed.merit, error: '' }
  } catch {
    return {
      tasks: starterTasks,
      merit: 0,
      error: '暂时无法读取本地记录，当前进度可能无法保留。',
    }
  }
}

function BurningFlameCurtain({ isFading }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d', { alpha: true })
    if (!canvas || !context) return undefined

    const sprite = new Image()
    sprite.src = '/bamboo-fire-sprite.png'
    let frameId = 0
    let startTime = 0
    let lastFrameTime = 0
    let width = 0
    let height = 0
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.25)

    function resize() {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.ceil(width * pixelRatio)
      canvas.height = Math.ceil(height * pixelRatio)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }

    function animate(now) {
      frameId = window.requestAnimationFrame(animate)
      if (now - lastFrameTime < 40 || !sprite.complete || !sprite.naturalWidth) return
      lastFrameTime = now
      if (!startTime) startTime = now

      const elapsed = now - startTime
      const cellWidth = sprite.naturalWidth / 4
      const cellHeight = sprite.naturalHeight / 4
      const count = Math.ceil(width / 115) + 2
      const spacing = width / (count - 1)
      const fade = elapsed < 3150 ? 1 : Math.max(0, 1 - (elapsed - 3150) / 350)

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      context.clearRect(0, 0, width, height)
      context.globalCompositeOperation = 'screen'

      for (let index = 0; index < count; index += 1) {
        const x = (index - 0.5) * spacing
        const distanceFromIgnition = Math.abs(x - width / 2) / Math.max(width / 2, 1)
        const seed = (index * 73) % 127
        const ignitionAt = 440 + distanceFromIgnition * 720 + seed - 63
        const localProgress = (elapsed - ignitionAt) / 1260
        if (localProgress < 0) continue

        const growth = Math.min(1, localProgress * localProgress * (3 - 2 * localProgress))
        const flicker = Math.sin(elapsed * 0.019 + index * 2.13) * 0.055
        const flameHeight = height * (0.12 + growth * 0.78) * (0.93 + ((seed % 17) / 100) + flicker)
        const flameWidth = flameHeight * (0.62 + ((seed % 9) / 100))
        const sway = Math.sin(elapsed * 0.006 + index * 1.7) * Math.min(18, spacing * 0.12)
        const baseline = height * (0.91 + ((seed % 7) / 200))
        const frame = (Math.floor(elapsed / 72) + index * 3) % 16
        const alpha = Math.min(1, localProgress * 3.5) * fade

        context.globalAlpha = alpha
        context.drawImage(
          sprite,
          (frame % 4) * cellWidth,
          Math.floor(frame / 4) * cellHeight,
          cellWidth,
          cellHeight,
          x - flameWidth / 2 + sway,
          baseline - flameHeight,
          flameWidth,
          flameHeight,
        )
      }

      context.globalAlpha = 1
      context.globalCompositeOperation = 'source-over'
    }

    resize()
    window.addEventListener('resize', resize)
    sprite.onload = () => { startTime = performance.now() }
    frameId = window.requestAnimationFrame(animate)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('resize', resize)
      sprite.onload = null
    }
  }, [])

  return createPortal(<canvas ref={canvasRef} className={`burn-fire-canvas${isFading ? ' is-fading' : ''}`} aria-hidden="true" />, document.body)
}

function App() {
  const [appState, setAppState] = useState(readSavedState)
  const { tasks, merit } = appState
  const [soundEnabled, setSoundEnabled] = useState(readSoundPreference)
  const soundEnabledRef = useRef(soundEnabled)
  const [soundController] = useState(() => {
    const controller = createSoundController()
    controller.setEnabled(soundEnabled)
    return controller
  })
  const tasksRef = useRef(tasks)
  const appStateRef = useRef(appState)
  const [taskInput, setTaskInput] = useState('')
  const [drawn, setDrawn] = useState(null)
  const [isShaking, setIsShaking] = useState(false)
  const [isBurning, setIsBurning] = useState(false)
  const [isBurnFading, setIsBurnFading] = useState(false)
  const [isRewarding, setIsRewarding] = useState(false)
  const [showMeritReward, setShowMeritReward] = useState(false)
  const [isMeritRewardFlying, setIsMeritRewardFlying] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [storageError, setStorageError] = useState(appState.error)
  const drawTimer = useRef(null)
  const burnTimer = useRef(null)
  const burnExitTimer = useRef(null)
  const rewardTimer = useRef(null)
  const burnFadeTimer = useRef(null)
  const drawingLock = useRef(false)
  const burnAudioActive = useRef(false)
  const burnVoice = useRef({ id: null, status: 'idle', visualComplete: false })
  const resolvedDraws = useRef(new Set())
  const pendingTasks = tasks.filter((task) => !task.done)
  const completedTasks = tasks.filter((task) => task.done)

  function commitState(nextState) {
    setAppState(nextState)
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ tasks: nextState.tasks, merit: nextState.merit }),
      )
      setStorageError('')
    } catch {
      setStorageError('无法保存本地记录，请检查浏览器存储设置。')
    }
  }

  useEffect(
    () => () => {
      window.clearTimeout(drawTimer.current)
      window.clearTimeout(burnTimer.current)
      window.clearTimeout(burnExitTimer.current)
      window.clearTimeout(rewardTimer.current)
      window.clearTimeout(burnFadeTimer.current)
      burnAudioActive.current = false
      burnVoice.current = { id: null, status: 'disposed', visualComplete: false }
      soundController.destroy()
    },
    [soundController],
  )

  useEffect(() => {
    tasksRef.current = tasks
    appStateRef.current = appState
  }, [tasks, appState])

  useEffect(() => {
    document.documentElement.classList.toggle('ritual-active', isBurning)
    return () => document.documentElement.classList.remove('ritual-active')
  }, [isBurning])

  useEffect(() => {
    function stopSoundsWhenHidden() {
      if (!document.hidden) return
      burnAudioActive.current = false
      soundController.stopAll()
    }

    document.addEventListener('visibilitychange', stopSoundsWhenHidden)
    return () => document.removeEventListener('visibilitychange', stopSoundsWhenHidden)
  }, [soundController])

  function drawFortune() {
    if (drawingLock.current || isShaking || isBurning || isRewarding || drawn) return
    if (pendingTasks.length === 0) {
      setAnnouncement('签筒里暂时没有待办啦，添加一件小事再来求签吧。')
      return
    }

    drawingLock.current = true
    setDrawn(null)
    setAnnouncement('')
    setIsShaking(true)
    setIsBurning(false)
    soundController.play('drawTap')
    soundController.play('rattle', { loop: true })
    drawTimer.current = window.setTimeout(() => {
      soundController.stop('rattle', 80)
      const currentPending = tasksRef.current.filter((task) => !task.done)
      if (currentPending.length === 0) {
        setIsShaking(false)
        drawingLock.current = false
        setAnnouncement('签筒里暂时没有待办啦，添加一件小事再来求签吧。')
        return
      }
      const task = currentPending[Math.floor(Math.random() * currentPending.length)]
      const fortune = fortunes[Math.floor(Math.random() * fortunes.length)]
      setDrawn({ id: `${Date.now()}-${Math.random()}`, taskId: task.id, taskText: task.text, fortune })
      setIsShaking(false)
      drawingLock.current = false
      soundController.play('paperSlide', {
        onEnded: () => soundController.play('revealChime'),
      })
    }, 900)
  }

  function acceptFortune() {
    if (!drawn || drawingLock.current || resolvedDraws.current.has(drawn.id)) return
    drawingLock.current = true
    resolvedDraws.current.add(drawn.id)
    soundController.play('woodFish')
    soundController.play('meritChime')
    commitState({
      tasks: tasks.map((task) => task.id === drawn.taskId ? { ...task, done: true } : task),
      merit: merit + 3226,
    })
    setIsRewarding(true)
    setAnnouncement('')
    setShowMeritReward(true)
    setIsMeritRewardFlying(false)
    rewardTimer.current = window.setTimeout(() => {
      setIsRewarding(false)
      setDrawn(null)
      drawingLock.current = false
      setAnnouncement('')
      setIsMeritRewardFlying(true)
      rewardTimer.current = window.setTimeout(() => {
        setShowMeritReward(false)
        setIsMeritRewardFlying(false)
      }, 700)
    }, 1500)
  }

  function rejectFortune() {
    if (!drawn || drawingLock.current || isBurning || resolvedDraws.current.has(drawn.id)) return
    drawingLock.current = true
    resolvedDraws.current.add(drawn.id)
    setIsBurning(true)
    setIsBurnFading(false)
    const burnDuration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 900 : 3500
    burnAudioActive.current = true
    const burnId = drawn.id
    burnVoice.current = {
      id: burnId,
      status: soundEnabledRef.current ? 'playing' : 'failed',
      visualComplete: false,
    }
    function beginBurnFade(delay = 0) {
      window.clearTimeout(burnFadeTimer.current)
      burnFadeTimer.current = window.setTimeout(() => {
        if (burnVoice.current.id !== burnId) return
        setIsBurnFading(true)
        burnExitTimer.current = window.setTimeout(() => {
          if (burnVoice.current.id !== burnId) return
          setAnnouncement('我命由我不由天！')
          setDrawn(null)
          setIsBurning(false)
          setIsBurnFading(false)
          drawingLock.current = false
          burnVoice.current = { id: null, status: 'idle', visualComplete: false }
        }, 500)
      }, delay)
    }
    soundController.play('nezha', {
      onEnded: () => {
        if (burnVoice.current.id !== burnId) return
        console.info('[burn] Nezha voice ended naturally')
        burnVoice.current.status = 'ended'
        if (burnVoice.current.visualComplete) beginBurnFade(500)
      },
      onError: (error) => {
        if (burnVoice.current.id !== burnId) return
        console.warn('[burn] Nezha voice unavailable; using the original burn duration', error)
        burnVoice.current.status = 'failed'
        if (burnVoice.current.visualComplete) beginBurnFade()
      },
    })
    if (!soundEnabledRef.current) console.info('[burn] muted; using the original burn duration')
    soundController.play('ignition', {
      onEnded: () => {
        if (burnAudioActive.current) {
          soundController.play('fire', { loop: true })
        }
      },
    })
    burnTimer.current = window.setTimeout(() => {
      burnAudioActive.current = false
      soundController.stop('ignition', 100)
      soundController.stop('fire', 100)
      burnVoice.current.visualComplete = true
      console.info(`[burn] visual animation complete; voice=${burnVoice.current.status}`)
      const latestState = appStateRef.current
      commitState({
        ...latestState,
        tasks: latestState.tasks.filter((task) => task.id !== drawn.taskId),
      })
      if (burnVoice.current.status === 'ended') beginBurnFade(500)
      else if (burnVoice.current.status === 'failed') beginBurnFade()
    }, burnDuration)
  }

  function addTask(event) {
    event.preventDefault()
    const text = taskInput.trim()
    if (!text) return

    commitState({
      ...appState,
      tasks: [
        ...tasks,
        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text, done: false },
      ],
    })
    soundController.play('paperPlace')
    setTaskInput('')
    setAnnouncement(`已添入待办：${text}`)
  }

  function toggleTask(taskId) {
    const task = tasks.find((item) => item.id === taskId)
    if (task && !task.done) soundController.play('taskComplete')
    commitState({
      ...appState,
      tasks: tasks.map((task) =>
        task.id === taskId ? { ...task, done: !task.done } : task,
      ),
    })
    if (drawn?.taskId === taskId) {
      setDrawn(null)
      setIsBurning(false)
      setIsRewarding(false)
      drawingLock.current = false
    }
  }

  function toggleSound() {
    const nextEnabled = !soundEnabledRef.current
    soundEnabledRef.current = nextEnabled
    setSoundEnabled(nextEnabled)
    soundController.setEnabled(nextEnabled)
    try {
      localStorage.setItem(SOUND_PREFERENCE_KEY, String(nextEnabled))
      console.info(`[sound] preference saved: muted=${!nextEnabled}`)
    } catch {
      console.warn('[sound] could not save mute preference; session setting remains active')
      // The toggle still works for this session when storage is unavailable.
    }
    if (nextEnabled) soundController.playClick()
  }

  function playButtonClick(event) {
    const target = event.target instanceof Element ? event.target : null
    if (!target || target.closest('.sound-toggle')) {
      if (target?.closest('.sound-toggle')) console.info('[sound] click event captured: speaker toggle')
      return
    }

    const control = target.closest('button, input[type="checkbox"], label')
    if (!control) {
      console.debug('[sound] click event ignored: no supported control found')
      return
    }
    const controlName = control.getAttribute('aria-label') || control.textContent.trim().replace(/\s+/g, ' ') || control.tagName
    if (control.disabled || control.getAttribute('aria-disabled') === 'true' ||
      (control.matches('label') && control.querySelector('input:disabled'))) {
      console.info(`[sound] click event ignored: disabled control=${controlName}`)
      return
    }

    console.info(`[sound] click event captured: control=${controlName}; enabled=${soundEnabledRef.current}`)
    soundController.playClick()
  }

  function removeTask(taskId) {
    commitState({
      ...appState,
      tasks: tasks.filter((task) => task.id !== taskId),
    })
    if (drawn?.taskId === taskId) {
      setDrawn(null)
      setIsBurning(false)
      setIsRewarding(false)
      drawingLock.current = false
    }
  }

  function clearCompletedTasks() {
    if (completedTasks.length === 0 || isBurning || isRewarding) return

    const completedTaskIds = new Set(completedTasks.map((task) => task.id))
    commitState({ ...appState, tasks: tasks.filter((task) => !task.done) })
    if (drawn && completedTaskIds.has(drawn.taskId)) {
      setDrawn(null)
      drawingLock.current = false
    }
  }

  const fortuneCard = drawn && (
    <article
      className={`fortune-card${isBurning ? ' is-burning' : ''}${isRewarding ? ' is-rewarding' : ''}`}
      aria-label={`${drawn.fortune.name}：${drawn.taskText}`}
    >
      <div className="fortune-paper">
        <span className="fortune-slip-kicker">天命签文</span>
        <span className="fortune-seal">{drawn.fortune.name}</span>
        <span className="fortune-number" aria-hidden="true" style={{ visibility: 'hidden' }}>
          第 {String(fortunes.indexOf(drawn.fortune) + 1).padStart(2, '0')} 签
        </span>
        <span className="fortune-slip-rule" aria-hidden="true">✧</span>
        <span className="fortune-task-label">所求之事</span>
        <strong>{drawn.taskText}</strong>
        <span className="fortune-slip-footer">心诚则灵</span>
        {isBurning && <>
          <span className="burning-char" aria-hidden="true" />
        </>}
      </div>
      {isBurning && <>
        <svg className="burn-smoke" viewBox="0 0 300 700" aria-hidden="true">
          <defs>
            <linearGradient id="smoke-tone" x1="0" y1="1" x2="0.2" y2="0">
              <stop offset="0" stopColor="#4c3026" stopOpacity="0.5" />
              <stop offset="1" stopColor="#9a8068" stopOpacity="0" />
            </linearGradient>
            <filter id="smoke-turbulence" x="-30%" y="-20%" width="160%" height="150%">
              <feTurbulence type="fractalNoise" baseFrequency="0.018 0.035" numOctaves="2" seed="8" result="smokeNoise">
                <animate attributeName="baseFrequency" values="0.018 0.035;0.028 0.045;0.018 0.035" dur="1.8s" repeatCount="indefinite" />
              </feTurbulence>
              <feDisplacementMap in="SourceGraphic" in2="smokeNoise" scale="28" />
              <feGaussianBlur stdDeviation="7" />
            </filter>
          </defs>
          <path d="M126 690 C83 623 109 579 77 529 C42 475 103 431 79 378 C54 318 103 283 91 225 C81 169 121 115 143 51 C140 139 170 179 139 235 C177 291 128 333 158 391 C188 447 133 488 175 542 C207 600 169 648 179 700 Z" fill="url(#smoke-tone)" filter="url(#smoke-turbulence)" />
          <path d="M178 696 C216 635 192 590 223 538 C258 480 199 440 226 382 C253 323 202 286 216 228 C229 171 191 116 164 54 C168 144 139 179 168 238 C131 293 179 338 150 396 C122 450 177 494 137 549 C108 603 143 650 131 699 Z" fill="url(#smoke-tone)" filter="url(#smoke-turbulence)" />
        </svg>
        <div className="burn-fragments" aria-hidden="true">
          {Array.from({ length: 36 }, (_, index) => (
            <i
              className={`burn-fragment fragment-${index % 4}`}
              key={index}
              style={{
                '--fragment-x': `${((index * 53) % 161) - 80}px`,
                '--fragment-y': `${-30 - ((index * 31) % 130)}px`,
                '--fragment-size': `${5 + (index % 7)}px`,
                '--fragment-delay': `${2.65 + (index % 8) * 0.01}s`,
                '--fragment-turn': `${(index * 47) % 280 - 140}deg`,
                '--fragment-float': `${55 + (index * 19) % 90}px`,
              }}
            />
          ))}
        </div>
      </>}
    </article>
  )

  return (
    <>
    <main className={`app-shell${isBurning ? ' is-burning' : ''}${isBurnFading ? ' is-burn-fading' : ''}`} onClickCapture={playButtonClick}>
      <header className="top-bar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">☁</span>
          <div>
            <p className="eyebrow">今日宜求签</p>
            <h1>不如问天</h1>
          </div>
        </div>
        <div className="top-actions">
          <div className="merit-pill" aria-label={`功德 ${merit}`}>
            <span className="merit-icon" aria-hidden="true">✦</span>
            <span>功德</span>
            <strong>{merit}</strong>
          </div>
          <button
            className="sound-toggle"
            type="button"
            onClick={toggleSound}
            aria-label={soundEnabled ? '关闭音效' : '开启音效'}
            aria-pressed={soundEnabled}
            title={soundEnabled ? '关闭音效' : '开启音效'}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 10v4h4l5 4V6l-5 4H4Z" />
              {soundEnabled
                ? <><path d="M16 9a5 5 0 0 1 0 6" /><path d="M18.5 6.5a8.5 8.5 0 0 1 0 11" /></>
                : <><path d="m16 9 5 6" /><path d="m21 9-5 6" /></>}
            </svg>
          </button>
        </div>
      </header>

      <section className="shrine" aria-label="木制求签筒">
        <div className="shrine-sparkle sparkle-one" aria-hidden="true">✦</div>
        <div className="shrine-sparkle sparkle-two" aria-hidden="true">✧</div>
        <div className="shrine-cloud cloud-left" aria-hidden="true">☁</div>
        <div className="shrine-cloud cloud-right" aria-hidden="true">☁</div>
        <p className={`shrine-caption${drawn ? ' is-hidden' : ''}`}>心诚则灵 · 签随心动</p>

        <div className={`fortune-stage${isShaking ? ' is-shaking' : ''}${drawn ? ' has-drawing' : ''}`}>
          <div className="fortune-sticks" aria-hidden="true">
            {Array.from({ length: 3 }, (_, index) => (
              <span
                className={`stick stick-${index + 1}`}
                key={index}
                style={{
                  
                  '--stick-height': `${83 + index * 7}px`,
                  '--stick-angle': `${(index - 1) * 10}deg`,
                  '--stick-left': `${30 + index * 20}%`,
                }}
              />
            ))}
          </div>
          <div className="box-mouth" aria-hidden="true">
            <span className="mouth-shine" />
          </div>
          <div className="box-body">
            <div className="box-front">
              <div className="box-corner corner-left" />
              <div className="box-corner corner-right" />
              <div className="box-plaque">
                <span className="plaque-knot" aria-hidden="true">❀</span>
                <span className="plaque-text" aria-label="有求必应">
                  <span>有</span>
                  <span>求</span>
                  <span>必</span>
                  <span>应</span>
                </span>
                <span className="plaque-knot" aria-hidden="true">❀</span>
              </div>
              <div className="box-grain grain-one" />
              <div className="box-grain grain-two" />
            </div>
            <div className="box-foot foot-left" />
            <div className="box-foot foot-right" />
          </div>
          <div className="box-shadow" aria-hidden="true" />

          {drawn && !isBurning && fortuneCard}
          {isShaking && <span className="rising-stick" aria-hidden="true" />}
        </div>

        <p className="draw-hint" aria-live="polite">
          {drawn ? '这支签，今日想请你完成' : '摇一摇签筒，让今天有个小小的好开始'}
        </p>
      </section>

      <button
        className="draw-button"
        type="button"
        onClick={drawFortune}
        disabled={isShaking || isBurning || isRewarding || Boolean(drawn)}
      >
        <span className="button-sparkle" aria-hidden="true">✦</span>
          {isShaking ? '正在问天…' : drawn ? '天命已现' : '求签问天'}
        <span className="button-sparkle" aria-hidden="true">✦</span>
      </button>

      {drawn && (
        <div className="decision-actions">
          <button type="button" className="accept-button" onClick={acceptFortune} disabled={isBurning || isRewarding}>
            顺天命
          </button>
          <button
            type="button"
            className="reject-button"
            onClick={rejectFortune}
            disabled={isBurning || isRewarding}
          >
            {isBurning ? '焚签中…' : '逆天命'}
          </button>
        </div>
      )}
      <section className="todo-panel" aria-labelledby="todo-heading">
        <div className="todo-heading-row">
          <div>
            <p className="section-kicker">把心愿放进签筒</p>
            <h2 id="todo-heading">今日小事 <span>{pendingTasks.length}</span></h2>
          </div>
          <div className="todo-heading-tools">
            <button
              className="clear-completed-button"
              type="button"
              onClick={clearCompletedTasks}
              disabled={completedTasks.length === 0 || isBurning || isRewarding}
            >
              清空已办
            </button>
            <span className="todo-flower" aria-hidden="true">✿</span>
          </div>
        </div>

        <form className="add-task-form" onSubmit={addTask}>
          <label className="visually-hidden" htmlFor="task-input">添加一件小事</label>
          <input
            id="task-input"
            type="text"
            maxLength={48}
            placeholder="写下一件想完成的小事…"
            value={taskInput}
            onChange={(event) => setTaskInput(event.target.value)}
          />
          <button type="submit" aria-label="添加待办">+</button>
        </form>

        <ul className="task-list">
          {tasks.map((task) => (
            <li className={`task-item${task.done ? ' is-done' : ''}`} key={task.id}>
              <label>
                <input
                  type="checkbox"
                  checked={task.done}
                  disabled={isBurning && drawn?.taskId === task.id}
                  onChange={() => toggleTask(task.id)}
                />
                <span className="custom-check" aria-hidden="true">{task.done ? '✓' : ''}</span>
                <span className="task-text">{task.text}</span>
              </label>
              <button
                type="button"
                className="remove-task"
                aria-label={`删除待办：${task.text}`}
                disabled={isBurning && drawn?.taskId === task.id}
                onClick={() => removeTask(task.id)}
              >
                ×
              </button>
            </li>
          ))}
          {tasks.length === 0 && (
            <li className="empty-tasks">今天没有待办，添一件轻松的小事吧。</li>
          )}
        </ul>
        <p className="task-footnote" aria-live="polite">
          {storageError || announcement || '一步一签，完成一件小事就很棒'}
        </p>
      </section>

      <footer className="app-footer">愿你所行皆坦途 · 所念皆如愿</footer>
    </main>
    {isBurning && <BurningFlameCurtain isFading={isBurnFading} />}
    {isBurning && fortuneCard && createPortal(fortuneCard, document.body)}
    {showMeritReward && createPortal(
      <div className="merit-reward-overlay">
        <div className={`merit-reward${isMeritRewardFlying ? ' is-flying' : ''}`} role="status" aria-live="polite">
          <span className="merit-reward-spark spark-a" aria-hidden="true">✦</span>
          <span className="merit-reward-spark spark-b" aria-hidden="true">✧</span>
          <span className="merit-reward-spark spark-c" aria-hidden="true">✦</span>
          <span className="merit-reward-spark spark-d" aria-hidden="true">✧</span>
          <strong>+3226 功德</strong>
        </div>
      </div>,
      document.body,
    )}
    </>
  )
}

export default App
