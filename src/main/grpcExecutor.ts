import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'
import { BrowserWindow } from 'electron'
import { GrpcResponse } from '../renderer/src/store/useGrpcStore'
import { getAncestorDirectories } from './protoParser'

// Keep track of active streams for client-streaming and bidirectional calls
const activeStreams = new Map<string, any>()

// Keep track of dynamic reflection package definitions
const reflectionCache = new Map<string, any>() // host -> PackageDefinition

export function setReflectionCache(host: string, packageDefinition: any): void {
  reflectionCache.set(host, packageDefinition)
}

export function getCachedPackageDefinition(host: string): any {
  return reflectionCache.get(host)
}

export interface RpcRequestOptions {
  protoPath: string
  importPaths: string[]
  host: string
  serviceFullName: string
  methodName: string
  payload: string // JSON string
  metadata: { key: string; value: string; enabled: boolean }[]
  streamId?: string // Client streams need an ID to write multiple times
}

// Convert frontend metadata entries to grpc.Metadata
function createGrpcMetadata(metadataList: RpcRequestOptions['metadata']): grpc.Metadata {
  const metadata = new grpc.Metadata()
  for (const item of metadataList) {
    if (item.enabled && item.key && item.value) {
      metadata.add(item.key, item.value)
    }
  }
  return metadata
}

// Resolve the service constructor from the package definition
function resolveServiceClientConstructor(
  packageDefinition: protoLoader.PackageDefinition,
  serviceFullName: string
): any {
  const grpcObject = grpc.loadPackageDefinition(packageDefinition)

  let current: any = grpcObject
  const parts = serviceFullName.split('.')
  for (const part of parts) {
    if (current && current[part]) {
      current = current[part]
    } else {
      throw new Error(`Could not resolve service path: ${serviceFullName} (failed at: ${part})`)
    }
  }

  if (typeof current !== 'function') {
    throw new Error(`Resolved item is not a Service Client: ${serviceFullName}`)
  }

  return current
}

