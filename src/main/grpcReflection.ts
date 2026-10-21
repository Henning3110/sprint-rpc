import * as grpc from '@grpc/grpc-js'
import { GrpcReflection } from 'grpc-js-reflection-client'
import { parseProtoRoots } from './protoParser'
import { ProtoPackage } from '../renderer/src/store/useGrpcStore'

export interface ReflectionResult {
  packages: ProtoPackage[]
  packageDefinition: any
}

/**
 * Connects to a gRPC server, performs Server Reflection,
 * and compiles the discovered services/messages into a unified PackageDefinition.
 */
export async function fetchServicesAndPackagesFromReflection(
  host: string
): Promise<ReflectionResult> {
  try {
    // 1. Initialize reflection client (insecure connection by default)
    const credentials = grpc.credentials.createInsecure()
    const reflectionClient = new GrpcReflection(host, credentials)

    // 2. Query available service symbols from the server
    const allServices = await reflectionClient.listServices()

    // 3. Filter out internal gRPC reflection services
    const userServices = allServices.filter((service) => !service.startsWith('grpc.reflection.'))

    if (userServices.length === 0) {
      throw new Error('No user-defined gRPC services were discovered on this server.')
    }

    const masterPackageDefinition: any = {}
    const roots: any[] = []

    // 4. Retrieve descriptors for each service in parallel and merge their package definitions
    const descriptorResults = await Promise.all(
      userServices.map(async (serviceName) => {
        try {
          const descriptor = await reflectionClient.getDescriptorBySymbol(serviceName)
          return {
            packageDefinition: descriptor.getPackageDefinition(),
            root: descriptor.getProtobufJsRoot()
          }
        } catch (err: any) {
          console.warn(`Failed to fetch descriptor for service ${serviceName}:`, err.message)
          return null
        }
      })
    )

    for (const result of descriptorResults) {
      if (result) {
        Object.assign(masterPackageDefinition, result.packageDefinition)
        roots.push(result.root)
      }
    }

    if (Object.keys(masterPackageDefinition).length === 0) {
      throw new Error('Failed to retrieve descriptors for any of the discovered services.')
    }

    // 5. Parse the resolved protobuf.js roots into the frontend package structure
    const packages = parseProtoRoots(roots)

    return {
      packages,
      packageDefinition: masterPackageDefinition
    }
  } catch (error: any) {
    console.error('gRPC Server Reflection failed:', error)
    throw new Error(error.message || 'Unknown reflection error')
  }
}
