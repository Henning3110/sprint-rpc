import { describe, test, expect } from 'vitest'
import * as path from 'path'
import * as protobuf from 'protobufjs'
import { FileDescriptorSet } from 'protobufjs/ext/descriptor'
import { parseProtoRoots, getAncestorDirectories, parseProtoFile } from '../protoParser'

const fixture = (name: string): string => path.resolve(__dirname, 'fixtures', name)

const parseSource = (source: string): any[] =>
  parseProtoRoots([protobuf.parse(source, { keepCase: true }).root])

const findMethod = (packages: any[], methodName: string, serviceName?: string): any =>
  packages
    .flatMap((p) => p.services)
    .filter((s) => !serviceName || s.name === serviceName)
    .flatMap((s) => s.methods)
    .find((m) => m.name === methodName)

const findField = (fields: any[], name: string): any => fields.find((f: any) => f.name === name)

const fieldNames = (fields: any[]): string[] => fields.map((f: any) => f.name)

describe('gRPC Protobuf Schema Parser Unit Tests', () => {
  test('should parse unary services and methods successfully', () => {
    const result = parseSource(`
      syntax = "proto3";
      package helloworld;
      message HelloRequest {}
      message HelloReply {}
      service Greeter {
        rpc SayHello(HelloRequest) returns (HelloReply);
      }
    `)

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
    const result = parseSource(`
      syntax = "proto3";
      package streaming;
      message StreamRequest {}
      message StreamReply {}
      service StreamService {
        rpc ServerSideStream(StreamRequest) returns (stream StreamReply);
        rpc ClientSideStream(stream StreamRequest) returns (StreamReply);
        rpc BidiStream(stream StreamRequest) returns (stream StreamReply);
      }
    `)
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
    const result = parseSource(`
      syntax = "proto3";
      package sample;
      message CreateUserRequest {
        string username = 1;
        int32 age = 2;
        repeated string roles = 3;
      }
      message CreateUserResponse {}
      service UserService {
        rpc CreateUser(CreateUserRequest) returns (CreateUserResponse);
      }
    `)
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
    const result = parseSource(`
      syntax = "proto3";
      package org.company;
      message ChargeRequest {}
      message ChargeResponse {}
      message CheckRequest {}
      message CheckResponse {}
      service Billing {
        rpc Charge(ChargeRequest) returns (ChargeResponse);
      }
      service Inventory {
        rpc CheckStock(CheckRequest) returns (CheckResponse);
      }
    `)

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('org.company')
    expect(result[0].services).toHaveLength(2)

    const serviceNames = result[0].services.map((s) => s.name)
    expect(serviceNames).toContain('Billing')
    expect(serviceNames).toContain('Inventory')
  })

  test('should recursively parse submessages and check nested fields resolution', () => {
    const result = parseSource(`
      syntax = "proto3";
      package sample;
      message CreateUserRequest {
        string username = 1;
        Address address = 2;
      }
      message Address {
        string street = 1;
        int32 zip = 2;
      }
      message CreateUserResponse {}
      service UserService {
        rpc CreateUser(CreateUserRequest) returns (CreateUserResponse);
      }
    `)
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
    expect(fieldNames(getUser.requestFields)).toEqual(['id', 'include_deleted'])

    const createUser = findMethod(packages, 'CreateUser')
    expect(fieldNames(createUser.requestFields)).toEqual(['name', 'age'])
  })

  test('should resolve same-named request types from different packages', () => {
    const packages = parseProtoFile(fixture('shop.proto'))

    const updateUser = findMethod(packages, 'UpdateUser')
    expect(fieldNames(updateUser.requestFields)).toEqual([
      'name',
      'address',
      'status',
      'inner',
      'tags'
    ])

    const updateOtherUser = findMethod(packages, 'UpdateOtherUser')
    expect(fieldNames(updateOtherUser.requestFields)).toEqual(['id'])

    const updateInner = findMethod(packages, 'UpdateInner')
    expect(fieldNames(updateInner.requestFields)).toEqual(['n'])
  })

  test('should resolve relative field types against the enclosing scope', () => {
    const packages = parseProtoFile(fixture('shop.proto'))
    const fields = findMethod(packages, 'UpdateUser').requestFields

    expect(fieldNames(findField(fields, 'address').fields)).toEqual(['street'])
    expect(fieldNames(findField(fields, 'inner').fields)).toEqual(['n'])

    // shop.v1.Status is an enum and must not pick up the other.v1.Status message
    const status = findField(fields, 'status')
    expect(status.type).toBe('enum')
    expect(status.typeName).toBe('.shop.v1.Status')
    expect(status.fields).toBeUndefined()
  })

  test('should resolve same-layout messages to the types of their own package', () => {
    const packages = parseProtoFile(fixture('scopes_b.proto'))

    const aSame = findMethod(packages, 'DoSame', 'A').requestFields
    expect(fieldNames(findField(aSame, 'item').fields)).toEqual(['a_item'])

    const bSame = findMethod(packages, 'DoSame', 'T').requestFields
    expect(fieldNames(findField(bSame, 'item').fields)).toEqual(['b_item'])
  })

  test('should resolve absolute field types past same-named nested types', () => {
    const packages = parseProtoFile(fixture('scopes_a.proto'))
    const fields = findMethod(packages, 'DoReq').requestFields

    const top = findField(findField(fields, 'inner').fields, 'top')
    expect(top.typeName).toBe('.a.Item')
    expect(fieldNames(top.fields)).toEqual(['a_item'])
  })

  test('should fill map fields as plain objects', () => {
    const packages = parseProtoFile(fixture('scopes_a.proto'))
    const fields = findMethod(packages, 'DoReq').requestFields

    // The map entry is named Labels like the unrelated a.Labels message
    const labels = findField(fields, 'labels')
    expect(labels.type).toBe('message')
    expect(labels.typeName).toBe('map<string, string>')
    expect(labels.repeated).toBe(false)
    expect(labels.fields).toBeUndefined()
  })

  test('should report absolute type names and repeated labels', () => {
    const packages = parseProtoFile(fixture('scopes_a.proto'))
    const fields = findMethod(packages, 'DoReq').requestFields

    // FormBuilder shows a datetime picker for exactly this type name
    expect(findField(fields, 'created_at').typeName).toBe('.google.protobuf.Timestamp')
    expect(findField(fields, 'tags').repeated).toBe(true)
  })

  test('should parse roots built from reflection descriptors', () => {
    // Server reflection returns descriptors compiled by protoc with absolute type names
    const descriptorSet = FileDescriptorSet.fromObject({
      file: [
        {
          name: 'a.proto',
          package: 'a',
          syntax: 'proto3',
          messageType: [
            { name: 'Item', field: [{ name: 'a_item', number: 1, type: 'TYPE_STRING' }] },
            {
              name: 'Req',
              field: [
                { name: 'top', number: 1, type: 'TYPE_MESSAGE', typeName: '.a.Item' },
                { name: 'nested', number: 2, type: 'TYPE_MESSAGE', typeName: '.a.Req.Item' }
              ],
              nestedType: [
                { name: 'Item', field: [{ name: 'nested_item', number: 1, type: 'TYPE_STRING' }] }
              ]
            }
          ],
          service: [
            { name: 'A', method: [{ name: 'DoReq', inputType: '.a.Req', outputType: '.a.Req' }] }
          ]
        }
      ]
    })
    const fromDescriptor = (protobuf.Root as any).fromDescriptor

    // Reflection yields one root per service, each containing the whole file
    const packages = parseProtoRoots([fromDescriptor(descriptorSet), fromDescriptor(descriptorSet)])
    expect(packages).toHaveLength(1)
    expect(packages[0].services).toHaveLength(1)

    const fields = findMethod(packages, 'DoReq').requestFields
    expect(fieldNames(findField(fields, 'top').fields)).toEqual(['a_item'])
    expect(fieldNames(findField(fields, 'nested').fields)).toEqual(['nested_item'])
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
