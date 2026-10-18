import { app, BrowserWindow, Menu, ipcMain, screen, Notification } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

// ---------- 环境变量加载（读取项目根 .env，不引入额外依赖） ----------
function loadEnvFile(): void {
  const envPath = path.join(app.getAppPath(), '.env')
  if (!fs.existsSync(envPath)) return
  const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)
  for (const line of lines) {
    if (line.trim().startsWith('#')) continue
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!m) continue
    const key = m[1].trim()
    const value = m[2].trim().replace(/^["']|["']$/g, '')
    if (!(key in process.env)) process.env[key] = value
  }
}

// ---------- 窗口尺寸常量 ----------
const PET_SIZE = { width: 138, height: 168 } // 收起态：仅角色（紧凑版）
const PANEL_SIZE = { width: 500, height: 460 } // 展开态：角色 + 聊天面板

let mainWindow: BrowserWindow | null = null

// ---------- 待办事项：本地 JSON 持久化 ----------
interface Todo {
  id: number
  title: string
  remindAt: string | null // ISO 8601；null = 无提醒
  done: boolean
  notified: boolean
  createdAt: string
}

let todos: Todo[] = []
let nextTodoId = 1

function todosPath(): string {
  return path.join(app.getPath('userData'), 'todos.json')
}

function loadTodos(): void {
  try {
    const raw = fs.readFileSync(todosPath(), 'utf-8')
    const data = JSON.parse(raw) as { todos?: Todo[]; nextId?: number }
    todos = Array.isArray(data.todos) ? data.todos : []
    nextTodoId = typeof data.nextId === 'number' ? data.nextId : todos.length + 1
  } catch {
    todos = []
    nextTodoId = 1
  }
}

function saveTodos(): void {
  try {
    fs.writeFileSync(todosPath(), JSON.stringify({ todos, nextId: nextTodoId }, null, 2))
  } catch {
    // 存储失败不阻塞功能
  }
}

function createWindow(): void {
  const { workArea } = screen.getPrimaryDisplay()
  mainWindow = new BrowserWindow({
    width: PET_SIZE.width,
    height: PET_SIZE.height,
    x: workArea.x + workArea.width - PET_SIZE.width - 48,
    y: workArea.y + workArea.height - PET_SIZE.height - 24,
    transparent: true,
    frame: false,
    resizable: false, // Windows 透明窗口必须关闭可缩放，否则透明失效
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // screen-saver 级别置顶，确保覆盖普通窗口
  mainWindow.setAlwaysOnTop(true, 'screen-saver')

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ---------- IPC：面板展开/收起（窗口右下角锚点不变，向左上扩展） ----------
ipcMain.handle('window:set-panel', (_event, open: boolean) => {
  const win = mainWindow
  if (!win) return
  const b = win.getBounds()
  const anchorRight = b.x + b.width
  const anchorBottom = b.y + b.height
  const width = open ? PANEL_SIZE.width : PET_SIZE.width
  const height = open ? PANEL_SIZE.height : PET_SIZE.height
  let x = anchorRight - width
  let y = anchorBottom - height
  // 防止越出工作区
  const { workArea } = screen.getPrimaryDisplay()
  x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - width))
  y = Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - height))
  win.setBounds({ x, y, width, height })
})

// ---------- IPC：手动拖动（增量移动窗口，保证点击事件不被系统 drag 拦截） ----------
ipcMain.handle('window:move-by', (_event, dx: number, dy: number) => {
  const win = mainWindow
  if (!win) return
  const [x, y] = win.getPosition()
  win.setPosition(x + dx, y + dy)
})

// ---------- IPC：待办事项 CRUD ----------
ipcMain.handle('todo:list', () => todos)

ipcMain.handle('todo:add', (_event, title: string, remindAt: string | null) => {
  const todo: Todo = {
    id: nextTodoId++,
    title: String(title).slice(0, 100),
    remindAt: remindAt || null,
    done: false,
    notified: false,
    createdAt: new Date().toISOString()
  }
  todos.push(todo)
  saveTodos()
  return todo
})

ipcMain.handle('todo:toggle', (_event, id: number) => {
  const todo = todos.find((t) => t.id === id)
  if (todo) {
    todo.done = !todo.done
    saveTodos()
  }
  return todo ?? null
})

ipcMain.handle('todo:remove', (_event, id: number) => {
  const before = todos.length
  todos = todos.filter((t) => t.id !== id)
  saveTodos()
  return todos.length < before
})

