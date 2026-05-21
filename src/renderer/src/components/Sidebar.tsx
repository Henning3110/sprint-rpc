import { useState } from 'react'
import {
  Box,
  Typography,
  TextField,
  Button,
  Tabs,
  Tab,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  InputAdornment,
  CircularProgress
} from '@mui/material'
import {
  FolderOpen,
  Folder,
  Settings,
  Search,
  History,
  Dns,
  Input,
  ImportExport,
  ExpandLess,
  ExpandMore
} from '@mui/icons-material'
import { useGrpcStore } from '../store/useGrpcStore'
import appLogo from '../../../../resources/icon.png'

export default function Sidebar() {
  const {
    host,
    setHost,
    packages,
    setPackages,
    loadingProtos,
    setLoadingProtos,
    setProtoPath,
    selectedMethod,
    selectMethod,
    history,
    clearHistory
  } = useGrpcStore()

  const [activeTab, setActiveTab] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedPackages, setExpandedPackages] = useState<Record<string, boolean>>({})
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({})

  const handleExpandAll = () => {
    setExpandedPackages({})
    setExpandedServices({})
  }

  const handleCollapseAll = () => {
    const pkgState: Record<string, boolean> = {}
    const svcState: Record<string, boolean> = {}

    packages.forEach((pkg) => {
      pkgState[pkg.name] = false
      pkg.services.forEach((svc) => {
        svcState[svc.fullName] = false
      })
    })

    setExpandedPackages(pkgState)
    setExpandedServices(svcState)
  }

  const handleImportProto = async () => {
    setLoadingProtos(true)
    try {
      const result = await window.api.selectProtoFile()
      if (result && result.packages) {
        setPackages(result.packages)
        setProtoPath(result.protoPath)
      } else if (result && result.error) {
        alert(`Failed to load Proto: ${result.error}`)
      }
    } catch (e: any) {
      alert(`Error: ${e.message}`)
    } finally {
      setLoadingProtos(false)
    }
  }

  const handleRunReflection = async () => {
    if (!host) {
      alert('Please enter a server address first!')
      return
    }
    setLoadingProtos(true)
    try {
      const result = await window.api.loadServicesByReflection(host)
      if (result && result.packages) {
        setPackages(result.packages)
        setProtoPath('reflection')
      } else if (result && result.error) {
        alert(`Failed to load from server: ${result.error}`)
      }
    } catch (e: any) {
      alert(`Error connecting to server reflection: ${e.message}`)
    } finally {
      setLoadingProtos(false)
    }
  }

  const togglePackage = (pkgName: string) => {
    setExpandedPackages((prev) => ({
      ...prev,
      [pkgName]: prev[pkgName] === false ? true : false
    }))
  }

  const toggleService = (svcName: string) => {
    setExpandedServices((prev) => ({
      ...prev,
      [svcName]: prev[svcName] === false ? true : false
    }))
  }

  // Filter packages -> services -> methods based on search query
  const filteredPackages = packages
    .map((pkg) => {
      const matchingServices = pkg.services
        .map((svc) => {
          const matchingMethods = svc.methods.filter(
            (m) =>
              m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              svc.name.toLowerCase().includes(searchQuery.toLowerCase())
          )
          return { ...svc, methods: matchingMethods }
        })
        .filter((svc) => svc.methods.length > 0)
      return { ...pkg, services: matchingServices }
    })
    .filter((pkg) => pkg.services.length > 0)

  return (
    <Box
      sx={{
        width: 300,
        height: '100%',
        borderRight: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'background.paper' // Light sidebar background
      }}
    >
      {/* Title / App Brand */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}
      >
        <img
          src={appLogo}
          alt="Logo"
          style={{ width: 26, height: 26, borderRadius: 6, objectFit: 'contain' }}
        />
        <Typography
          variant="h6"
          sx={{
            fontWeight: 800,
            background: 'linear-gradient(135deg, #59C9A5 0%, #2e4057 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}
        >
          SprintRPC
        </Typography>
      </Box>

      {/* Connection Host */}
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <TextField
          size="small"
          label="Server Address"
          placeholder="localhost:8080"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          fullWidth
          variant="outlined"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Dns sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              )
            }
          }}
        />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Button
            variant="contained"
            size="small"
            onClick={handleRunReflection}
            startIcon={<ImportExport />}
            fullWidth
            sx={{
              py: 0.8,
              backgroundColor: '#59C9A5',
              color: '#ffffff',
              fontWeight: 700,
              boxShadow: 'none',
              '&:hover': {
                backgroundColor: '#3fae8b',
                boxShadow: 'none'
              }
            }}
          >
            Server Reflection
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={handleImportProto}
            disabled={loadingProtos}
            startIcon={loadingProtos ? <CircularProgress size={16} /> : <FolderOpen />}
            fullWidth
            sx={{
              py: 0.8,
              borderColor: 'rgba(15, 23, 42, 0.12)',
              color: 'text.secondary',
              fontWeight: 600,
              '&:hover': {
                borderColor: '#59C9A5',
                color: '#59C9A5',
                backgroundColor: 'rgba(89, 201, 165, 0.04)'
              }
            }}
          >
            Import Proto File
          </Button>
        </Box>
      </Box>

      {/* Tabs Selector */}
      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          variant="fullWidth"
          sx={{ minHeight: 40, height: 40 }}
        >
          <Tab label="Services" sx={{ py: 1, minHeight: 40 }} />
          <Tab label="History" sx={{ py: 1, minHeight: 40 }} />
        </Tabs>
      </Box>

      {/* Scrollable Content Pane */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 1 }}>
        {activeTab === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* Search */}
            <TextField
              size="small"
              placeholder="Search methods..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              fullWidth
              variant="outlined"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ fontSize: 16, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                  sx: { backgroundColor: 'background.default', borderRadius: 2 }
                }
              }}
            />

            {packages.length > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, px: 0.5, mt: -0.5, mb: 0.5 }}>
                <Button
                  size="small"
                  variant="text"
                  sx={{ fontSize: '0.72rem', py: 0.1, minWidth: 0, textTransform: 'none', color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                  onClick={handleExpandAll}
                >
                  Expand All
                </Button>
                <Typography variant="caption" sx={{ color: 'divider', alignSelf: 'center' }}>|</Typography>
                <Button
                  size="small"
                  variant="text"
                  sx={{ fontSize: '0.72rem', py: 0.1, minWidth: 0, textTransform: 'none', color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                  onClick={handleCollapseAll}
                >
                  Collapse All
                </Button>
              </Box>
            )}

            {/* Services Tree List */}
            {filteredPackages.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
                <FolderOpen sx={{ fontSize: 40, opacity: 0.2, mb: 1 }} />
                <Typography variant="body2" sx={{ opacity: 0.6 }}>
                  No proto services loaded.
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ display: 'block', mt: 0.5, px: 2, opacity: 0.4 }}
                >
                  Click "Import Proto" above to select a .proto file.
                </Typography>
              </Box>
            ) : (
              <List sx={{ p: 0 }}>
                {filteredPackages.map((pkg) => (
                  <Box key={pkg.name} sx={{ mb: 0.5 }}>
                    {/* Package Node */}
                    <ListItemButton
                      onClick={() => togglePackage(pkg.name)}
                      sx={{
                        py: 0.5,
                        px: 1,
                        borderRadius: 1.5,
                        '&:hover': { backgroundColor: 'rgba(15, 23, 42, 0.03)' }
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 28 }}>
                        <Folder sx={{ fontSize: 18, color: '#f59e0b' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {pkg.name}
                          </Typography>
                        }
                      />
                      {expandedPackages[pkg.name] !== false ? (
                        <ExpandLess sx={{ fontSize: 18, color: 'text.secondary' }} />
                      ) : (
                        <ExpandMore sx={{ fontSize: 18, color: 'text.secondary' }} />
                      )}
                    </ListItemButton>

                    <Collapse
                      in={expandedPackages[pkg.name] !== false}
                      timeout="auto"
                      unmountOnExit
                    >
                      <List sx={{ pl: 2, py: 0.2 }}>
                        {pkg.services.map((svc) => (
                          <Box key={svc.fullName}>
                            {/* Service Node */}
                            <ListItemButton
                              onClick={() => toggleService(svc.fullName)}
                              sx={{
                                py: 0.4,
                                px: 1,
                                borderRadius: 1.5,
                                '&:hover': { backgroundColor: 'rgba(15, 23, 42, 0.03)' }
                              }}
                            >
                              <ListItemIcon sx={{ minWidth: 24 }}>
                                <Settings sx={{ fontSize: 16, color: 'primary.main' }} />
                              </ListItemIcon>
                              <ListItemText
                                primary={
                                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                    {svc.name}
                                  </Typography>
                                }
                              />
                              {expandedServices[svc.fullName] !== false ? (
                                <ExpandLess sx={{ fontSize: 16, color: 'text.secondary' }} />
                              ) : (
                                <ExpandMore sx={{ fontSize: 16, color: 'text.secondary' }} />
                              )}
                            </ListItemButton>

                            <Collapse
                              in={expandedServices[svc.fullName] !== false}
                              timeout="auto"
                              unmountOnExit
                            >
                              <List sx={{ pl: 1, py: 0.2 }}>
                                {svc.methods.map((method) => {
                                  const isSelected = selectedMethod?.fullName === method.fullName

                                  // Color code streaming types
                                  let typeLabel = 'Unary'
                                  let typeColor = '#3b82f6'
                                  if (method.requestStream && method.responseStream) {
                                    typeLabel = 'Bidi'
                                    typeColor = '#ec4899'
                                  } else if (method.requestStream) {
                                    typeLabel = 'Client Stream'
                                    typeColor = '#eab308'
                                  } else if (method.responseStream) {
                                    typeLabel = 'Server Stream'
                                    typeColor = '#10b981'
                                  }

                                  return (
                                    <ListItemButton
                                      key={method.fullName}
                                      onClick={() => selectMethod(method, svc)}
                                      selected={isSelected}
                                      sx={{
                                        py: 0.4,
                                        px: 1,
                                        borderRadius: 1,
                                        mb: 0.2,
                                        '&.Mui-selected': {
                                          backgroundColor: 'rgba(89, 201, 165, 0.12)',
                                          borderLeft: '3px solid #59C9A5',
                                          pl: '5px',
                                          '&:hover': {
                                            backgroundColor: 'rgba(89, 201, 165, 0.2)'
                                          }
                                        }
                                      }}
                                    >
                                      <ListItemIcon sx={{ minWidth: 20 }}>
                                        <Input
                                          sx={{
                                            fontSize: 13,
                                            color: isSelected ? '#59C9A5' : 'text.secondary'
                                          }}
                                        />
                                      </ListItemIcon>
                                      <ListItemText
                                        primary={
                                          <Typography
                                            variant="body2"
                                            sx={{
                                              fontWeight: isSelected ? 600 : 400,
                                              color: isSelected ? 'primary.main' : 'text.primary'
                                            }}
                                          >
                                            {method.name}
                                          </Typography>
                                        }
                                        secondary={
                                          <Typography
                                            variant="caption"
                                            sx={{
                                              fontWeight: 600,
                                              color: typeColor,
                                              fontSize: '0.65rem',
                                              display: 'block',
                                              mt: 0.25
                                            }}
                                          >
                                            {typeLabel}
                                          </Typography>
                                        }
                                      />
                                    </ListItemButton>
                                  )
                                })}
                              </List>
                            </Collapse>
                          </Box>
                        ))}
                      </List>
                    </Collapse>
                  </Box>
                ))}
              </List>
            )}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1 }}
            >
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                RECENT REQUESTS ({history.length})
              </Typography>
              {history.length > 0 && (
                <Button
                  size="small"
                  variant="text"
                  color="error"
                  onClick={clearHistory}
                  sx={{ fontSize: '0.75rem', p: 0 }}
                >
                  Clear All
                </Button>
              )}
            </Box>

            {history.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                <History sx={{ fontSize: 40, opacity: 0.2, mb: 1 }} />
                <Typography variant="body2" sx={{ opacity: 0.6 }}>
                  No request history yet.
                </Typography>
              </Box>
            ) : (
              <List sx={{ p: 0 }}>
                {history.map((item) => {
                  const methodParts = item.methodFullName.split('/')
                  const methodName = methodParts[methodParts.length - 1]
                  const serviceParts = methodParts[0].split('.')
                  const serviceName = serviceParts[serviceParts.length - 1]

                  const isSuccess = item.response.statusCode === 0

                  return (
                    <ListItemButton
                      key={item.id}
                      onClick={() => {
                        // Restore state
                        const pkg = packages.find((p) =>
                          p.services.some((s) => s.fullName === methodParts[0])
                        )
                        const svc = pkg?.services.find((s) => s.fullName === methodParts[0])
                        const method = svc?.methods.find((m) => m.fullName === item.methodFullName)

                        if (method && svc) {
                          selectMethod(method, svc)
                          useGrpcStore.getState().setPayload(item.payload)
                          useGrpcStore.getState().setHost(item.host)
                          // Optionally metadata
                        }
                      }}
                      sx={{
                        p: 1.2,
                        borderRadius: 2,
                        mb: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        backgroundColor: 'background.paper',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: 0.5,
                        '&:hover': { backgroundColor: 'rgba(15, 23, 42, 0.03)' }
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          width: '100%',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 600 }}
                          color={isSuccess ? 'secondary.main' : 'error.main'}
                        >
                          {methodName}
                        </Typography>
                        <Typography variant="caption" sx={{ ml: 'auto', opacity: 0.5 }}>
                          {item.response.duration ? `${item.response.duration}ms` : ''}
                        </Typography>
                      </Box>

                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          display: 'block',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {serviceName} • {item.host}
                      </Typography>
                    </ListItemButton>
                  )
                })}
              </List>
            )}
          </Box>
        )}
      </Box>
    </Box>
  )
}
