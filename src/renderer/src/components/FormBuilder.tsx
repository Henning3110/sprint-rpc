import React from 'react'
import {
  Box,
  TextField,
  Switch,
  FormControlLabel,
  Typography,
  IconButton,
  Button,
  Paper,
  Divider,
  Alert,
  Tooltip
} from '@mui/material'
import { Add, Delete, AccessTime, FolderOpen } from '@mui/icons-material'
import { useGrpcStore } from '../store/useGrpcStore'

// Mappings from proto field descriptor to UI type
export function getFieldInputType(
  field: any
): 'datetime' | 'text' | 'switch' | 'integer' | 'decimal' | 'message' {
  if (field.typeName === '.google.protobuf.Timestamp') {
    return 'datetime'
  }

  let type = field.type
  if (typeof type === 'string') {
    type = type.toLowerCase()
    if (type.startsWith('type_')) {
      type = type.substring(5)
    }
  }

  if (type === 'message' || (field.fields && Array.isArray(field.fields))) {
    return 'message'
  }
  if (type === 'bool') {
    return 'switch'
  }
  if (
    [
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
    ].includes(type)
  ) {
    return 'integer'
  }
  if (['float', 'double'].includes(type)) {
    return 'decimal'
  }
  return 'text'
}

// Immutable nested object/array update helper
export function setDeepValue(obj: any, path: (string | number)[], value: any): any {
  if (path.length === 0) return value
  const key = path[0]
  const newObj = Array.isArray(obj) ? [...obj] : { ...obj }

  if (path.length === 1) {
    newObj[key] = value
  } else {
    newObj[key] = setDeepValue(
      newObj[key] !== undefined ? newObj[key] : typeof path[1] === 'number' ? [] : {},
      path.slice(1),
      value
    )
  }
  return newObj
}

// Immutable nested object/array deletion helper
export function deleteDeepValue(obj: any, path: (string | number)[]): any {
  if (!obj || path.length === 0) return obj
  const key = path[0]
  const newObj = Array.isArray(obj) ? [...obj] : { ...obj }

  if (path.length === 1) {
    if (Array.isArray(newObj)) {
      newObj.splice(key as number, 1)
    } else {
      delete newObj[key]
    }
  } else {
    if (newObj[key] !== undefined) {
      newObj[key] = deleteDeepValue(newObj[key], path.slice(1))
      // Clean up empty objects or arrays recursively
      if (typeof newObj[key] === 'object' && newObj[key] !== null) {
        if (Array.isArray(newObj[key])) {
          if (newObj[key].length === 0 && !Array.isArray(newObj)) {
            delete newObj[key]
          }
        } else if (Object.keys(newObj[key]).length === 0 && !Array.isArray(newObj)) {
          delete newObj[key]
        }
      }
    }
  }
  return newObj
}

// Safe nested value retriever
export function getDeepValue(obj: any, path: (string | number)[]): any {
  let current = obj
  for (const key of path) {
    if (current === undefined || current === null) return undefined
    current = current[key]
  }
  return current
}

// Convert timestamp { seconds, nanos } to local ISO string (YYYY-MM-DDTHH:mm)
function timestampToDatetimeString(val: any): string {
  if (!val || typeof val.seconds !== 'number') {
    const now = new Date()
    const tzOffset = now.getTimezoneOffset() * 60000
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16)
  }
  const ms = val.seconds * 1000 + Math.floor((val.nanos || 0) / 1000000)
  const date = new Date(ms)
  const tzOffset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16)
}

// Convert YYYY-MM-DDTHH:mm back to timestamp { seconds, nanos }
function datetimeStringToTimestamp(str: string) {
  if (!str) return { seconds: 0, nanos: 0 }
  const date = new Date(str)
  return {
    seconds: Math.floor(date.getTime() / 1000),
    nanos: (date.getTime() % 1000) * 1000000
  }
}

// Get default empty value for field initialization
function getDefaultFieldValue(field: any): any {
  if (field.repeated) {
    return []
  }
  const inputType = getFieldInputType(field)
  switch (inputType) {
    case 'switch':
      return false
    case 'integer':
    case 'decimal':
      return 0
    case 'datetime':
      return { seconds: Math.floor(Date.now() / 1000), nanos: 0 }
    case 'message':
      return {}
    case 'text':
    default:
      return ''
  }
}

