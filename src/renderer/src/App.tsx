import { useCallback, useEffect, useRef, useState } from 'react'
import Pet from './components/Pet/Pet'
import ChatPanel from './components/ChatPanel/ChatPanel'
import { useChat } from './hooks/useChat'
import { playReminderChime } from './utils/sound'
import type { PanelView, Todo } from './types'

export default function App() {
  const [panelOpen, setPanelOpen] = useState(false)
  const [view, setView] = useState<PanelView>('chat')
  const [todos, setTodos] = useState<Todo[]>([])
  const [reminder, setReminder] = useState<{ id: number; title: string } | null>(null)

  const refreshTodos = useCallback(async () => {
    try {
      setTodos(await window.desktopAI.todoList())
    } catch {
      // 忽略：面板未打开时无需感知失败
    }
  }, [])

  const openTodoView = useCallback(() => {
    setPanelOpen(true)
    window.desktopAI.setPanel(true)
    setView('todo')
    setReminder(null)
  }, [])

  const { messages, state, error, send, retry } = useChat({
    onTodoShow: openTodoView,
    onTodoChanged: refreshTodos
  })

  const reminderRef = useRef(reminder)
  reminderRef.current = reminder

  // 到期提醒：立即响铃 + 未查看时每 30 秒重复（最多 3 次）
  useEffect(() => {
    if (!reminder) return
    playReminderChime()
    let count = 0
    const timer = setInterval(() => {
      if (!reminderRef.current) {
        clearInterval(timer)
        return
      }
      if (++count >= 3) {
        clearInterval(timer)
        return
      }
      playReminderChime()
    }, 30_000)
    return () => clearInterval(timer)
  }, [reminder])

  const togglePanel = useCallback(() => {
    setPanelOpen((prev) => {
      const next = !prev
      window.desktopAI.setPanel(next)
      if (!next) setView('chat')
      return next
    })
  }, [])

  // 初始加载待办 + 订阅到期提醒（桌宠气泡）与系统通知点击（直接打开待办）
  useEffect(() => {
    window.desktopAI.todoList().then(setTodos).catch(() => {})
    const offReminder = window.desktopAI.onTodoReminder((todo) => setReminder(todo))
    const offOpen = window.desktopAI.onTodoOpen(openTodoView)
    return () => {
      offReminder()
      offOpen()
    }
  }, [openTodoView])

  const handleToggleTodo = useCallback(
    async (id: number) => {
      await window.desktopAI.todoToggle(id)
      refreshTodos()
    },
    [refreshTodos]
  )

  const handleRemoveTodo = useCallback(
    async (id: number) => {
      await window.desktopAI.todoRemove(id)
      refreshTodos()
    },
    [refreshTodos]
  )

  return (
    <div className="app">
      {panelOpen && (
        <ChatPanel
          messages={messages}
          state={state}
          error={error}
          onSend={send}
          onRetry={retry}
          onClose={togglePanel}
          view={view}
          onViewChange={setView}
          todos={todos}
          onTodoToggle={handleToggleTodo}
          onTodoRemove={handleRemoveTodo}
          reminderActive={reminder !== null}
        />
      )}
      <Pet
        state={state}
        panelOpen={panelOpen}
        onClick={togglePanel}
        reminder={reminder}
        onReminderClick={openTodoView}
      />
    </div>
  )
}
