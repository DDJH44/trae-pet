import { useEffect, useRef, useState } from 'react'
import type { ChatMessage, PanelView, PetState, Todo } from '../../types'
import './ChatPanel.css'

interface ChatPanelProps {
  messages: ChatMessage[]
  state: PetState
  error: string | null
  onSend: (text: string) => void
  onRetry: () => void
  onClose: () => void
  view: PanelView
  onViewChange: (v: PanelView) => void
  todos: Todo[]
  onTodoToggle: (id: number) => void
  onTodoRemove: (id: number) => void
}

const STATUS_TEXT: Record<PetState, string> = {
  idle: '在线',
  thinking: '正在思考…',
  speaking: '回复中',
  error: '出了点问题'
}

/** 提醒时间的友好显示 */
function fmtRemind(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number): string => String(n).padStart(2, '0')
  const today = new Date()
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (d.toDateString() === today.toDateString()) return `今天 ${hm}`
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  if (d.toDateString() === tomorrow.toDateString()) return `明天 ${hm}`
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`
}

export default function ChatPanel({
  messages,
  state,
  error,
  onSend,
  onRetry,
  onClose,
  view,
  onViewChange,
  todos,
  onTodoToggle,
  onTodoRemove
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // 新消息 / 状态变化时自动滚动到底部
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, state, error])

  // 面板打开时聚焦输入框
  useEffect(() => {
    if (view === 'chat') inputRef.current?.focus()
  }, [view])

  const canSend = state !== 'thinking' && input.trim().length > 0

  const doSend = (): void => {
    if (!canSend) return
    onSend(input)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      doSend()
    }
  }

  const pendingCount = todos.filter((t) => !t.done).length
  const activeTodos = todos.filter((t) => !t.done)
  const doneTodos = todos.filter((t) => t.done)

  return (
    <div className="chat-panel">
      <header className="chat-header">
        <svg className="chat-avatar" viewBox="0 0 40 40" aria-hidden="true">
          <rect x="4" y="6" width="32" height="24" rx="5" fill="#263129" stroke="#3E4E45" strokeWidth="1.5" />
          <rect x="8" y="10" width="24" height="16" rx="3" fill="#0B100E" />
          <polygon points="17,13 21,17 17,21 13,17" fill="#4ADE80" />
          <polygon points="27,13 31,17 27,21 23,17" fill="#4ADE80" />
        </svg>
        <div className="chat-title">
          <strong>{view === 'chat' ? 'TRAE 宝' : '我的待办'}</strong>
          <span className={`chat-status status-${state}`}>{STATUS_TEXT[state]}</span>
        </div>
        <button
          className={`chat-todo-btn${view === 'todo' ? ' active' : ''}`}
          onClick={() => onViewChange(view === 'chat' ? 'todo' : 'chat')}
          title="待办事项"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <rect x="3" y="3" width="14" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M6.5 10l2.2 2.2L14 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {pendingCount > 0 && <span className="todo-badge">{pendingCount}</span>}
        </button>
        <button className="chat-close" onClick={onClose} title="收起面板">
          −
        </button>
      </header>

      {view === 'chat' ? (
        <>
          <div className="chat-messages" ref={listRef}>
            {messages.length === 0 && state !== 'thinking' && (
              <div className="chat-empty">
                <p>你好，我是 TRAE 宝。</p>
                <p>在下方输入问题，Enter 发送。</p>
                <p className="chat-empty-hint">试试：「提醒我半小时后休息一下」</p>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`chat-msg ${m.role === 'user' ? 'from-user' : 'from-ai'}`}>
                {m.content}
                {m.todoCard && (
                  <div className={`todo-card todo-card-${m.todoCard.kind}`}>
                    {m.todoCard.kind === 'added' && <span>✓ 已添加待办「{m.todoCard.title}」</span>}
                    {m.todoCard.kind === 'done' && <span>✓ 已完成该待办</span>}
                    {m.todoCard.kind === 'removed' && <span>🗑 已删除该待办</span>}
                  </div>
                )}
              </div>
            ))}
            {state === 'thinking' && (
              <div className="chat-msg from-ai thinking-dots">
                <span />
                <span />
                <span />
              </div>
            )}
            {error && (
              <div className="chat-error">
                <span className="chat-error-text">{error}</span>
                <button className="chat-retry" onClick={onRetry}>
                  重试
                </button>
              </div>
            )}
          </div>

          <footer className="chat-footer">
            <textarea
              ref={inputRef}
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入问题，Enter 发送，Shift+Enter 换行"
              rows={2}
              spellCheck={false}
            />
            <button className="chat-send" onClick={doSend} disabled={!canSend}>
              发送
            </button>
          </footer>
        </>
      ) : (
        <div className="todo-view">
          <div className="todo-list">
            {todos.length === 0 && (
              <div className="todo-empty">
                <p>还没有待办事项</p>
                <p className="todo-empty-hint">对我说「提醒我明天 9 点开会」</p>
              </div>
            )}
            {activeTodos.map((t) => (
              <div key={t.id} className="todo-item">
                <button
                  className={`todo-check${t.done ? ' checked' : ''}`}
                  onClick={() => onTodoToggle(t.id)}
                  title={t.done ? '标记为未完成' : '完成'}
                />
                <div className="todo-info">
                  <div className="todo-title">{t.title}</div>
                  {t.remindAt && <div className="todo-time">⏰ {fmtRemind(t.remindAt)}</div>}
                </div>
                <button className="todo-del" onClick={() => onTodoRemove(t.id)} title="删除">
                  ×
                </button>
              </div>
            ))}
            {doneTodos.length > 0 && <div className="todo-divider">已完成</div>}
            {doneTodos.map((t) => (
              <div key={t.id} className="todo-item done">
                <button
                  className="todo-check checked"
                  onClick={() => onTodoToggle(t.id)}
                  title="标记为未完成"
                />
                <div className="todo-info">
                  <div className="todo-title">{t.title}</div>
                </div>
                <button className="todo-del" onClick={() => onTodoRemove(t.id)} title="删除">
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
