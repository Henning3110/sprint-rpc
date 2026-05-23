import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { parseProtoFile } from './protoParser'
import { executeRpcCall, writeStreamChunk, endStream, setReflectionCache } from './grpcExecutor'
import { fetchServicesAndPackagesFromReflection } from './grpcReflection'

// Set application name explicitly for macOS menu bar and system integrations
app.name = 'SprintRPC'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'default',
    title: 'SprintRPC',
    ...(process.platform !== 'darwin' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.sprintrpc.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC gRPC handlers
  ipcMain.handle('select-proto-file', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return null

    const result = await dialog.showOpenDialog(window, {
      title: 'Select Proto File',
      filters: [{ name: 'Protocol Buffers', extensions: ['proto'] }],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const protoPath = result.filePaths[0]
    try {
      const packages = parseProtoFile(protoPath)
      return { protoPath, packages }
    } catch (error: any) {
      return { error: error.message }
    }
  })

  ipcMain.handle('load-services-by-reflection', async (_event, host) => {
    try {
      const { packages, packageDefinition } = await fetchServicesAndPackagesFromReflection(host)
      setReflectionCache(host, packageDefinition)
      return { packages }
    } catch (error: any) {
      return { error: error.message }
    }
  })

  ipcMain.handle('execute-rpc-call', async (event, options) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return null
    return executeRpcCall(window, options)
  })

  ipcMain.handle('write-stream-chunk', async (_event, { streamId, payload }) => {
    return writeStreamChunk(streamId, payload)
  })

  ipcMain.handle('end-stream', async (_event, { streamId }) => {
    return endStream(streamId)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
