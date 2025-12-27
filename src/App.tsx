import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { monday } from '@/services/monday-api'
import Dashboard from '@/components/Dashboard'
import AdminPage from '@/components/Admin/AdminPage'
import SetupPage from '@/components/Setup/SetupPage'
import { useBoardConfig } from '@/hooks/useMondayBoard'
import './styles/app.css'

function App() {
  const [isReady, setIsReady] = useState(false)
  const { data: boardConfig, isLoading: configLoading } = useBoardConfig()

  useEffect(() => {
    // Listen for Monday SDK ready
    monday.listen('context', () => {
      setIsReady(true)
    })
    
    // Also set ready after a timeout in case we're in dev mode
    const timeout = setTimeout(() => setIsReady(true), 1000)
    return () => clearTimeout(timeout)
  }, [])

  if (!isReady || configLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading LinkedIn Analytics...</p>
      </div>
    )
  }

  // If boards aren't set up yet, show setup
  const needsSetup = !boardConfig?.weeklyTotalsBoardId || !boardConfig?.postAnalyticsBoardId

  if (needsSetup) {
    return <SetupPage />
  }

  return (
    <BrowserRouter>
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
        </nav>
        
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App

