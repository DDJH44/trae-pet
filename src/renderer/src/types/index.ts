export type PetState = 'idle' | 'thinking' | 'speaking' | 'error'

export type ChatRole = 'user' | 'assistant'

/** 聊天面板当前视图：对话 / 待办 */
export type PanelView = 'chat' | 'todo'

/** 待办卡片：AI 回复中解析出待办操作后，随消息展示的确认条 */
export interface TodoCard {
  kind: 'added' | 'done' | 'removed'
  title?: string
}

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: number
  todoCard?: TodoCard
}

export interface Todo {
  id: number
  title: string
  remindAt: string | null
  done: boolean
  createdAt: string
}

export interface ChatResult {
  success: boolean
  reply?: string
  error?: string
}

export interface DesktopAI {
  chat: (messages: { role: ChatRole; content: string }[]) => Promise<ChatResult>
  setPanel: (open: boolean) => Promise<void>
  moveBy: (dx: number, dy: number) => Promise<void>
  todoList: () => Promise<Todo[]>
  todoAdd: (title: string, remindAt: string | null) => Promise<Todo>
  todoToggle: (id: number) => Promise<unknown>
  todoRemove: (id: number) => Promise<boolean>
  onTodoReminder: (cb: (todo: { id: number; title: string }) => void) => () => void
  onTodoOpen: (cb: () => void) => () => void
  showContextMenu: () => void
}

declare global {
  interface Window {
    desktopAI: DesktopAI
  }
}
