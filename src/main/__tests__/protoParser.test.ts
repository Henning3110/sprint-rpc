import { describe, test, expect } from 'vitest'
import * as path from 'path'
import { parsePackageDefinition, getAncestorDirectories, parseProtoFile } from '../protoParser'

const fixture = (name: string): string => path.resolve(__dirname, 'fixtures', name)

const findMethod = (packages: any[], methodName: string): any =>
  packages
    .flatMap((p) => p.services)
    .flatMap((s) => s.methods)
    .find((m) => m.name === methodName)

describe('gRPC Protobuf Schema Parser Unit Tests', () => {
  test('should parse unary services and methods successfully', () => {
    const mockPackageDefinition = {
      'helloworld.Greeter': {
        SayHello: {
          path: '/helloworld.Greeter/SayHello',
          requestStream: false,
          responseStream: false,
          requestType: {
            name: 'HelloRequest',
            type: { name: 'HelloRequest' }
          },
          responseType: {
            name: 'HelloReply',
            type: { name: 'HelloReply' }
          }
        }
      }
    }

    const result = parsePackageDefinition(mockPackageDefinition)

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('helloworld')
    expect(result[0].services).toHaveLength(1)

    const service = result[0].services[0]
    expect(service.name).toBe('Greeter')
    expect(service.fullName).toBe('helloworld.Greeter')
    expect(service.methods).toHaveLength(1)

    const method = service.methods[0]
    expect(method.name).toBe('SayHello')
    expect(method.fullName).toBe('helloworld.Greeter/SayHello')
    expect(method.requestStream).toBe(false)
    expect(method.responseStream).toBe(false)
    expect(method.requestType).toBe('HelloRequest')
    expect(method.responseType).toBe('HelloReply')
  })

  test('should parse streaming RPC classifications correctly', () => {
    const mockPackageDefinition = {
      'streaming.StreamService': {
        ServerSideStream: {
          path: '/streaming.StreamService/ServerSideStream',
          requestStream: false,
          responseStream: true,
          requestType: {
            name: 'StreamRequest',
            type: { name: 'StreamRequest' }
          },
          responseType: {
            name: 'StreamReply',
            type: { name: 'StreamReply' }
          }
        },
        ClientSideStream: {
          path: '/streaming.StreamService/ClientSideStream',
          requestStream: true,
          responseStream: false,
          requestType: {
            name: 'StreamRequest',
            type: { name: 'StreamRequest' }
          },
          responseType: {
            name: 'StreamReply',
            type: { name: 'StreamReply' }
          }
        },
        BidiStream: {
          path: '/streaming.StreamService/BidiStream',
          requestStream: true,
          responseStream: true,
          requestType: {
            name: 'StreamRequest',
            type: { name: 'StreamRequest' }
          },
          responseType: {
            name: 'StreamReply',
            type: { name: 'StreamReply' }
          }
        }
      }
    }

    const result = parsePackageDefinition(mockPackageDefinition)
    expect(result).toHaveLength(1)

    const methods = result[0].services[0].methods
    expect(methods).toHaveLength(3)

    const serverStream = methods.find((m) => m.name === 'ServerSideStream')!
    expect(serverStream.requestStream).toBe(false)
    expect(serverStream.responseStream).toBe(true)

    const clientStream = methods.find((m) => m.name === 'ClientSideStream')!
    expect(clientStream.requestStream).toBe(true)
    expect(clientStream.responseStream).toBe(false)

    const bidiStream = methods.find((m) => m.name === 'BidiStream')!
    expect(bidiStream.requestStream).toBe(true)
    expect(bidiStream.responseStream).toBe(true)
  })

  test('should extract request message fields for automatic JSON template generation', () => {
    const mockPackageDefinition = {
      'sample.UserService': {
        CreateUser: {
          path: '/sample.UserService/CreateUser',
          requestStream: false,
          responseStream: false,
          requestType: {
            name: 'CreateUserRequest',
            type: { name: 'CreateUserRequest' }
          },
          responseType: {
            name: 'CreateUserResponse',
            type: { name: 'CreateUserResponse' }
          }
        }
      },
      // Mimic descriptor details returned by proto-loader for fields resolution
      'sample.CreateUserRequest': {
        format: 'DescriptorProto',
        type: {
          field: [
            { name: 'username', type: 'string', repeated: false },
            { name: 'age', type: 'int32', repeated: false },
            { name: 'roles', type: 'string', repeated: true }
          ]
        }
      }
    }

    const result = parsePackageDefinition(mockPackageDefinition)
    const method = result[0].services[0].methods[0]

    expect(method.requestFields).toBeDefined()
    expect(method.requestFields).toHaveLength(3)

    const usernameField = method.requestFields.find((f: any) => f.name === 'username')
    expect(usernameField.type).toBe('string')
    expect(usernameField.repeated).toBe(false)

    const rolesField = method.requestFields.find((f: any) => f.name === 'roles')
    expect(rolesField.type).toBe('string')
    expect(rolesField.repeated).toBe(true)
  })

  test('should group multiple services in the same package together', () => {
    const mockPackageDefinition = {
      'org.company.Billing': {
        Charge: {
          path: '/org.company.Billing/Charge',
          requestStream: false,
          responseStream: false,
          requestType: { name: 'ChargeRequest', type: { name: 'ChargeRequest' } },
          responseType: { name: 'ChargeResponse', type: { name: 'ChargeResponse' } }
        }
      },
      'org.company.Inventory': {
        CheckStock: {
          path: '/org.company.Inventory/CheckStock',
          requestStream: false,
          responseStream: false,
          requestType: { name: 'CheckRequest', type: { name: 'CheckRequest' } },
          responseType: { name: 'CheckResponse', type: { name: 'CheckResponse' } }
        }
      }
    }

    const result = parsePackageDefinition(mockPackageDefinition)

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('org.company')
    expect(result[0].services).toHaveLength(2)

    const serviceNames = result[0].services.map((s) => s.name)
    expect(serviceNames).toContain('Billing')
    expect(serviceNames).toContain('Inventory')
  })

  test('should recursively parse submessages and check nested fields resolution', () => {
    const mockPackageDefinition = {
      'sample.UserService': {
        CreateUser: {
          path: '/sample.UserService/CreateUser',
          requestStream: false,
          responseStream: false,
          requestType: {
            name: 'CreateUserRequest',
            type: { name: 'CreateUserRequest' }
          },
          responseType: {
            name: 'CreateUserResponse',
            type: { name: 'CreateUserResponse' }
          }
        }
      },
      'sample.CreateUserRequest': {
        format: 'DescriptorProto',
        type: {
          field: [
            { name: 'username', type: 'string', repeated: false },
            { name: 'address', type: 'TYPE_MESSAGE', typeName: 'Address', repeated: false }
          ]
        }
      },
      'sample.Address': {
        format: 'DescriptorProto',
        type: {
          field: [
            { name: 'street', type: 'string', repeated: false },
            { name: 'zip', type: 'int32', repeated: false }
          ]
        }
      }
    }

    const result = parsePackageDefinition(mockPackageDefinition)
    const method = result[0].services[0].methods[0]

    expect(method.requestFields).toBeDefined()
    expect(method.requestFields).toHaveLength(2)

    const addressField = method.requestFields.find((f: any) => f.name === 'address')
    expect(addressField).toBeDefined()
    expect(addressField.fields).toBeDefined()
    expect(addressField.fields).toHaveLength(2)

    const streetField = addressField.fields.find((f: any) => f.name === 'street')
    expect(streetField).toBeDefined()
    expect(streetField.type).toBe('string')
  })

  test('should not confuse request types whose names share a suffix', () => {
    const packages = parseProtoFile(fixture('users.proto'))

    const getUser = findMethod(packages, 'GetUser')
    expect(getUser.requestFields.map((f: any) => f.name)).toEqual(['id', 'include_deleted'])

    const createUser = findMethod(packages, 'CreateUser')
    expect(createUser.requestFields.map((f: any) => f.name)).toEqual(['name', 'age'])
  })

  test('should resolve same-named request types from different packages', () => {
    const packages = parseProtoFile(fixture('shop.proto'))

    const updateUser = findMethod(packages, 'UpdateUser')
    expect(updateUser.requestFields.map((f: any) => f.name)).toEqual([
      'name',
      'address',
      'status',
      'inner',
      'tags'
    ])

    const updateOtherUser = findMethod(packages, 'UpdateOtherUser')
    expect(updateOtherUser.requestFields.map((f: any) => f.name)).toEqual(['id'])

    const updateInner = findMethod(packages, 'UpdateInner')
    expect(updateInner.requestFields.map((f: any) => f.name)).toEqual(['n'])
  })

  test('should resolve relative field types against the enclosing scope', () => {
    const packages = parseProtoFile(fixture('shop.proto'))
    const fields = findMethod(packages, 'UpdateUser').requestFields

    const address = fields.find((f: any) => f.name === 'address')
    expect(address.fields.map((f: any) => f.name)).toEqual(['street'])

    const inner = fields.find((f: any) => f.name === 'inner')
    expect(inner.fields.map((f: any) => f.name)).toEqual(['n'])

    // shop.v1.Status is an enum and must not pick up the other.v1.Status message
    const status = fields.find((f: any) => f.name === 'status')
    expect(status.fields).toBeUndefined()

    // Map fields are filled as plain objects, not as their synthetic entry messages
    const tags = fields.find((f: any) => f.name === 'tags')
    expect(tags.fields).toBeUndefined()
  })

  test('should resolve fully qualified field types from reflection descriptors', () => {
    // Descriptors compiled by protoc carry absolute type names with a leading dot
    const mockPackageDefinition = {
      'shop.v1.Shop': {
        UpdateUser: {
          path: '/shop.v1.Shop/UpdateUser',
          requestStream: false,
          responseStream: false,
          requestType: { name: 'User', type: { name: 'User' } },
          responseType: { name: 'User', type: { name: 'User' } }
        }
      },
      'shop.v1.User': {
        format: 'Protocol Buffer 3 DescriptorProto',
        type: {
          name: 'User',
          field: [
            { name: 'address', type: 'TYPE_MESSAGE', typeName: '.shop.v1.Address' },
            { name: 'status', type: 'TYPE_ENUM', typeName: '.shop.v1.Status' }
          ]
        }
      },
      'shop.v1.Address': {
        format: 'Protocol Buffer 3 DescriptorProto',
        type: { name: 'Address', field: [{ name: 'street', type: 'TYPE_STRING' }] }
      },
      'shop.v1.Status': {
        format: 'Protocol Buffer 3 EnumDescriptorProto',
        type: { name: 'Status', value: [{ name: 'UNKNOWN', number: 0 }] }
      },
      'other.v1.Status': {
        format: 'Protocol Buffer 3 DescriptorProto',
        type: { name: 'Status', field: [{ name: 'reason', type: 'TYPE_STRING' }] }
      }
    }

    const result = parsePackageDefinition(mockPackageDefinition)
    const fields = findMethod(result, 'UpdateUser').requestFields

    const address = fields.find((f: any) => f.name === 'address')
    expect(address.fields.map((f: any) => f.name)).toEqual(['street'])

    const status = fields.find((f: any) => f.name === 'status')
    expect(status.fields).toBeUndefined()
  })

  test('should generate ancestor directories list correctly', () => {
    const testPath = path.resolve(__dirname, 'mock/proto/v1/service.proto')
    const result = getAncestorDirectories(testPath)

    const expectedParent = path.resolve(__dirname, 'mock/proto/v1')
    const expectedAncestor = path.resolve(__dirname, 'mock/proto')
    const expectedRepoRoot = path.resolve(__dirname, '../..')

    expect(result).toContain(expectedParent)
    expect(result).toContain(expectedAncestor)
    expect(result).toContain(expectedRepoRoot)
    expect(result[0]).toBe(expectedParent)
  })
})
