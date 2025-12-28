import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom'
import { monday } from '@/services/monday-api'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import Dashboard from '@/components/Dashboard'
import AdminPage from '@/components/Admin/AdminPage'
import LinkedInCallback from '@/components/Auth/LinkedInCallback'
import MondayCallback from '@/components/Auth/MondayCallback'
import LoginPage from '@/components/Auth/LoginPage'
import './styles/app.css'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

/**
 * Protected Route wrapper
 * Redirects to login if not authenticated and not inside Monday iframe
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isInsideMonday } = useAuth()
  
  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading...</p>
      </div>
    )
  }
  
  // If not authenticated and not inside Monday, redirect to login
  if (!isAuthenticated && !isInsideMonday) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}

// Separate component to use useLocation inside BrowserRouter
function AppRoutes() {
  const location = useLocation()
  const { isAuthenticated, isLoading, isInsideMonday, user } = useAuth()
  const [mondayReady, setMondayReady] = useState(false)

  useEffect(() => {
    // Listen for Monday SDK ready (for iframe context)
    if (isInsideMonday) {
      monday.listen('context', () => {
        setMondayReady(true)
      })
    }
    
    // Also set ready after a timeout
    const timeout = setTimeout(() => setMondayReady(true), 1000)
    return () => clearTimeout(timeout)
  }, [isInsideMonday])

  // Debug logging (can be removed in production)
  console.log('[App] Route:', location.pathname, {
    isAuthenticated,
    isLoading,
    isInsideMonday,
    mondayReady,
    user: user?.name,
  })

  // OAuth callback routes - render without app shell
  if (location.pathname === '/auth/linkedin/callback' || location.pathname === '/auth/linkedin/callback/') {
    return <LinkedInCallback />
  }
  
  if (location.pathname === '/auth/monday/callback' || location.pathname === '/auth/monday/callback/') {
    return <MondayCallback />
  }

  // Login page - only accessible when not authenticated
  if (location.pathname === '/login') {
    if (isAuthenticated || isInsideMonday) {
      return <Navigate to="/" replace />
    }
    return <LoginPage />
  }

  // Wait for auth and Monday SDK to be ready
  if (isLoading || (isInsideMonday && !mondayReady)) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading LinkedIn Analytics...</p>
      </div>
    )
  }

  // Main app with protected routes
  return (
    <ProtectedRoute>
      <div className="app-container">
        <nav className="app-nav">
          <div className="nav-brand">
            <svg className="brand-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
            </svg>
            <span>LinkedIn Analytics</span>
          </div>
          <div className="nav-links">
            <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              Dashboard
            </NavLink>
            <NavLink to="/admin" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              Admin
            </NavLink>
          </div>
          {user && !isInsideMonday && (
            <div className="nav-user">
              {user.photo && (
                <img src={user.photo} alt={user.name} className="user-avatar" />
              )}
              <span className="user-name">{user.name}</span>
            </div>
          )}
        </nav>
        
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/auth/linkedin/callback" element={<LinkedInCallback />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </ProtectedRoute>
  )
}

export default App
