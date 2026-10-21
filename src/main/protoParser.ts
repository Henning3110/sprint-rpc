import * as protoLoader from '@grpc/proto-loader'
import * as path from 'path'
import { ProtoPackage, ProtoService, ProtoMethod } from '../renderer/src/store/useGrpcStore'

// proto-loader only lists top-level types, so register nested messages and enums
// from their parent's descriptor. Map entries are skipped: maps are filled as plain objects.
function collectNestedTypes(
  parentKey: string,
  descriptor: any,
  messageTypes: Record<string, any>,
  typeKeys: Set<string>
): void {
  for (const nested of descriptor.nestedType ?? []) {
    if (nested.options?.mapEntry) continue
    const nestedKey = `${parentKey}.${nested.name}`
    typeKeys.add(nestedKey)
    messageTypes[nestedKey] = nested
    collectNestedTypes(nestedKey, nested, messageTypes, typeKeys)
  }
  for (const nestedEnum of descriptor.enumType ?? []) {
    typeKeys.add(`${parentKey}.${nestedEnum.name}`)
  }
}

// Resolve a field's type reference the way protoc does: absolute names (leading dot)
// as-is, relative names against each enclosing scope from the innermost outwards.
// typeKeys holds messages and enums, so an enum shadows an equally named message further out.
function resolveTypeName(typeName: string, scope: string, typeKeys: Set<string>): string | null {
  if (typeName.startsWith('.')) {
    const absolute = typeName.substring(1)
    return typeKeys.has(absolute) ? absolute : null
  }

  const scopeParts = scope.split('.')
  for (let i = scopeParts.length; i >= 0; i--) {
    const candidate = [...scopeParts.slice(0, i), typeName].join('.')
    if (typeKeys.has(candidate)) return candidate
  }
  return null
}

// A method's request type only carries its short name, so pick the message with that
// name whose descriptor matches; both are generated from the same protobufjs type.
function findRequestTypeKey(requestType: any, messageTypes: Record<string, any>): string | null {
  const name = requestType.type?.name || requestType.name
  const candidates = Object.keys(messageTypes).filter((k) => k === name || k.endsWith(`.${name}`))
  if (candidates.length <= 1) return candidates[0] ?? null

  const descriptor = JSON.stringify(requestType.type)
  return candidates.find((k) => JSON.stringify(messageTypes[k]) === descriptor) ?? null
}

function resolveFieldsRecursive(
  messageKey: string,
  messageTypes: Record<string, any>,
  typeKeys: Set<string>,
  visited: Set<string> = new Set()
): any[] {
  const fields = messageTypes[messageKey]?.field
  if (!fields) return []

  return fields.map((field) => {
    if (field.typeName) {
      const typeKey = resolveTypeName(field.typeName, messageKey, typeKeys)

      // Enums resolve to a type key too, but only messages get nested fields
      if (typeKey && messageTypes[typeKey]) {
        if (visited.has(typeKey) || visited.size > 15) {
          return {
            ...field,
            fields: []
          }
        }
        const nextVisited = new Set(visited)
        nextVisited.add(typeKey)
        return {
          ...field,
          fields: resolveFieldsRecursive(typeKey, messageTypes, typeKeys, nextVisited)
        }
      }
    }
    return field
  })
}

export function parsePackageDefinition(packageDefinition: any): ProtoPackage[] {
  const packagesMap: Record<string, ProtoPackage> = {}

  // First, collect all named types so field and request types can be resolved
  const messageTypes: Record<string, any> = {}
  const typeKeys = new Set<string>()
  for (const [key, value] of Object.entries(packageDefinition)) {
    const def = value as any
    if (def && typeof def.format === 'string') {
      typeKeys.add(key)
    }
    if (def && def.type && Array.isArray(def.type.field)) {
      messageTypes[key] = def.type
      collectNestedTypes(key, def.type, messageTypes, typeKeys)
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

        const requestTypeKey = findRequestTypeKey(methodDef.requestType, messageTypes)
        const resolvedFields = requestTypeKey
          ? resolveFieldsRecursive(requestTypeKey, messageTypes, typeKeys)
          : null

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

export function getAncestorDirectories(filePath: string): string[] {
  const ancestors: string[] = []
  try {
    let currentDir = path.dirname(filePath)
    while (true) {
      ancestors.push(currentDir)
      const parentDir = path.dirname(currentDir)
      if (parentDir === currentDir) {
        break
      }
      currentDir = parentDir
    }
  } catch (err) {
    console.error('Error getting ancestor directories:', err)
  }
  return ancestors
}

export function parseProtoFile(protoPath: string, importPaths: string[] = []): ProtoPackage[] {
  try {
    const ancestors = getAncestorDirectories(protoPath)
    const resolvedImportPaths = Array.from(new Set([...importPaths, ...ancestors]))

    const packageDefinition = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: resolvedImportPaths
    })

    return parsePackageDefinition(packageDefinition)
  } catch (error) {
    console.error('Failed to parse proto file:', error)
    throw error
  }
}