export function executeRpcCall(
  window: BrowserWindow,
  options: RpcRequestOptions
): Promise<GrpcResponse> {
  return new Promise((resolve) => {
    const startTime = Date.now()

    try {
      let packageDefinition: any
      if (options.protoPath === 'reflection') {
        packageDefinition = getCachedPackageDefinition(options.host)
        if (!packageDefinition) {
          throw new Error(
            `No cached reflection services found for host "${options.host}". Please run Server Reflection first.`
          )
        }
      } else {
        const ancestors = getAncestorDirectories(options.protoPath)
        const resolvedImportPaths = Array.from(
          new Set([...(options.importPaths || []), ...ancestors])
        )

        packageDefinition = protoLoader.loadSync(options.protoPath, {
          keepCase: true,
          longs: String,
          enums: String,
          defaults: true,
          oneofs: true,
          includeDirs: resolvedImportPaths
        })
      }

      const ServiceClient = resolveServiceClientConstructor(
        packageDefinition,
        options.serviceFullName
      )

      // Determine credentials
      // Default: Insecure connection
      const credentials = grpc.credentials.createInsecure()
      const client = new ServiceClient(options.host, credentials)

      const metadata = createGrpcMetadata(options.metadata)
      const parsedPayload = JSON.parse(options.payload || '{}')

      // Get method definitions
      const serviceMethods = packageDefinition[options.serviceFullName] as any
      if (!serviceMethods || !serviceMethods[options.methodName]) {
        throw new Error(
          `Method ${options.methodName} not found in service ${options.serviceFullName}`
        )
      }

      const methodDef = serviceMethods[options.methodName]
      const requestStream = methodDef.requestStream
      const responseStream = methodDef.responseStream

      // Handle different execution paths based on streaming options
      if (!requestStream && !responseStream) {
        // --- 1. UNARY CALL ---
        client[options.methodName](
          parsedPayload,
          metadata,
          (error: grpc.ServiceError | null, response: any) => {
            const duration = Date.now() - startTime
            client.close()

            if (error) {
              resolve({
                payload: '',
                status: error.message,
                statusCode: error.code,
                duration,
                error: error.message,
                headers: error.metadata ? (error.metadata.getMap() as any) : undefined
              })
            } else {
              resolve({
                payload: JSON.stringify(response, null, 2),
                status: 'OK',
                statusCode: 0,
                duration
              })
            }
          }
        )
      } else if (!requestStream && responseStream) {
        // --- 2. SERVER STREAMING ---
        const stream = client[options.methodName](parsedPayload, metadata)

        stream.on('data', (chunk: any) => {
          window.webContents.send('stream-event', {
            type: 'response',
            payload: JSON.stringify(chunk, null, 2)
          })
        })

        stream.on('status', (status: grpc.StatusObject) => {
          window.webContents.send('stream-event', {
            type: 'status',
            payload: `Status: ${status.details} (Code: ${status.code})`
          })
        })

        stream.on('error', (error: grpc.ServiceError) => {
          client.close()
          window.webContents.send('stream-event', {
            type: 'error',
            payload: `Error: ${error.message} (Code: ${error.code})`
          })
          resolve({
            payload: '',
            status: error.message,
            statusCode: error.code,
            duration: Date.now() - startTime,
            error: error.message
          })
        })

        stream.on('end', () => {
          client.close()
          window.webContents.send('stream-event', {
            type: 'status',
            payload: 'Stream ended by server.'
          })
          resolve({
            payload: 'Stream Complete',
            status: 'OK',
            statusCode: 0,
            duration: Date.now() - startTime
          })
        })
      } else {
        // --- 3. CLIENT STREAMING & 4. BIDIRECTIONAL STREAMING ---
        const streamId = options.streamId || Math.random().toString(36).substring(7)
        let stream: any

        if (requestStream && !responseStream) {
          // Client Streaming
          stream = client[options.methodName](
            metadata,
            (error: grpc.ServiceError | null, response: any) => {
              const duration = Date.now() - startTime
              client.close()
              activeStreams.delete(streamId)

              if (error) {
                window.webContents.send('stream-event', {
                  type: 'error',
                  payload: `Error: ${error.message} (Code: ${error.code})`
                })
                resolve({
                  payload: '',
                  status: error.message,
                  statusCode: error.code,
                  duration,
                  error: error.message
                })
              } else {
                window.webContents.send('stream-event', {
                  type: 'response',
                  payload: JSON.stringify(response, null, 2)
                })
                resolve({
                  payload: JSON.stringify(response, null, 2),
                  status: 'OK',
                  statusCode: 0,
                  duration
                })
              }
            }
          )
        } else {
          // Bidirectional Streaming
          stream = client[options.methodName](metadata)

          stream.on('data', (chunk: any) => {
            window.webContents.send('stream-event', {
              type: 'response',
              payload: JSON.stringify(chunk, null, 2)
            })
          })

          stream.on('status', (status: grpc.StatusObject) => {
            window.webContents.send('stream-event', {
              type: 'status',
              payload: `Status: ${status.details} (Code: ${status.code})`
            })
          })

          stream.on('error', (error: grpc.ServiceError) => {
            client.close()
            activeStreams.delete(streamId)
            window.webContents.send('stream-event', {
              type: 'error',
              payload: `Error: ${error.message} (Code: ${error.code})`
            })
            resolve({
              payload: '',
              status: error.message,
              statusCode: error.code,
              duration: Date.now() - startTime,
              error: error.message
            })
          })

          stream.on('end', () => {
            client.close()
            activeStreams.delete(streamId)
            window.webContents.send('stream-event', {
              type: 'status',
              payload: 'Stream ended by server.'
            })
            resolve({
              payload: 'Stream Complete',
              status: 'OK',
              statusCode: 0,
              duration: Date.now() - startTime
            })
          })
        }

        // Save references so we can write to the stream from renderer
        activeStreams.set(streamId, { stream, client })

        // Inform the frontend of the active stream ID
        window.webContents.send('stream-active', { streamId })

        // Push initial payload if any (for Client Streaming start)
        try {
          stream.write(parsedPayload)
          window.webContents.send('stream-event', {
            type: 'request',
            payload: JSON.stringify(parsedPayload, null, 2)
          })
        } catch (e: any) {
          console.error('Failed to write initial payload to stream:', e)
        }
      }
    } catch (e: any) {
      resolve({
        payload: '',
        status: e.message || 'Internal Error',
        statusCode: 2,
        error: e.message || 'Internal Error'
      })
    }
  })
}

// Write a chunk to an active client stream / bidi stream
export function writeStreamChunk(streamId: string, payloadStr: string) {
  const active = activeStreams.get(streamId)
  if (!active) {
    throw new Error(`No active stream with ID: ${streamId}`)
  }

  try {
    const chunk = JSON.parse(payloadStr || '{}')
    active.stream.write(chunk)
    return { success: true }
  } catch (error: any) {
    throw new Error(`Failed to write to stream: ${error.message}`)
  }
}

// End/close an active stream
export function endStream(streamId: string) {
  const active = activeStreams.get(streamId)
  if (!active) {
    return { success: false, message: 'Stream not active' }
  }

  try {
    active.stream.end()
    return { success: true }
  } catch (error: any) {
    active.client.close()
    activeStreams.delete(streamId)
    return { success: false, error: error.message }
  }
}
