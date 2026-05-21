import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  selectProtoFile: () => ipcRenderer.invoke('select-proto-file'),
  loadServicesByReflection: (host: string) =>
    ipcRenderer.invoke('load-services-by-reflection', host),
  executeRpcCall: (options: any) => ipcRenderer.invoke('execute-rpc-call', options),
  writeStreamChunk: (streamId: string, payload: string) =>
    ipcRenderer.invoke('write-stream-chunk', { streamId, payload }),
  endStream: (streamId: string) => ipcRenderer.invoke('end-stream', { streamId }),

  // Stream event listeners
  onStreamEvent: (callback: (data: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data)
    ipcRenderer.on('stream-event', subscription)
    return () => ipcRenderer.removeListener('stream-event', subscription)
  },
  onStreamActive: (callback: (data: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data)
    ipcRenderer.on('stream-active', subscription)
    return () => ipcRenderer.removeListener('stream-active', subscription)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