// ---------- 提醒调度：每 20 秒扫描到期待办，双通道提醒 ----------
function startReminderScheduler(): void {
  setInterval(() => {
    const now = Date.now()
    const due = todos.filter(
      (t) => !t.done && !t.notified && t.remindAt && new Date(t.remindAt).getTime() <= now
    )
    if (due.length === 0) return
    for (const t of due) t.notified = true
    saveTodos()

    // 通道一：桌宠气泡（渲染进程）
    mainWindow?.webContents.send('todo:reminder', due[due.length - 1])

    // 通道二：Windows 系统通知
    for (const t of due) {
      if (!Notification.isSupported()) break
      const n = new Notification({
        title: '⏰ TRAE 宝提醒',
        body: t.title,
        silent: false
      })
      n.on('click', () => {
        mainWindow?.webContents.send('todo:open')
      })
      n.show()
    }
  }, 20_000)
}

// ---------- IPC：右键菜单（提供退出入口） ----------
ipcMain.on('app:context-menu', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return
  Menu.buildFromTemplate([
    { label: '退出 TRAE 宝', click: () => app.quit() }
  ]).popup({ window: win })
})

// ---------- AI 请求（主进程持有密钥，Renderer 无法接触） ----------
interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

interface ChatResult {
  success: boolean
  reply?: string
  error?: string
}

const AI_TIMEOUT_MS = 30000

function buildSystemPrompt(): string {
  const now = new Date()
  const todoLines =
    todos.length > 0
      ? todos
          .map(
            (t) =>
              `[${t.id}] ${t.done ? '[已完成] ' : ''}${t.title}${t.remindAt ? `（提醒：${t.remindAt}）` : ''}`
          )
          .join('\n')
      : '（当前没有待办）'

  return `你是 TRAE 宝，一个友好、简洁的桌面 AI 伙伴。请用中文回答，语气亲切自然，回答尽量精炼。

你现在具备待办事项管理能力。

当前时间：${now.toLocaleString('zh-CN', { hour12: false })}（ISO：${now.toISOString()}）
当前待办列表：
${todoLines}

【待办指令协议】当且仅当用户表达了明确的待办意图时，在回复文本的最末尾追加对应指令块（指令块对用户不可见，其余回复正常写，简短确认即可）：
1. 用户想添加待办或让你提醒他做某事：
[[TODO_ADD]]{"title":"简短事项标题","remindAt":"ISO8601格式时间或null"}[[/TODO_ADD]]
- title 是简短的事项名（如"关服务器"），remindAt 是提醒时间。
- 用户提到时间（哪怕模糊如"半小时后""明天上午9点"）就换算成具体 ISO 时间；没提时间则填 null。
2. 用户想查看待办列表：[[TODO_SHOW]][[/TODO_SHOW]]
3. 用户想完成/勾掉某条待办：[[TODO_DONE]]{"id":编号}[[/TODO_DONE]]
4. 用户想删除某条待办：[[TODO_REMOVE]]{"id":编号}[[/TODO_REMOVE]]
注意：id 用待办列表里的编号。没有待办意图就正常聊天，绝不要输出指令块，也不要向用户解释这些格式。`
}

async function requestAI(messages: ChatTurn[]): Promise<ChatResult> {
  const baseURL = (process.env.AI_BASE_URL || '').replace(/\/+$/, '')
  const apiKey = process.env.AI_API_KEY || ''
  const model = process.env.AI_MODEL || ''

  if (!baseURL || !apiKey || !model) {
    return { success: false, error: '尚未配置模型服务，请检查 .env 中的 AI_BASE_URL / AI_API_KEY / AI_MODEL' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
  try {
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: buildSystemPrompt()
          },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 1024
      }),
      signal: controller.signal
    })

    if (res.status === 401 || res.status === 403) {
      return { success: false, error: 'API 鉴权失败，请检查密钥是否正确' }
    }
    if (res.status === 429) {
      return { success: false, error: '请求频率受限，请稍后再试' }
    }
    if (!res.ok) {
      return { success: false, error: `模型服务返回异常（HTTP ${res.status}），请稍后重试` }
    }

    const data = await res.json()
    const reply: unknown = data?.choices?.[0]?.message?.content
    if (typeof reply !== 'string' || !reply.trim()) {
      return { success: false, error: '暂时没有获取到有效回复，请重试' }
    }
    return { success: true, reply }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      return { success: false, error: '本次响应超时，可以重试' }
    }
    return { success: false, error: '当前无法连接模型服务，请检查网络' }
  } finally {
    clearTimeout(timer)
  }
}

ipcMain.handle('ai:chat', (_event, messages: ChatTurn[]) => requestAI(messages))

// ---------- 应用生命周期 ----------
loadEnvFile()
loadTodos()

app.whenReady().then(() => {
  createWindow()
  startReminderScheduler()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
