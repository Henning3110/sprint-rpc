import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#59C9A5', // Soft vibrant mint green
      light: '#b2ebd7',
      dark: '#3fae8b',
      contrastText: '#ffffff'
    },
    secondary: {
      main: '#2e4057', // Premium deep slate navy
      light: '#4f6c8c',
      dark: '#1b263b',
      contrastText: '#ffffff'
    },
    background: {
      default: '#f8fafc', // Soft light slate / clean off-white
      paper: '#ffffff' // Pure white for cards/panels
    },
    text: {
      primary: '#0f172a', // Slate 900
      secondary: '#475569' // Slate 600
    },
    divider: 'rgba(15, 23, 42, 0.08)' // Subtle modern slate dividers
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      'Helvetica',
      'Arial',
      'sans-serif'
    ].join(','),
    h6: {
      fontWeight: 600,
      letterSpacing: '0.01em'
    },
    button: {
      textTransform: 'none',
      fontWeight: 600
    }
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none'
          }
        },
        contained: {
          background: 'linear-gradient(135deg, #59C9A5 0%, #3fae8b 100%)',
          border: '1px solid rgba(0, 0, 0, 0.05)',
          color: '#ffffff',
          '&:hover': {
            background: 'linear-gradient(135deg, #3fae8b 0%, #308f71 100%)'
          }
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          boxShadow: 'none',
          border: '1px solid rgba(15, 23, 42, 0.06)'
        }
      }
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            backgroundColor: '#ffffff',
            '& fieldset': {
              borderColor: 'rgba(15, 23, 42, 0.08)'
            },
            '&:hover fieldset': {
              borderColor: 'rgba(15, 23, 42, 0.2)'
            },
            '&.Mui-focused fieldset': {
              borderColor: '#59C9A5',
              borderWidth: 1
            }
          }
        }
      }
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          fontSize: '0.875rem'
        }
      }
    }
  }
})
