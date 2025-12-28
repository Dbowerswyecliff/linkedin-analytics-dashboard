import { useState } from 'react'
import { useBoardConfig, useSetupBoards } from '@/hooks/useMondayBoard'
import { getContext, saveBoardConfig } from '@/services/monday-api'
import type { BoardConfig } from '@/types/analytics'
import './monday-boards.css'

export default function MondayBoards() {
  const { data: boardConfig, isLoading, refetch } = useBoardConfig()
  const setupBoards = useSetupBoards()
  
  const [isCreating, setIsCreating] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirmClear, setShowConfirmClear] = useState(false)
  const [showConfirmCreate, setShowConfirmCreate] = useState(false)

  const hasWeeklyBoard = !!boardConfig?.weeklyTotalsBoardId
  const hasPostsBoard = !!boardConfig?.postAnalyticsBoardId
  const hasBothBoards = hasWeeklyBoard && hasPostsBoard

  const handleCreateBoards = async () => {
    // If boards already exist, show confirmation first
    if (hasBothBoards && !showConfirmCreate) {
      setShowConfirmCreate(true)
      return
    }

    setIsCreating(true)
    setError(null)
    setShowConfirmCreate(false)

    try {
      const context = await getContext()
      const workspaceId = context.workspaceId || 'main'
      
      await setupBoards.mutateAsync(workspaceId)
      await refetch()
    } catch (err) {
      console.error('Board creation failed:', err)
      setError(
        err instanceof Error 
          ? err.message 
          : 'Failed to create boards. Make sure you are running inside Monday.com.'
      )
    } finally {
      setIsCreating(false)
    }
  }

  const handleClearConfig = async () => {
    if (!showConfirmClear) {
      setShowConfirmClear(true)
      return
    }

    setIsClearing(true)
    setError(null)
    setShowConfirmClear(false)

    try {
      const clearedConfig: BoardConfig = {
        weeklyTotalsBoardId: null,
        postAnalyticsBoardId: null,
      }
      await saveBoardConfig(clearedConfig)
      await refetch()
    } catch (err) {
      console.error('Failed to clear config:', err)
      setError(err instanceof Error ? err.message : 'Failed to clear board configuration')
    } finally {
      setIsClearing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="monday-boards loading">
        <div className="loading-spinner" />
        <span>Loading board configuration...</span>
      </div>
    )
  }

  return (
    <div className="monday-boards">
      <div className="boards-header">
        <h3>Monday.com Boards</h3>
        <p>
          These boards store LinkedIn analytics data for use with Monday.com views and automations.
          Boards are <strong>optional</strong> — analytics are stored in the cloud (DynamoDB) regardless.
        </p>
      </div>

      {error && (
        <div className="boards-error">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="dismiss-btn">×</button>
        </div>
      )}

      <div className="boards-list">
        <div className={`board-card ${hasWeeklyBoard ? 'connected' : 'disconnected'}`}>
          <div className="board-icon">📊</div>
          <div className="board-info">
            <h4>LI | Weekly Totals</h4>
            <p>Aggregated weekly metrics per employee</p>
            {hasWeeklyBoard ? (
              <div className="board-id">
                <span className="label">Board ID:</span>
                <code>{boardConfig?.weeklyTotalsBoardId}</code>
              </div>
            ) : (
              <div className="board-status not-configured">Not configured</div>
            )}
          </div>
          <div className={`status-indicator ${hasWeeklyBoard ? 'active' : 'inactive'}`}>
            {hasWeeklyBoard ? '✓' : '○'}
          </div>
        </div>

        <div className={`board-card ${hasPostsBoard ? 'connected' : 'disconnected'}`}>
          <div className="board-icon">📈</div>
          <div className="board-info">
            <h4>LI | Post Analytics</h4>
            <p>Individual post performance metrics</p>
            {hasPostsBoard ? (
              <div className="board-id">
                <span className="label">Board ID:</span>
                <code>{boardConfig?.postAnalyticsBoardId}</code>
              </div>
            ) : (
              <div className="board-status not-configured">Not configured</div>
            )}
          </div>
          <div className={`status-indicator ${hasPostsBoard ? 'active' : 'inactive'}`}>
            {hasPostsBoard ? '✓' : '○'}
          </div>
        </div>
      </div>

      <div className="boards-actions">
        {/* Create Boards Button */}
        {!hasBothBoards && (
          <button
            onClick={handleCreateBoards}
            disabled={isCreating}
            className="action-btn primary"
          >
            {isCreating ? (
              <>
                <div className="button-spinner" />
                Creating boards...
              </>
            ) : (
              <>
                <span className="btn-icon">+</span>
                Create Boards
              </>
            )}
          </button>
        )}

        {/* Confirm Create Modal (when boards exist) */}
        {showConfirmCreate && (
          <div className="confirm-overlay">
            <div className="confirm-modal">
              <h4>Boards Already Configured</h4>
              <p>
                Creating new boards will replace the current board IDs in this app's configuration.
                The existing boards will not be deleted.
              </p>
              <div className="confirm-actions">
                <button 
                  onClick={() => setShowConfirmCreate(false)} 
                  className="action-btn secondary"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateBoards} 
                  className="action-btn danger"
                  disabled={isCreating}
                >
                  Create New Boards
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Clear Config Button */}
        {hasBothBoards && !showConfirmClear && (
          <button
            onClick={handleClearConfig}
            disabled={isClearing}
            className="action-btn secondary"
          >
            Clear Board Config
          </button>
        )}

        {/* Confirm Clear Modal */}
        {showConfirmClear && (
          <div className="confirm-overlay">
            <div className="confirm-modal">
              <h4>Clear Board Configuration?</h4>
              <p>
                This will disconnect the app from these boards. The boards themselves will not be deleted.
                You can reconnect or create new boards later.
              </p>
              <div className="confirm-actions">
                <button 
                  onClick={() => setShowConfirmClear(false)} 
                  className="action-btn secondary"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleClearConfig} 
                  className="action-btn danger"
                  disabled={isClearing}
                >
                  {isClearing ? 'Clearing...' : 'Clear Config'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="boards-note">
        <h4>ℹ️ About Monday Boards</h4>
        <p>
          Monday boards are used for:
        </p>
        <ul>
          <li>Creating custom views and filters within Monday.com</li>
          <li>Building automations and integrations</li>
          <li>Exporting data via Monday's native tools</li>
        </ul>
        <p>
          <strong>Note:</strong> All LinkedIn analytics are stored in the cloud database and displayed
          in the Dashboard regardless of board configuration.
        </p>
      </div>
    </div>
  )
}

