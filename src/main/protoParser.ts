import * as protoLoader from '@grpc/proto-loader'
import { ProtoPackage, ProtoService, ProtoMethod } from '../renderer/src/store/useGrpcStore'

function findMessageTypeFields(typeName: string, messageTypes: Record<string, any>): any[] | null {
  const clean = typeName.startsWith('.') ? typeName.substring(1) : typeName

  // 1. Direct match
  if (messageTypes[clean]) return messageTypes[clean]

  // 2. Registry ends with clean (registry: 'testpkg.SubMessage', clean: 'SubMessage')
  const match1 = Object.keys(messageTypes).find((k) => k.endsWith(clean))
  if (match1) return messageTypes[match1]

  // 3. Clean ends with registry (clean: 'testpkg.SubMessage', registry: 'SubMessage')
  const match2 = Object.keys(messageTypes).find((k) => clean.endsWith(k))
  if (match2) return messageTypes[match2]

  // 4. Fallback: match the last segment of both (both end with 'SubMessage')
  const lastSegment = clean.split('.').pop()
  if (lastSegment) {
    const match3 = Object.keys(messageTypes).find((k) => k.split('.').pop() === lastSegment)
    if (match3) return messageTypes[match3]
  }

  return null
}

function resolveFieldsRecursive(
  fields: any[],
  messageTypes: Record<string, any>,
  visited: Set<string> = new Set()
): any[] {
  if (!fields) return []
  return fields.map((field) => {
    if (field.typeName) {
      const cleanTypeName = field.typeName.startsWith('.')
        ? field.typeName.substring(1)
        : field.typeName

      // Find the message definition using our bulletproof lookup
      const subFields = findMessageTypeFields(cleanTypeName, messageTypes)

      if (subFields) {
        if (visited.has(cleanTypeName) || visited.size > 15) {
          return {
            ...field,
            fields: []
          }
        }
        const nextVisited = new Set(visited)
        nextVisited.add(cleanTypeName)
        return {
          ...field,
          fields: resolveFieldsRecursive(subFields, messageTypes, nextVisited)
        }
      }
    }
    return field
  })
}

export function parsePackageDefinition(packageDefinition: any): ProtoPackage[] {
  const packagesMap: Record<string, ProtoPackage> = {}

  // First, let's collect all message type fields so we can resolve them for methods
  const messageTypes: Record<string, any> = {}
  for (const [key, value] of Object.entries(packageDefinition)) {
    const def = value as any
    if (def && def.type && Array.isArray(def.type.field)) {
      messageTypes[key] = def.type.field
    }
  }

  // Now, let's iterate and collect all services
  for (const [key, value] of Object.entries(packageDefinition)) {
    const def = value as any

    // Determine if it's a service
    const isService =
      def &&
      typeof def === 'object' &&
      !def.format &&
      Object.values(def).length > 0 &&
      Object.values(def).every((m: any) => m && typeof m === 'object' && 'path' in m)

    if (isService) {
      const lastDotIndex = key.lastIndexOf('.')
      const packageName = lastDotIndex !== -1 ? key.substring(0, lastDotIndex) : 'default'
      const serviceName = lastDotIndex !== -1 ? key.substring(lastDotIndex + 1) : key

      if (!packagesMap[packageName]) {
        packagesMap[packageName] = {
          name: packageName,
          services: []
        }
      }

      const methods: ProtoMethod[] = []
      for (const [methodName, methodDef] of Object.entries(def) as any[]) {
        const requestTypeFullName = methodDef.requestType.type.name || methodDef.requestType.name
        const responseTypeFullName = methodDef.responseType.type.name || methodDef.responseType.name

        // Try to resolve request fields using our bulletproof lookup helper
        let resolvedFields = findMessageTypeFields(requestTypeFullName, messageTypes)

        if (resolvedFields) {
          resolvedFields = resolveFieldsRecursive(resolvedFields, messageTypes)
        }

        methods.push({
          name: methodName,
          fullName: `${key}/${methodName}`,
          requestType: requestTypeFullName,
          responseType: responseTypeFullName,
          requestStream: methodDef.requestStream,
          responseStream: methodDef.responseStream,
          requestFields: resolvedFields
        })
      }

      const service: ProtoService = {
        name: serviceName,
        fullName: key,
        methods
      }

      packagesMap[packageName].services.push(service)
    }
  }

  return Object.values(packagesMap)
}

export function parseProtoFile(protoPath: string, importPaths: string[] = []): ProtoPackage[] {
  try {
    const packageDefinition = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: importPaths
    })

    return parsePackageDefinition(packageDefinition)
  } catch (error) {
    console.error('Failed to parse proto file:', error)
    throw error
  }
}
