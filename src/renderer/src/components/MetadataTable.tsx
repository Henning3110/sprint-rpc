import {
  Box,
  Button,
  Checkbox,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Input
} from '@mui/material'
import { Add, Delete } from '@mui/icons-material'
import { useGrpcStore } from '../store/useGrpcStore'

export default function MetadataTable() {
  const { metadata, addMetadata, updateMetadata, deleteMetadata } = useGrpcStore()

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TableContainer sx={{ maxHeight: 'calc(100% - 50px)', overflowY: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" sx={{ backgroundColor: '#161920' }}></TableCell>
              <TableCell
                sx={{ backgroundColor: '#161920', color: 'text.secondary', fontWeight: 600 }}
              >
                Key
              </TableCell>
              <TableCell
                sx={{ backgroundColor: '#161920', color: 'text.secondary', fontWeight: 600 }}
              >
                Value
              </TableCell>
              <TableCell padding="checkbox" sx={{ backgroundColor: '#161920' }}></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {metadata.map((item, index) => (
              <TableRow key={index} hover sx={{ '&:hover .delete-btn': { opacity: 1 } }}>
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    checked={item.enabled}
                    onChange={(e) => updateMetadata(index, 'enabled', e.target.checked)}
                  />
                </TableCell>
                <TableCell sx={{ py: 0.5, borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
                  <Input
                    disableUnderline
                    placeholder="e.g. authorization"
                    value={item.key}
                    onChange={(e) => updateMetadata(index, 'key', e.target.value)}
                    fullWidth
                    sx={{
                      fontSize: '0.875rem',
                      fontFamily: 'monospace',
                      py: 0.4,
                      color: 'text.primary'
                    }}
                  />
                </TableCell>
                <TableCell sx={{ py: 0.5, borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
                  <Input
                    disableUnderline
                    placeholder="e.g. Bearer token"
                    value={item.value}
                    onChange={(e) => updateMetadata(index, 'value', e.target.value)}
                    fullWidth
                    sx={{
                      fontSize: '0.875rem',
                      fontFamily: 'monospace',
                      py: 0.4,
                      color: 'text.primary'
                    }}
                  />
                </TableCell>
                <TableCell padding="checkbox" sx={{ py: 0.5 }}>
                  <IconButton
                    className="delete-btn"
                    size="small"
                    color="error"
                    onClick={() => deleteMetadata(index)}
                    sx={{
                      opacity: 0.6,
                      transition: 'opacity 0.2s',
                      '&:hover': { color: 'error.main' }
                    }}
                  >
                    <Delete sx={{ fontSize: 18 }} />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<Add />}
          onClick={addMetadata}
          sx={{
            borderColor: 'rgba(148, 163, 184, 0.2)',
            color: 'text.secondary',
            '&:hover': {
              borderColor: 'rgba(148, 163, 184, 0.4)',
              backgroundColor: 'rgba(148, 163, 184, 0.04)'
            }
          }}
        >
          Add Metadata Key
        </Button>
      </Box>
    </Box>
  )
}
