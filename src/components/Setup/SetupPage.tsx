import { useState } from 'react'
import { useSetupBoards, useBoardConfig } from '@/hooks/useMondayBoard'
import { getContext } from '@/services/monday-api'
import './setup.css'

export default function SetupPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setupBoards = useSetupBoards()
  const { refetch } = useBoardConfig()

  const handleSetup = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const context = await getContext()
      const workspaceId = context.workspaceId || 'main'
      
      await setupBoards.mutateAsync(workspaceId)
      await refetch()
    } catch (err) {
      console.error('Setup failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to create boards')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="setup-page">
      <div className="setup-card">
        <div className="setup-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
          </svg>
        </div>
        
        <h1>LinkedIn Analytics Dashboard</h1>
        <p className="setup-description">
          Track employee LinkedIn performance with weekly totals and post analytics.
          This will create two boards in your workspace.
        </p>

        <div className="setup-boards-preview">
          <div className="board-preview">
            <span className="board-icon">📊</span>
            <div>
              <strong>LI | Weekly Totals</strong>
              <span>Track weekly impressions, reach, and engagement</span>
            </div>
          </div>
          <div className="board-preview">
            <span className="board-icon">📈</span>
            <div>
              <strong>LI | Post Analytics</strong>
              <span>Individual post performance metrics</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="setup-error">
            <span>⚠️</span> {error}
          </div>
        )}

        <button 
          onClick={handleSetup} 
          disabled={isLoading}
          className="setup-button"
        >
          {isLoading ? (
            <>
              <div className="button-spinner" />
              Creating boards...
            </>
          ) : (
            'Create Boards & Get Started'
          )}
        </button>

        <p className="setup-note">
          You can customize the boards after creation
        </p>
      </div>
    </div>
  )
}

