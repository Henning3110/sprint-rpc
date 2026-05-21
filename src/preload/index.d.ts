import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      selectProtoFile: () => Promise<{ protoPath: string; packages: any[]; error?: string } | null>
      loadServicesByReflection: (
        host: string
      ) => Promise<{ packages?: any[]; error?: string } | null>
      executeRpcCall: (options: any) => Promise<any>
      writeStreamChunk: (
        streamId: string,
        payload: string
      ) => Promise<{ success: boolean; error?: string }>
      endStream: (streamId: string) => Promise<{ success: boolean; error?: string }>
      onStreamEvent: (callback: (data: any) => void) => () => void
      onStreamActive: (callback: (data: any) => void) => () => void
    }
  }
}
