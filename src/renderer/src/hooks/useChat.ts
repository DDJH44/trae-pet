import { useCallback, useRef, useState } from 'react'
import type { ChatMessage, PetState, TodoCard } from '../types'

const MAX_HISTORY = 20 // 随请求携带的最近历史条数

/** 提取 AI 回复中的待办指令块：[[TODO_ADD]]{...}[[/TODO_ADD]] 等 */
const TODO_BLOCK_RE = /\[\[TODO_(ADD|SHOW|DONE|REMOVE)\]\]([\s\S]*?)\[\[\/TODO_\1\]\]/g

export interface UseChatOptions {
  /** AI 判定用户想看待办 → 通知外层切换到待办视图 */
  onTodoShow?: () => void
  /** 待办数据变化（增/完成/删）→ 通知外层刷新列表与角标 */
  onTodoChanged?: () => void
}

/** 解析并执行指令块，返回清理后的展示文本与确认卡片 */
async function applyTodoActions(
  reply: string
): Promise<{ text: string; card?: TodoCard; showList: boolean }> {
  const blocks = [...reply.matchAll(TODO_BLOCK_RE)]
  if (blocks.length === 0) return { text: reply, showList: false }

  let card: TodoCard | undefined
  let showList = false
  for (const b of blocks) {
    const kind = b[1]
    const body = b[2].trim()
    try {
      if (kind === 'ADD') {
        const { title, remindAt } = JSON.parse(body) as { title?: string; remindAt?: string }
        if (title) {
          await window.desktopAI.todoAdd(title, remindAt ?? null)
          card = { kind: 'added', title }
        }
      } else if (kind === 'DONE' || kind === 'REMOVE') {
        const { id } = JSON.parse(body) as { id?: number }
        if (typeof id === 'number') {
          if (kind === 'DONE') await window.desktopAI.todoToggle(id)
          else await window.desktopAI.todoRemove(id)
          card = { kind: kind === 'DONE' ? 'done' : 'removed' }
        }
      } else if (kind === 'SHOW') {
        showList = true
      }
    } catch {
      // 单个指令块解析失败则忽略，不影响其他
    }
  }
  const text = reply.replace(TODO_BLOCK_RE, '').trim()
  return { text, card, showList }
}

export function useChat(options?: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [state, setState] = useState<PetState>('idle')
  const [error, setError] = useState<string | null>(null)

  const messagesRef = useRef<ChatMessage[]>([])
  messagesRef.current = messages
  const optionsRef = useRef(options)
  optionsRef.current = options

  const genId = (): string =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`

  /**
   * 发送消息。isRetry 时复用最后一条 user 消息并移除其后未答复的尾部，
   * 避免重试导致消息重复入列。
   */
  const send = useCallback(
    async (text: string, isRetry = false): Promise<void> => {
      const content = text.trim()
      if (!content || state === 'thinking') return

      setError(null)
      const userMsg: ChatMessage = { id: genId(), role: 'user', content, createdAt: Date.now() }

      let history: ChatMessage[]
      if (isRetry) {
        const cur = messagesRef.current
        let lastUserIdx = -1
        for (let i = cur.length - 1; i >= 0; i--) {
          if (cur[i].role === 'user') {
            lastUserIdx = i
            break
          }
        }
        history = lastUserIdx >= 0 ? [...cur.slice(0, lastUserIdx), userMsg] : [...cur, userMsg]
      } else {
        history = [...messagesRef.current, userMsg]
      }

      setMessages(history)
      setState('thinking')

      const turns = history.slice(-MAX_HISTORY).map((m) => ({ role: m.role, content: m.content }))
      const res = await window.desktopAI.chat(turns)

      if (res.success && res.reply) {
        const { text: cleanText, card, showList } = await applyTodoActions(res.reply)
        const display = cleanText || (card || showList ? '好的～' : res.reply)
        setMessages((prev) => [
          ...prev,
          { id: genId(), role: 'assistant', content: display, createdAt: Date.now(), todoCard: card }
        ])
        if (card || showList) optionsRef.current?.onTodoChanged?.()
        if (showList) optionsRef.current?.onTodoShow?.()
        setState('speaking')
        // 回复展示片刻后回到待机
        setTimeout(() => setState((prev) => (prev === 'speaking' ? 'idle' : prev)), 2500)
      } else {
        setError(res.error || '未知错误，请重试')
        setState('error')
      }
    },
    [state]
  )

  const retry = useCallback((): void => {
    setError(null)
    const cur = messagesRef.current
    const lastUser = [...cur].reverse().find((m) => m.role === 'user')
    if (lastUser) send(lastUser.content, true)
  }, [send])

  return { messages, state, error, send, retry }
}
