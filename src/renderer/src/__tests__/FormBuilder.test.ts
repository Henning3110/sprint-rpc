import { describe, test, expect } from 'vitest'
import {
  getFieldInputType,
  getDeepValue,
  setDeepValue,
  deleteDeepValue
} from '../components/FormBuilder'

describe('FormBuilder dynamic field mapping and state helpers', () => {
  describe('getFieldInputType - Field Mapping Rules', () => {
    test('should map strings and bytes to text input', () => {
      expect(getFieldInputType({ name: 'name', type: 'string' })).toBe('text')
      expect(getFieldInputType({ name: 'data', type: 'bytes' })).toBe('text')
    })

    test('should map booleans to switch input', () => {
      expect(getFieldInputType({ name: 'isActive', type: 'bool' })).toBe('switch')
    })

    test('should map all protobuf integer types to integer input', () => {
      const integerTypes = [
        'int32',
        'int64',
        'uint32',
        'uint64',
        'sint32',
        'sint64',
        'fixed32',
        'fixed64',
        'sfixed32',
        'sfixed64'
      ]
      for (const type of integerTypes) {
        expect(getFieldInputType({ name: 'val', type })).toBe('integer')
      }
    })

    test('should map float and double types to decimal input', () => {
      expect(getFieldInputType({ name: 'price', type: 'float' })).toBe('decimal')
      expect(getFieldInputType({ name: 'ratio', type: 'double' })).toBe('decimal')
    })

    test('should map google.protobuf.Timestamp to datetime input', () => {
      expect(
        getFieldInputType({
          name: 'createdAt',
          type: 'message',
          typeName: '.google.protobuf.Timestamp'
        })
      ).toBe('datetime')
    })

    test('should map types with fields defined to message inputs', () => {
      expect(
        getFieldInputType({
          name: 'address',
          type: 'message',
          fields: [{ name: 'street', type: 'string' }]
        })
      ).toBe('message')
    })
  })

  describe('State helpers (getDeepValue & setDeepValue)', () => {
    test('should retrieve values deeply and safely', () => {
      const state = {
        name: 'John',
        address: {
          city: 'Berlin',
          zip: 10115
        },
        tags: ['admin', 'user'],
        nestedArray: [
          { key: 'a', val: 1 },
          { key: 'b', val: 2 }
        ]
      }

      expect(getDeepValue(state, ['name'])).toBe('John')
      expect(getDeepValue(state, ['address', 'city'])).toBe('Berlin')
      expect(getDeepValue(state, ['tags', 1])).toBe('user')
      expect(getDeepValue(state, ['nestedArray', 0, 'val'])).toBe(1)
      expect(getDeepValue(state, ['nonExistent', 'path'])).toBeUndefined()
    })

    test('should modify values deeply and immutably', () => {
      const state = {
        name: 'John',
        address: {
          city: 'Berlin'
        },
        tags: ['admin']
      }

      // 1. Modify top-level
      const state1 = setDeepValue(state, ['name'], 'Alice')
      expect(state1.name).toBe('Alice')
      expect(state1.address).toBe(state.address) // Reference unchanged for untouched branches

      // 2. Modify nested object
      const state2 = setDeepValue(state, ['address', 'city'], 'Hamburg')
      expect(state2.address.city).toBe('Hamburg')
      expect(state2.name).toBe('John')
      expect(state.address.city).toBe('Berlin') // Original remains pristine

      // 3. Modify array item
      const state3 = setDeepValue(state, ['tags', 0], 'super-admin')
      expect(state3.tags[0]).toBe('super-admin')
      expect(state.tags[0]).toBe('admin') // Original array untouched

      // 4. Create paths if they do not exist
      const state4 = setDeepValue(state, ['profile', 'avatar', 'url'], 'http://image')
      expect(state4.profile.avatar.url).toBe('http://image')
    })
  })

  describe('deleteDeepValue helper', () => {
    test('should delete keys deeply and immutably', () => {
      const state = {
        name: 'John',
        address: {
          street: 'Main St',
          city: 'Berlin'
        },
        tags: ['admin', 'user'],
        emptyObj: {}
      }

      // 1. Delete simple top level key
      const state1 = deleteDeepValue(state, ['name'])
      expect(state1.name).toBeUndefined()
      expect(state1.address).toBe(state.address) // Reference untouched

      // 2. Delete nested key (should leave other keys in nested object intact)
      const state2 = deleteDeepValue(state, ['address', 'street'])
      expect(state2.address.street).toBeUndefined()
      expect(state2.address.city).toBe('Berlin')

      // 3. Delete nested key that leaves parent object empty (should recursively clean up parent)
      const stateEmptyAddress = {
        name: 'John',
        address: {
          street: 'Main St'
        }
      }
      const state3 = deleteDeepValue(stateEmptyAddress, ['address', 'street'])
      expect(state3.address).toBeUndefined() // address is removed because it became empty
      expect(state3.name).toBe('John')

      // 4. Delete array element using index
      const state4 = deleteDeepValue(state, ['tags', 0])
      expect(state4.tags).toEqual(['user']) // 'admin' spliced out
      expect(state.tags).toEqual(['admin', 'user']) // Original untouched

      // 5. Deleting nested property in array item should not delete the array item itself
      const stateWithNestedArray = {
        items: [
          { name: 'item1', qty: 5 },
          { name: 'item2', qty: 10 }
        ]
      }
      const state5 = deleteDeepValue(stateWithNestedArray, ['items', 0, 'qty'])
      expect(state5.items[0]).toEqual({ name: 'item1' }) // qty removed, but item object still exists in array
      expect(state5.items[1]).toEqual({ name: 'item2', qty: 10 })
    })
  })
})
