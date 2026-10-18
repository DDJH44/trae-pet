import { contextBridge, ipcRenderer } from 'electron'

/**
 * Preload 只暴露受控的最小接口：
 * - chat: 发送对话（主进程持有密钥，Renderer 无法接触）
 * - setPanel: 展开/收起聊天面板（触发主进程调整窗口尺寸）
 * - showContextMenu: 弹出右键菜单（退出入口）
 */
const api = {
  chat: (messages: { role: 'user' | 'assistant'; content: string }[]): Promise<{
    success: boolean
    reply?: string
    error?: string
  }> => ipcRenderer.invoke('ai:chat', messages),
  setPanel: (open: boolean): Promise<void> => ipcRenderer.invoke('window:set-panel', open),
  moveBy: (dx: number, dy: number): Promise<void> => ipcRenderer.invoke('window:move-by', dx, dy),
  todoList: (): Promise<
    { id: number; title: string; remindAt: string | null; done: boolean; createdAt: string }[]
  > => ipcRenderer.invoke('todo:list'),
  todoAdd: (
    title: string,
    remindAt: string | null
  ): Promise<{ id: number; title: string; remindAt: string | null; done: boolean; createdAt: string }> =>
    ipcRenderer.invoke('todo:add', title, remindAt),
  todoToggle: (id: number): Promise<unknown> => ipcRenderer.invoke('todo:toggle', id),
  todoRemove: (id: number): Promise<boolean> => ipcRenderer.invoke('todo:remove', id),
  // 到期提醒事件（桌宠气泡）
  onTodoReminder: (cb: (todo: { id: number; title: string }) => void): (() => void) => {
    const listener = (_e: unknown, todo: { id: number; title: string }): void => cb(todo)
    ipcRenderer.on('todo:reminder', listener)
    return () => ipcRenderer.removeListener('todo:reminder', listener)
  },
  // 系统通知点击 → 打开待办视图
  onTodoOpen: (cb: () => void): (() => void) => {
    const listener = (): void => cb()
    ipcRenderer.on('todo:open', listener)
    return () => ipcRenderer.removeListener('todo:open', listener)
  },
  showContextMenu: (): void => {
    ipcRenderer.send('app:context-menu')
  }
}

contextBridge.exposeInMainWorld('desktopAI', api)

export type DesktopAApi = typeof api
