import { useEffect, useRef, useState } from 'react'
import type { PetState } from '../../types'
import './Pet.css'

interface PetProps {
  state: PetState
  panelOpen: boolean
  onClick: () => void
  reminder?: { id: number; title: string } | null
  onReminderClick?: () => void
}

const GREETINGS = [
  '嗨，需要帮忙吗？',
  '想到什么就问我～',
  '今天代码顺利吗？',
  '我在待机，随时叫我。',
  '有 bug 就拿来吧！',
  '我掐指一算，你需要我。',
  '在呢在呢～',
  '要不要听个冷笑话？',
  '盯屏幕久了，看看远处吧。',
  '咖啡还是茶？代码都得写。',
  '今天准备开发什么？',
  '喝杯咖啡，继续写代码？'
]

export default function Pet({ state, panelOpen, onClick, reminder, onReminderClick }: PetProps) {
  const [greeting, setGreeting] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{
    startX: number
    startY: number
    lastX: number
    lastY: number
    moved: boolean
  } | null>(null)
  const onClickRef = useRef(onClick)
  onClickRef.current = onClick

  // 手动拖动 + 点击判定（不用 -webkit-app-region: drag，
  // 它在 Windows 上会拦截鼠标事件导致点击无响应）
  useEffect(() => {
    const onMove = (e: MouseEvent): void => {
      const d = dragRef.current
      if (!d) return
      if (!d.moved && Math.hypot(e.screenX - d.startX, e.screenY - d.startY) > 4) {
        d.moved = true
        setDragging(true) // 触发「被抓起」倾斜姿态
      }
      if (d.moved) {
        const dx = e.screenX - d.lastX
        const dy = e.screenY - d.lastY
        d.lastX = e.screenX
        d.lastY = e.screenY
        if (dx !== 0 || dy !== 0) window.desktopAI.moveBy(dx, dy)
      }
    }
    const onUp = (): void => {
      const d = dragRef.current
      dragRef.current = null
      setDragging(false)
      // 按下后没有拖动 → 视为点击（切换聊天面板）
      if (d && !d.moved) onClickRef.current()
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [])

  const handleMouseDown = (e: React.MouseEvent): void => {
    if (e.button !== 0) return // 只处理左键（右键留给退出菜单）
    dragRef.current = {
      startX: e.screenX,
      startY: e.screenY,
      lastX: e.screenX,
      lastY: e.screenY,
      moved: false
    }
  }

  // 待机且面板收起时，偶尔冒出一句问候
  useEffect(() => {
    if (panelOpen) {
      setGreeting(null)
      return
    }
    let hideTimer: number | undefined
    let showTimer: number | undefined
    const schedule = (delay: number): void => {
      showTimer = window.setTimeout(() => {
        setGreeting(GREETINGS[Math.floor(Math.random() * GREETINGS.length)])
        hideTimer = window.setTimeout(() => {
          setGreeting(null)
          schedule(30000 + Math.random() * 30000)
        }, 4500)
      }, delay)
    }
    schedule(12000 + Math.random() * 18000)
    return () => {
      clearTimeout(showTimer)
      if (hideTimer) clearTimeout(hideTimer)
    }
  }, [panelOpen])

  return (
    <div
      className={`pet-wrap${dragging ? ' dragging' : ''}`}
      data-state={state}
      data-reminder={reminder ? 'on' : undefined}
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => {
        e.preventDefault()
        window.desktopAI.showContextMenu()
      }}
      title="TRAE 宝（单击对话，拖动移动，右键退出）"
    >
      {/* 到期待办提醒气泡（优先于问候，可点击直达待办列表） */}
      {reminder && (
        <button
          className="reminder-bubble"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onReminderClick?.()
          }}
          title="点击查看待办"
        >
          ⏰ {reminder.title}
        </button>
      )}
      {greeting && !panelOpen && !reminder && <div className="greeting-bubble">{greeting}</div>}
      <div className="pet-float">
        <div className="pet-scale">
          <svg className="pet-svg" viewBox="0 0 200 240" aria-label="TRAE 宝">
            {/* 天线 */}
            <line x1="100" y1="12" x2="100" y2="32" stroke="#3D4A44" strokeWidth="4" strokeLinecap="round" />
            <circle className="antenna-ball" cx="100" cy="10" r="5" fill="#4ADE80" />
            {/* 头部外壳（方形显示器） */}
            <rect x="30" y="30" width="140" height="104" rx="16" fill="#263129" stroke="#3E4E45" strokeWidth="2" />
            {/* 黑色面屏 */}
            <rect x="42" y="42" width="116" height="80" rx="9" fill="#0B100E" />
            {/* 菱形双眼（呼应 TRAE logo） */}
            <polygon className="eye eye-left" points="85,71 96,82 85,93 74,82" fill="#4ADE80" />
            <polygon className="eye eye-right" points="115,71 126,82 115,93 104,82" fill="#4ADE80" />
            {/* 身体 */}
            <rect className="pet-body" x="62" y="140" width="76" height="54" rx="12" fill="#1C2521" stroke="#2E3A34" strokeWidth="2" />
            <rect className="chest-light" x="88" y="156" width="24" height="7" rx="3.5" fill="#4ADE80" opacity="0.85" />
            {/* 手臂 */}
            <rect x="44" y="146" width="13" height="34" rx="6.5" fill="#1C2521" stroke="#2E3A34" strokeWidth="2" />
            <rect x="143" y="146" width="13" height="34" rx="6.5" fill="#1C2521" stroke="#2E3A34" strokeWidth="2" />
            {/* 咖啡杯（右手，参考图元素） */}
            <g className="coffee">
              <rect x="159" y="172" width="16" height="14" rx="3" fill="#F5F5F0" />
              <rect x="156" y="169" width="22" height="5" rx="2.5" fill="#8B6F52" />
            </g>
          </svg>
        </div>
      </div>
      <div className="pet-shadow" />
    </div>
  )
}
