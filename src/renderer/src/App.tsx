import { useEffect, useState, useRef } from 'react'
import {
  Box,
  Typography,
  Tab,
  Tabs,
  Button,
  Chip,
  Paper,
  CircularProgress,
  Tooltip
} from '@mui/material'
import {
  Send,
  Stop,
  Code,
  Input,
  Dns,
  FiberManualRecord,
  KeyboardReturn,
  FolderOpen
} from '@mui/icons-material'
import Editor from '@monaco-editor/react'
import Sidebar from './components/Sidebar'
import MetadataTable from './components/MetadataTable'
import appLogo from '../../../resources/icon.png'
import { FormBuilder } from './components/FormBuilder'
import { useGrpcStore } from './store/useGrpcStore'

export default function App() {
  const {
    host,
    protoPath,
    metadata,
    selectedMethod,
    selectedService,
    payload,
    setPayload,
    loadingResponse,
    setLoadingResponse,
    response,
    setResponse,
    streamLogs,
    addStreamLog,
    clearStreamLogs,
    addHistoryItem
  } = useGrpcStore()

  const [requestTab, setRequestTab] = useState(0)
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null)

  // Track streams for lifecycle cleanup
  const activeStreamIdRef = useRef<string | null>(null)
  useEffect(() => {
    activeStreamIdRef.current = activeStreamId
  }, [activeStreamId])

  // Scroll to bottom of stream console when logs arrive
  const streamConsoleEndRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (streamConsoleEndRef.current) {
      streamConsoleEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [streamLogs])

  // Register Electron IPC stream listeners
  useEffect(() => {
    const removeStreamEvent = window.api.onStreamEvent((eventData: any) => {
      addStreamLog({
        type: eventData.type,
        payload: eventData.payload
      })
    })

    const removeStreamActive = window.api.onStreamActive((eventData: any) => {
      setActiveStreamId(eventData.streamId)
      addStreamLog({
        type: 'status',
        payload: `Stream connection established. ID: ${eventData.streamId}`
      })
    })

    // Cleanup active streams on close/unmount
    return () => {
      removeStreamEvent()
      removeStreamActive()
      if (activeStreamIdRef.current) {
        window.api.endStream(activeStreamIdRef.current)
      }
    }
  }, [])

  const handleSendRequest = async () => {
    if (!selectedMethod || !selectedService) return

    setLoadingResponse(true)
    setResponse(null)
    clearStreamLogs()
    setActiveStreamId(null)

    // For stream calls, add history item immediately or after completion
    const isStream = selectedMethod.requestStream || selectedMethod.responseStream

    const requestOptions = {
      protoPath: protoPath || '',
      importPaths: [],
      host,
      serviceFullName: selectedService.fullName,
      methodName: selectedMethod.name,
      payload: payload,
      metadata: metadata,
      streamId: isStream ? Math.random().toString(36).substring(7) : undefined
    }

    try {
      if (isStream) {
        // Stream initialization (completed via IPC events)
        const res = await window.api.executeRpcCall(requestOptions)
        setResponse(res)

        // Add item to history
        addHistoryItem({
          host,
          methodFullName: selectedMethod.fullName,
          payload,
          metadata,
          response: res
        })
        setLoadingResponse(false)
      } else {
        // Unary call (resolves immediately)
        const res = await window.api.executeRpcCall(requestOptions)
        setResponse(res)

        // Add to history
        addHistoryItem({
          host,
          methodFullName: selectedMethod.fullName,
          payload,
          metadata,
          response: res
        })
        setLoadingResponse(false)
      }
    } catch (e: any) {
      setResponse({
        payload: '',
        status: e.message || 'Internal Error',
        statusCode: 2,
        error: e.message || 'Internal Error'
      })
      setLoadingResponse(false)
    }
  }

  const handleSendStreamChunk = async () => {
    if (!activeStreamId) return

    try {
      await window.api.writeStreamChunk(activeStreamId, payload)
      addStreamLog({
        type: 'request',
        payload: payload
      })
    } catch (e: any) {
      addStreamLog({
        type: 'error',
        payload: `Failed to send chunk: ${e.message}`
      })
    }
  }

  const handleEndStream = async () => {
    if (!activeStreamId) return

    try {
      await window.api.endStream(activeStreamId)
      setActiveStreamId(null)
      addStreamLog({
        type: 'status',
        payload: 'Stream closed locally.'
      })
    } catch (e: any) {
      addStreamLog({
        type: 'error',
        payload: `Failed to end stream: ${e.message}`
      })
    }
  }

  // Handle hotkeys (Cmd+Enter to trigger execution)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (activeStreamId) {
          handleSendStreamChunk()
        } else {
          handleSendRequest()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedMethod, selectedService, payload, host, metadata, activeStreamId])

  // Generate badges for streaming type
  const renderStreamingBadge = () => {
    if (!selectedMethod) return null
    if (selectedMethod.requestStream && selectedMethod.responseStream) {
      return (
        <Chip
          label="Bidirectional Streaming"
          color="secondary"
          variant="outlined"
          size="small"
          sx={{ borderColor: '#ec4899', color: '#ec4899' }}
        />
      )
    }
    if (selectedMethod.requestStream) {
      return (
        <Chip
          label="Client Streaming"
          color="secondary"
          variant="outlined"
          size="small"
          sx={{ borderColor: '#eab308', color: '#eab308' }}
        />
      )
    }
    if (selectedMethod.responseStream) {
      return (
        <Chip
          label="Server Streaming"
          color="secondary"
          variant="outlined"
          size="small"
          sx={{ borderColor: '#10b981', color: '#10b981' }}
        />
      )
    }
    return <Chip label="Unary Call" color="primary" variant="outlined" size="small" />
  }

  return (
    <Box sx={{ display: 'flex', width: '100%', height: '100vh', overflow: 'hidden' }}>
      {/* 1. SIDEBAR */}
      <Sidebar />

      {/* Main Workspace Frame */}
      {selectedMethod ? (
        <Box sx={{ flexGrow: 1, display: 'flex', height: '100%', overflow: 'hidden' }}>
          {/* 2. MIDDLE REQUEST EDITOR PANEL */}
          <Box
            sx={{
              width: '45%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderRight: '1px solid',
              borderColor: 'divider',
              backgroundColor: 'background.default'
            }}
          >
            {/* Request Pane Header */}
            <Box
              sx={{
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                borderBottom: '1px solid',
                borderColor: 'divider'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Code sx={{ fontSize: 20, color: 'primary.main' }} />
                <Typography
                  variant="body2"
                  sx={{ fontFamily: 'monospace', fontWeight: 600, color: 'text.primary' }}
                >
                  {selectedMethod.fullName}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {renderStreamingBadge()}
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Req: {selectedMethod.requestType} • Res: {selectedMethod.responseType}
                </Typography>
              </Box>
            </Box>

            {/* Request Tabs Selection */}
            <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
              <Tabs
                value={requestTab}
                onChange={(_, val) => setRequestTab(val)}
                sx={{ minHeight: 38, height: 38, '& .MuiTab-root': { minHeight: 38, height: 38 } }}
              >
                <Tab label="Form Builder" sx={{ textTransform: 'none', py: 0.5, minHeight: 38 }} />
                <Tab label="Raw JSON" sx={{ textTransform: 'none', py: 0.5, minHeight: 38 }} />
                <Tab label="Metadata" sx={{ textTransform: 'none', py: 0.5, minHeight: 38 }} />
              </Tabs>
            </Box>

            {/* Request Panel Content */}
            <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
              {requestTab === 0 ? (
                <FormBuilder />
              ) : requestTab === 1 ? (
                <Editor
                  height="100%"
                  language="json"
                  theme="vs"
                  value={payload}
                  onChange={(val) => setPayload(val || '')}
                  options={{
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 13,
                    lineNumbers: 'on',
                    fontFamily: 'ui-monospace, Menlo, Monaco, Consolas, monospace',
                    automaticLayout: true,
                    tabSize: 2,
                    padding: { top: 12 }
                  }}
                />
              ) : (
                <MetadataTable />
              )}
            </Box>

            {/* Trigger Button Panel */}
            <Box
              sx={{
                p: 2,
                borderTop: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                gap: 1.5,
                alignItems: 'center',
                backgroundColor: 'background.paper'
              }}
            >
              {activeStreamId ? (
                <>
                  <Button
                    variant="contained"
                    color="secondary"
                    startIcon={<Send />}
                    onClick={handleSendStreamChunk}
                    fullWidth
                  >
                    Send Chunk
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<Stop />}
                    onClick={handleEndStream}
                  >
                    End Stream
                  </Button>
                </>
              ) : (
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<Send />}
                  onClick={handleSendRequest}
                  disabled={loadingResponse}
                  fullWidth
                  sx={{ py: 1 }}
                >
                  {loadingResponse ? <CircularProgress size={20} color="inherit" /> : 'Invoke RPC'}
                </Button>
              )}

              <Tooltip title="Shortcut: Cmd+Enter">
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    px: 1,
                    py: 0.5,
                    borderRadius: 1.5,
                    border: '1px solid rgba(148,163,184,0.15)',
                    color: 'text.secondary'
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.7rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.2
                    }}
                  >
                    ⌘ <KeyboardReturn sx={{ fontSize: 10 }} />
                  </Typography>
                </Box>
              </Tooltip>
            </Box>
          </Box>

          {/* 3. RIGHT RESPONSE PANE */}
          <Box
            sx={{
              width: '55%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'background.default'
            }}
          >
            {/* Header / Stats Info Bar */}
            <Box
              sx={{
                p: 2,
                borderBottom: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'background.paper',
                height: 57
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                RESPONSE PANEL
              </Typography>

              {/* Display Response Metrics */}
              {response && (
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                  {response.statusCode === 0 ? (
                    <Chip
                      label="200 OK"
                      color="success"
                      size="small"
                      sx={{ fontWeight: 700, fontSize: '0.75rem', height: 20 }}
                    />
                  ) : (
                    <Chip
                      label={`Error ${response.statusCode}`}
                      color="error"
                      size="small"
                      sx={{ fontWeight: 700, fontSize: '0.75rem', height: 20 }}
                    />
                  )}

                  {response.duration !== undefined && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                      Duration: {response.duration} ms
                    </Typography>
                  )}
                </Box>
              )}

              {activeStreamId && (
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <FiberManualRecord
                    color="success"
                    sx={{ fontSize: 12, animation: 'pulse 1.5s infinite' }}
                  />
                  <Typography variant="caption" sx={{ color: 'secondary.main', fontWeight: 700 }}>
                    STREAM ACTIVE
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Core Response Render Content */}
            <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
              {selectedMethod.requestStream || selectedMethod.responseStream ? (
                /* --- STREAM CONSOLE LOGGER --- */
                <Box
                  sx={{
                    height: '100%',
                    p: 2,
                    overflowY: 'auto',
                    fontFamily: 'ui-monospace, Menlo, Monaco, Consolas, monospace',
                    fontSize: '0.8rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5
                  }}
                >
                  {streamLogs.length === 0 ? (
                    <Box
                      sx={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        color: 'text.secondary',
                        py: 10
                      }}
                    >
                      <CircularProgress
                        size={24}
                        sx={{ mb: 2, opacity: loadingResponse ? 0.8 : 0 }}
                      />
                      <Typography variant="body2" sx={{ opacity: 0.6 }}>
                        {loadingResponse
                          ? 'Awaiting response stream...'
                          : 'Awaiting streaming invoke...'}
                      </Typography>
                    </Box>
                  ) : (
                    streamLogs.map((log) => {
                      let typeLabel = '← REQUEST'
                      let typeBg = 'rgba(89, 201, 165, 0.15)'
                      let typeColor = '#3fae8b'
                      let displayPayload = log.payload

                      if (log.type === 'response') {
                        typeLabel = '→ RESPONSE'
                        typeBg = 'rgba(46, 64, 87, 0.12)'
                        typeColor = '#2e4057'
                      } else if (log.type === 'status') {
                        typeLabel = 'ℹ STATUS'
                        typeBg = 'rgba(71, 85, 105, 0.1)'
                        typeColor = '#475569'
                      } else if (log.type === 'error') {
                        typeLabel = '⚠ ERROR'
                        typeBg = 'rgba(239, 68, 68, 0.1)'
                        typeColor = '#ef4444'
                      }

                      return (
                        <Box
                          key={log.id}
                          sx={{
                            borderLeft: `3px solid ${typeColor}`,
                            borderRadius: 1,
                            backgroundColor: 'rgba(15, 23, 42, 0.02)',
                            p: 1.2
                          }}
                        >
                          {/* Log Entry Header */}
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              mb: 0.8
                            }}
                          >
                            <Box
                              sx={{
                                px: 1,
                                py: 0.25,
                                borderRadius: 1,
                                backgroundColor: typeBg,
                                color: typeColor,
                                fontSize: '0.65rem',
                                fontWeight: 800
                              }}
                            >
                              {typeLabel}
                            </Box>
                            <Typography variant="caption" sx={{ opacity: 0.4, fontSize: '0.7rem' }}>
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </Typography>
                          </Box>
                          {/* Log Entry Body */}
                          <Box
                            sx={{
                              pl: 0.5,
                              whiteSpace: 'pre-wrap',
                              color: log.type === 'error' ? '#f87171' : 'text.primary',
                              overflowX: 'auto'
                            }}
                          >
                            {displayPayload}
                          </Box>
                        </Box>
                      )
                    })
                  )}
                  <div ref={streamConsoleEndRef} />
                </Box>
              ) : (
                /* --- STANDARD UNARY VIEW --- */
                <Box sx={{ height: '100%' }}>
                  {loadingResponse ? (
                    <Box
                      sx={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        color: 'text.secondary'
                      }}
                    >
                      <CircularProgress size={32} sx={{ mb: 2 }} />
                      <Typography variant="body2" sx={{ opacity: 0.6 }}>
                        Executing Unary call...
                      </Typography>
                    </Box>
                  ) : response ? (
                    response.error ? (
                      <Box sx={{ p: 3, color: 'error.main' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                          RPC Execution Failed
                        </Typography>
                        <Paper
                          sx={{
                            p: 2,
                            border: '1px solid',
                            borderColor: 'error.dark',
                            backgroundColor: 'rgba(239, 68, 68, 0.05)',
                            fontFamily: 'monospace',
                            fontSize: '0.85rem'
                          }}
                        >
                          {response.error}
                        </Paper>
                      </Box>
                    ) : (
                      <Editor
                        height="100%"
                        language="json"
                        theme="vs"
                        value={response.payload}
                        options={{
                          readOnly: true,
                          minimap: { enabled: false },
                          scrollBeyondLastLine: false,
                          fontSize: 13,
                          lineNumbers: 'on',
                          fontFamily: 'ui-monospace, Menlo, Monaco, Consolas, monospace',
                          automaticLayout: true,
                          padding: { top: 12 }
                        }}
                      />
                    )
                  ) : (
                    <Box
                      sx={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        color: 'text.secondary'
                      }}
                    >
                      <Code sx={{ fontSize: 60, opacity: 0.08, mb: 2 }} />
                      <Typography variant="body2" sx={{ opacity: 0.4 }}>
                        Awaiting invoke execution...
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      ) : (
        /* Empty Welcoming Screen */
        <Box
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'background.default', // light welcome background
            p: 4
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              textAlign: 'center',
              maxWidth: 450
            }}
          >
            {/* Premium Icon Badge */}
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '24px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                boxShadow: '0 8px 30px rgba(89, 201, 165, 0.15)',
                mb: 1.5,
                overflow: 'hidden'
              }}
            >
              <img
                src={appLogo}
                alt="SprintRPC Logo"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </Box>

            <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary' }}>
              Welcome to SprintRPC
            </Typography>

            <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
              Just a clean, light-weight and easy native macOS gRPC client designed for fast
              progress.
            </Typography>

            <Paper
              sx={{
                mt: 2,
                p: 2,
                width: '100%',
                borderRadius: 3,
                backgroundColor: 'background.paper',
                border: '1px solid rgba(15, 23, 42, 0.06)',
                textAlign: 'left'
              }}
            >
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, color: 'primary.main', mb: 1, display: 'block' }}
              >
                GETTING STARTED
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                <Typography
                  variant="caption"
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}
                >
                  <Dns sx={{ fontSize: 14 }} /> Specify your target host IP/Domain address above.
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}
                >
                  <FolderOpen sx={{ fontSize: 14 }} /> Click "Import Proto" to load your service
                  schemas.
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}
                >
                  <Input sx={{ fontSize: 14 }} /> Select a method, customize your request, and
                  execute!
                </Typography>
              </Box>
            </Paper>
          </Box>
        </Box>
      )}
    </Box>
  )
}