interface FormFieldProps {
  field: any
  path: (string | number)[]
  parsedPayload: any
  onUpdate: (path: (string | number)[], value: any) => void
}

const FormField: React.FC<FormFieldProps> = ({ field, path, parsedPayload, onUpdate }) => {
  const label = field.name
  const isRepeated = field.repeated
  const inputType = getFieldInputType(field)
  const rawValue = getDeepValue(parsedPayload, path)

  // Handle repeated (Array) fields
  if (isRepeated) {
    const arr = Array.isArray(rawValue) ? rawValue : []

    const handleAdd = () => {
      const defaultValue =
        field.fields && field.fields.length > 0
          ? {}
          : getDefaultFieldValue({ ...field, repeated: false })
      onUpdate(path, [...arr, defaultValue])
    }

    const handleRemove = (index: number) => {
      const newArr = arr.filter((_, i) => i !== index)
      onUpdate(path, newArr)
    }

    return (
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2.5,
          backgroundColor: 'background.default',
          borderLeft: '4px solid #59C9A5',
          borderRadius: '0 8px 8px 0'
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'secondary.main' }}>
              {label}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
              repeated {field.type}
            </Typography>
          </Box>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Add />}
            onClick={handleAdd}
            sx={{
              borderColor: '#59C9A5',
              color: '#59C9A5',
              '&:hover': {
                borderColor: '#3fae8b',
                backgroundColor: 'rgba(89, 201, 165, 0.04)'
              }
            }}
          >
            Add Item
          </Button>
        </Box>
        <Divider sx={{ mb: 1.5 }} />

        {arr.length === 0 ? (
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', display: 'block', py: 1, fontStyle: 'italic' }}
          >
            No items. Click &quot;Add Item&quot; to populate.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {arr.map((_itemValue, idx) => (
              <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <Box sx={{ flexGrow: 1 }}>
                  {inputType === 'message' ? (
                    <Paper
                      elevation={0}
                      sx={{
                        p: 1.5,
                        border: '1px dashed rgba(15, 23, 42, 0.12)',
                        backgroundColor: '#ffffff'
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 600, color: 'text.secondary', mb: 1, display: 'block' }}
                      >
                        Item #{idx + 1}
                      </Typography>
                      {field.fields.map((subField: any) => (
                        <FormField
                          key={subField.name}
                          field={subField}
                          path={[...path, idx, subField.name]}
                          parsedPayload={parsedPayload}
                          onUpdate={onUpdate}
                        />
                      ))}
                    </Paper>
                  ) : (
                    <FormField
                      field={{ ...field, repeated: false, name: `Item #${idx + 1}` }}
                      path={[...path, idx]}
                      parsedPayload={parsedPayload}
                      onUpdate={onUpdate}
                    />
                  )}
                </Box>
                <Tooltip title="Remove Item">
                  <IconButton
                    size="small"
                    onClick={() => handleRemove(idx)}
                    sx={{
                      mt: inputType === 'message' ? 1 : 1.5,
                      color: 'text.secondary',
                      '&:hover': { color: 'error.main', backgroundColor: 'rgba(239, 68, 68, 0.08)' }
                    }}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            ))}
          </Box>
        )}
      </Paper>
    )
  }

  // Handle nested Sub-Messages
  if (inputType === 'message') {
    return (
      <Box
        sx={{
          pl: 2.5,
          borderLeft: '2px solid rgba(46, 64, 87, 0.12)',
          mt: 1.5,
          mb: 2.5,
          position: 'relative'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <FolderOpen sx={{ fontSize: 16, color: 'secondary.light' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'secondary.main' }}>
            {label}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
            {field.typeName}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {field.fields &&
            field.fields.map((subField: any) => (
              <FormField
                key={subField.name}
                field={subField}
                path={[...path, subField.name]}
                parsedPayload={parsedPayload}
                onUpdate={onUpdate}
              />
            ))}
        </Box>
      </Box>
    )
  }

  switch (inputType) {
    case 'switch':
      return (
        <Box sx={{ mb: 1.5 }}>
          <FormControlLabel
            control={
              <Switch
                checked={rawValue !== undefined ? !!rawValue : false}
                onChange={(e) => onUpdate(path, e.target.checked)}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  {label}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', fontFamily: 'monospace' }}
                >
                  bool
                </Typography>
              </Box>
            }
          />
        </Box>
      )

    case 'datetime':
      return (
        <Box sx={{ mb: 2 }}>
          <TextField
            label={label}
            type="datetime-local"
            value={rawValue !== undefined ? timestampToDatetimeString(rawValue) : ''}
            onChange={(e) => {
              if (e.target.value === '') {
                onUpdate(path, '')
              } else {
                onUpdate(path, datetimeStringToTimestamp(e.target.value))
              }
            }}
            fullWidth
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { step: 60 } // Minute steps
            }}
            helperText={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                <AccessTime sx={{ fontSize: 12, color: 'text.secondary' }} />
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', fontFamily: 'monospace' }}
                >
                  google.protobuf.Timestamp (Seconds: {rawValue?.seconds || 0})
                </Typography>
              </Box>
            }
          />
        </Box>
      )

    case 'integer':
      return (
        <Box sx={{ mb: 2 }}>
          <TextField
            label={label}
            type="number"
            value={rawValue !== undefined ? rawValue : ''}
            onChange={(e) => {
              if (e.target.value === '') {
                onUpdate(path, '')
              } else {
                const val = parseInt(e.target.value, 10)
                onUpdate(path, isNaN(val) ? '' : val)
              }
            }}
            slotProps={{
              htmlInput: { step: 1 } // Integer increments only
            }}
            fullWidth
            helperText={
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', fontFamily: 'monospace' }}
              >
                {field.type} (integer)
              </Typography>
            }
          />
        </Box>
      )

    case 'decimal':
      return (
        <Box sx={{ mb: 2 }}>
          <TextField
            label={label}
            type="number"
            value={rawValue !== undefined ? rawValue : ''}
            onChange={(e) => {
              if (e.target.value === '') {
                onUpdate(path, '')
              } else {
                const val = parseFloat(e.target.value)
                onUpdate(path, isNaN(val) ? '' : val)
              }
            }}
            fullWidth
            helperText={
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', fontFamily: 'monospace' }}
              >
                {field.type} (decimal)
              </Typography>
            }
          />
        </Box>
      )

    case 'text':
    default:
      return (
        <Box sx={{ mb: 2 }}>
          <TextField
            label={label}
            value={rawValue !== undefined ? rawValue : ''}
            onChange={(e) => {
              if (e.target.value === '') {
                onUpdate(path, '')
              } else {
                onUpdate(path, e.target.value)
              }
            }}
            fullWidth
            helperText={
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', fontFamily: 'monospace' }}
              >
                {field.type}
              </Typography>
            }
          />
        </Box>
      )
  }
}

