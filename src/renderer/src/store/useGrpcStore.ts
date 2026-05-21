import { create } from 'zustand'

export interface ProtoMethod {
  name: string
  requestType: string
  responseType: string
  requestStream: boolean
  responseStream: boolean
  requestFields?: any // To generate JSON template automatically
  fullName: string // e.g. "helloworld.Greeter/SayHello"
}

export interface ProtoService {
  name: string
  methods: ProtoMethod[]
  fullName: string // e.g. "helloworld.Greeter"
}

export interface ProtoPackage {
  name: string
  services: ProtoService[]
}

export interface MetadataEntry {
  key: string
  value: string
  enabled: boolean
}

export interface GrpcResponse {
  payload: string
  status?: string
  statusCode?: number
  duration?: number
  headers?: Record<string, string>
  error?: string
}

export interface GrpcStreamLog {
  id: string
  timestamp: number
  type: 'request' | 'response' | 'status' | 'error'
  payload: string
}

export interface HistoryItem {
  id: string
  timestamp: number
  host: string
  methodFullName: string
  payload: string
  metadata: MetadataEntry[]
  response: GrpcResponse
}

interface GrpcStore {
  // Connection / Config
  host: string
  metadata: MetadataEntry[]

  // Scaffolding / Proto Schemas
  packages: ProtoPackage[]
  loadingProtos: boolean
  protoPath: string | null

  // Selected state
  selectedMethod: ProtoMethod | null
  selectedService: ProtoService | null

  // Request
  payload: string

  // Response
  loadingResponse: boolean
  response: GrpcResponse | null
  streamLogs: GrpcStreamLog[]

  // History & Collections
  history: HistoryItem[]

  // Actions
  setHost: (host: string) => void
  setPayload: (payload: string) => void
  addMetadata: () => void
  updateMetadata: (index: number, key: keyof MetadataEntry, value: any) => void
  deleteMetadata: (index: number) => void

  setPackages: (packages: ProtoPackage[]) => void
  setLoadingProtos: (loading: boolean) => void
  setProtoPath: (path: string | null) => void

  selectMethod: (method: ProtoMethod, service: ProtoService) => void

  setLoadingResponse: (loading: boolean) => void
  setResponse: (response: GrpcResponse | null) => void
  addStreamLog: (log: Omit<GrpcStreamLog, 'id' | 'timestamp'>) => void
  clearStreamLogs: () => void

  addHistoryItem: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void
  clearHistory: () => void
}

// Generate default JSON from proto fields descriptor
export function generateDefaultJson(_fields: any): string {
  return '{}'
}

export const useGrpcStore = create<GrpcStore>((set) => ({
  host: 'localhost:8080',
  metadata: [{ key: 'authorization', value: 'Bearer token_here', enabled: false }],

  packages: [],
  loadingProtos: false,
  protoPath: null,

  selectedMethod: null,
  selectedService: null,

  payload: '{}',

  loadingResponse: false,
  response: null,
  streamLogs: [],

  history: [],

  setHost: (host) => set({ host }),
  setPayload: (payload) => set({ payload }),

  addMetadata: () =>
    set((state) => ({
      metadata: [...state.metadata, { key: '', value: '', enabled: true }]
    })),

  updateMetadata: (index, key, value) =>
    set((state) => {
      const updated = [...state.metadata]
      updated[index] = { ...updated[index], [key]: value }
      return { metadata: updated }
    }),

  deleteMetadata: (index) =>
    set((state) => ({
      metadata: state.metadata.filter((_, i) => i !== index)
    })),

  setPackages: (packages) => set({ packages }),
  setLoadingProtos: (loading) => set({ loadingProtos: loading }),
  setProtoPath: (protoPath) => set({ protoPath }),

  selectMethod: (method, service) =>
    set(() => {
      // Try to parse the method's requestFields to generate a default JSON
      let defaultPayload = '{}'
      try {
        if (method.requestFields) {
          defaultPayload = generateDefaultJson(method.requestFields)
        }
      } catch (e) {
        console.error('Error generating template JSON', e)
      }

      return {
        selectedMethod: method,
        selectedService: service,
        payload: defaultPayload,
        response: null,
        streamLogs: []
      }
    }),

  setLoadingResponse: (loading) => set({ loadingResponse: loading }),
  setResponse: (response) => set({ response }),

  addStreamLog: (log) =>
    set((state) => ({
      streamLogs: [
        ...state.streamLogs,
        {
          ...log,
          id: Math.random().toString(36).substring(7),
          timestamp: Date.now()
        }
      ]
    })),

  clearStreamLogs: () => set({ streamLogs: [] }),

  addHistoryItem: (item) =>
    set((state) => {
      const newHistory = [
        {
          ...item,
          id: Math.random().toString(36).substring(7),
          timestamp: Date.now()
        },
        ...state.history
      ]
      // Keep max 50 items
      return { history: newHistory.slice(0, 50) }
    }),

  clearHistory: () => set({ history: [] })
}))
