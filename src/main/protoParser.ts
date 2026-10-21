import * as fs from 'fs'
import * as path from 'path'
import * as protobuf from 'protobufjs'
import { ProtoPackage, ProtoService, ProtoMethod } from '../renderer/src/store/useGrpcStore'

// Reflection roots come from this protobufjs and from the separate copy bundled with
// grpc-js-reflection-client, so objects are told apart by shape instead of instanceof.
function isNamespace(obj: protobuf.ReflectionObject): obj is protobuf.Namespace {
  return 'nestedArray' in obj
}

function isService(obj: protobuf.ReflectionObject): obj is protobuf.Service {
  return 'methods' in obj
}

function isMessageType(obj: protobuf.ReflectionObject): obj is protobuf.Type {
  return 'fields' in obj
}

function toFormField(field: protobuf.Field, visited: Set<string>): any {
  if (field.map) {
    // Maps are filled as plain objects, so they get no nested fields
    const { keyType } = field as unknown as protobuf.MapField
    const valueType = field.resolvedType ? field.resolvedType.fullName.substring(1) : field.type
    return {
      name: field.name,
      type: 'message',
      typeName: `map<${keyType}, ${valueType}>`,
      repeated: false
    }
  }

  const resolvedType = field.resolvedType
  if (!resolvedType) {
    return { name: field.name, type: field.type, repeated: field.repeated }
  }

  // fullName is absolute with a leading dot, e.g. .google.protobuf.Timestamp
  const typeName = resolvedType.fullName
  if (!isMessageType(resolvedType)) {
    return { name: field.name, type: 'enum', typeName, repeated: field.repeated }
  }

  if (visited.has(typeName) || visited.size > 15) {
    return { name: field.name, type: 'message', typeName, repeated: field.repeated, fields: [] }
  }
  const nextVisited = new Set(visited)
  nextVisited.add(typeName)
  return {
    name: field.name,
    type: 'message',
    typeName,
    repeated: field.repeated,
    fields: toFormFields(resolvedType, nextVisited)
  }
}

function toFormFields(type: protobuf.Type, visited: Set<string> = new Set()): any[] {
  return type.fieldsArray.map((field) => toFormField(field, visited))
}

function collectServices(
  namespace: protobuf.Namespace,
  services: Map<string, protobuf.Service>
): void {
  for (const nested of namespace.nestedArray) {
    if (isService(nested) && !services.has(nested.fullName)) {
      services.set(nested.fullName, nested)
    }
    if (isNamespace(nested)) {
      collectServices(nested, services)
    }
  }
}

export function parseProtoRoots(roots: protobuf.Root[]): ProtoPackage[] {
  const packagesMap: Record<string, ProtoPackage> = {}

  // Services are deduplicated by name, since reflection returns one root per service
  // and each of them also contains the other services of the same file
  const services = new Map<string, protobuf.Service>()
  for (const root of roots) {
    root.resolveAll()
    collectServices(root, services)
  }

  for (const service of services.values()) {
    const key = service.fullName.substring(1)
    const lastDotIndex = key.lastIndexOf('.')
    const packageName = lastDotIndex !== -1 ? key.substring(0, lastDotIndex) : 'default'
    const serviceName = lastDotIndex !== -1 ? key.substring(lastDotIndex + 1) : key

    if (!packagesMap[packageName]) {
      packagesMap[packageName] = {
        name: packageName,
        services: []
      }
    }

    const methods: ProtoMethod[] = service.methodsArray.map((method) => {
      const requestType = method.resolvedRequestType as protobuf.Type
      const responseType = method.resolvedResponseType as protobuf.Type
      return {
        name: method.name,
        fullName: `${key}/${method.name}`,
        requestType: requestType.name,
        responseType: responseType.name,
        requestStream: Boolean(method.requestStream),
        responseStream: Boolean(method.responseStream),
        requestFields: toFormFields(requestType)
      }
    })

    const protoService: ProtoService = {
      name: serviceName,
      fullName: key,
      methods
    }

    packagesMap[packageName].services.push(protoService)
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

// Resolves imports against the include dirs the same way @grpc/proto-loader does,
// so the parsed schema matches the one the call is executed with
function loadProtoRoot(protoPath: string, includeDirs: string[]): protobuf.Root {
  const root = new protobuf.Root()
  const originalResolvePath = root.resolvePath
  root.resolvePath = (origin, target) => {
    if (path.isAbsolute(target)) return target
    for (const directory of includeDirs) {
      const fullPath = path.join(directory, target)
      if (fs.existsSync(fullPath)) return fullPath
    }
    return originalResolvePath(origin, target)
  }
  return root.loadSync(protoPath, { keepCase: true })
}

export function parseProtoFile(protoPath: string, importPaths: string[] = []): ProtoPackage[] {
  try {
    const ancestors = getAncestorDirectories(protoPath)
    const resolvedImportPaths = Array.from(new Set([...importPaths, ...ancestors]))

    const root = loadProtoRoot(protoPath, resolvedImportPaths)
    return parseProtoRoots([root])
  } catch (error) {
    console.error('Failed to parse proto file:', error)
    throw error
  }
}