export const FormBuilder: React.FC = () => {
  const { selectedMethod, payload, setPayload } = useGrpcStore()

  if (!selectedMethod) return null

  // Safety fallback for empty or completely missing field definitions
  const fields = selectedMethod.requestFields || []
  if (fields.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
          This message has no fields (empty request body).
        </Typography>
      </Box>
    )
  }

  // Parse JSON state
  let parsedPayload: any = {}
  let jsonError = false

  try {
    parsedPayload = JSON.parse(payload || '{}')
  } catch (err) {
    jsonError = true
  }

  if (jsonError) {
    return (
      <Box sx={{ p: 2.5 }}>
        <Alert
          severity="warning"
          sx={{
            borderRadius: 2,
            border: '1px solid rgba(234, 179, 8, 0.3)',
            backgroundColor: '#fefcf0',
            color: '#854d0e',
            '& .MuiAlert-icon': { color: '#ca8a04' }
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Invalid JSON syntax detected
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.825rem' }}>
            The Dynamic Form Builder cannot be loaded because the current payload contains malformed
            JSON. Please switch to the **Raw JSON** tab, correct any syntax errors, and return here.
          </Typography>
        </Alert>
      </Box>
    )
  }

  const handleUpdate = (path: (string | number)[], value: any) => {
    const updated =
      value === '' || value === undefined
        ? deleteDeepValue(parsedPayload, path)
        : setDeepValue(parsedPayload, path, value)
    setPayload(JSON.stringify(updated, null, 2))
  }

  return (
    <Box
      sx={{
        height: '100%',
        overflowY: 'auto',
        p: 2.5,
        backgroundColor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5
      }}
    >
      {fields.map((field: any) => (
        <FormField
          key={field.name}
          field={field}
          path={[field.name]}
          parsedPayload={parsedPayload}
          onUpdate={handleUpdate}
        />
      ))}
    </Box>
  )
}
