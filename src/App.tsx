import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom'
import Dashboard from '@/components/Dashboard'
import DemoLeadGate, { hasDemoAccess } from '@/components/Auth/DemoLeadGate'
import './styles/app.css'

const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

function App() {
  if (IS_DEMO_MODE) {
    return (
      <BrowserRouter>
        <DemoAppRoutes />
      </BrowserRouter>
    )
  }

  return <ProductionApp />
}

/**
 * Production app: full Monday/LinkedIn auth, admin panel, live data.
 * Only loaded when VITE_DEMO_MODE is not 'true'.
 */
function ProductionApp() {
  // Lazy-load production-only modules so they don't execute in demo builds
  const [modules, setModules] = useState<{
    AuthProvider: React.ComponentType<{ children: React.ReactNode }>
    ProductionRoutes: React.ComponentType
  } | null>(null)

  useEffect(() => {
    Promise.all([
      import('@/contexts/AuthContext'),
      import('@/services/monday-api'),
      import('@/components/Admin/AdminPage'),
      import('@/components/Auth/LinkedInCallback'),
      import('@/components/Auth/MondayCallback'),
      import('@/components/Auth/LoginPage'),
    ]).then(([authCtx, mondayApi, adminPage, liCallback, mondayCallback, loginPage]) => {
      function ProductionRoutes() {
        return (
          <ProductionAppRoutes
            monday={mondayApi.monday}
            useAuth={authCtx.useAuth}
            AdminPage={adminPage.default}
            LinkedInCallback={liCallback.default}
            MondayCallback={mondayCallback.default}
            LoginPage={loginPage.default}
          />
        )
      }
      setModules({
        AuthProvider: authCtx.AuthProvider,
        ProductionRoutes,
      })
    })
  }, [])

  if (!modules) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading...</p>
      </div>
    )
  }

  const { AuthProvider, ProductionRoutes } = modules

  return (
    <BrowserRouter>
      <AuthProvider>
        <ProductionRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

/**
 * Demo app routes: lead gate -> dashboard with mock data only.
 * No admin, no OAuth, no live API calls.
 */
function DemoAppRoutes() {
  const location = useLocation()
  const [demoAccess, setDemoAccess] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    setDemoAccess(hasDemoAccess())
    setChecking(false)
  }, [location.pathname])

  if (checking) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading...</p>
      </div>
    )
  }

  if (!demoAccess) {
    return <DemoLeadGate />
  }

  return (
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
        </div>
        <div className="nav-user">
          <span className="demo-badge">DEMO</span>
        </div>
      </nav>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

interface ProductionAppRoutesProps {
  monday: { listen: (event: string, callback: () => void) => void }
  useAuth: () => {
    isAuthenticated: boolean
    isLoading: boolean
    isInsideMonday: boolean
    user: { name: string; photo?: string } | null
    login: () => void
  }
  AdminPage: React.ComponentType
  LinkedInCallback: React.ComponentType
  MondayCallback: React.ComponentType
  LoginPage: React.ComponentType
}

function ProductionAppRoutes({
  monday,
  useAuth,
  AdminPage,
  LinkedInCallback,
  MondayCallback,
  LoginPage,
}: ProductionAppRoutesProps) {
  const location = useLocation()
  const { isAuthenticated, isLoading, isInsideMonday, user } = useAuth()
  const [mondayReady, setMondayReady] = useState(false)

  useEffect(() => {
    if (isInsideMonday) {
      monday.listen('context', () => {
        setMondayReady(true)
      })
    }
    const timeout = setTimeout(() => setMondayReady(true), 1000)
    return () => clearTimeout(timeout)
  }, [isInsideMonday, monday])

  if (location.pathname === '/auth/linkedin/callback' || location.pathname === '/auth/linkedin/callback/') {
    return <LinkedInCallback />
  }

  if (location.pathname === '/auth/monday/callback' || location.pathname === '/auth/monday/callback/') {
    return <MondayCallback />
  }

  if (location.pathname === '/login') {
    if (isAuthenticated || isInsideMonday) {
      return <Navigate to="/" replace />
    }
    return <LoginPage />
  }

  if (isLoading || (isInsideMonday && !mondayReady)) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading LinkedIn Analytics...</p>
      </div>
    )
  }

  if (!isAuthenticated && !isInsideMonday) {
    return <Navigate to="/login" replace />
  }

  return (
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
  )
}

export default App
