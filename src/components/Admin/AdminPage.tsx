import { useState } from 'react'
import { useBoardConfig, useSyncErrors } from '@/hooks/useMondayBoard'
import LinkedInConnect from './LinkedInConnect'
import SyncStatus from './SyncStatus'
import ManualUpload from './ManualUpload'
import './admin.css'

export default function AdminPage() {
  const { data: boardConfig } = useBoardConfig()
  const { data: errors = [], isLoading: errorsLoading } = useSyncErrors(
    boardConfig?.weeklyTotalsBoardId ?? null,
    boardConfig?.postAnalyticsBoardId ?? null
  )
  
  const [activeTab, setActiveTab] = useState<'sync' | 'linkedin' | 'upload' | 'help'>('sync')

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>Admin Settings</h1>
        <p>Configure LinkedIn integration and manage data sync</p>
      </header>

      <div className="admin-tabs">
        <button
          className={`tab-btn ${activeTab === 'sync' ? 'active' : ''}`}
          onClick={() => setActiveTab('sync')}
        >
          Sync Status
          {errors.length > 0 && <span className="error-badge">{errors.length}</span>}
        </button>
        <button
          className={`tab-btn ${activeTab === 'linkedin' ? 'active' : ''}`}
          onClick={() => setActiveTab('linkedin')}
        >
          LinkedIn
        </button>
        <button
          className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          Manual Upload
        </button>
        <button
          className={`tab-btn ${activeTab === 'help' ? 'active' : ''}`}
          onClick={() => setActiveTab('help')}
        >
          Help
        </button>
      </div>

      <div className="admin-content">
        {activeTab === 'sync' && (
          <SyncStatus errors={errors} isLoading={errorsLoading} />
        )}
        {activeTab === 'linkedin' && (
          <LinkedInConnect />
        )}
        {activeTab === 'upload' && (
          <ManualUpload boardConfig={boardConfig} />
        )}
        {activeTab === 'help' && (
          <HelpSection />
        )}
      </div>
    </div>
  )
}

function HelpSection() {
  return (
    <div className="help-section">
      <div className="help-card">
        <h3>📋 Data Key Reference</h3>
        <p>Understanding how data is uniquely identified in the boards.</p>
        
        <div className="key-reference">
          <div className="key-item">
            <strong>Week Key</strong>
            <code>{'{personUrn}|{weekStart}'}</code>
            <span>Example: urn:li:person:abc123|2024-01-01</span>
          </div>
          <div className="key-item">
            <strong>Post Key</strong>
            <code>{'{postUrn}|{rangeStart}|{rangeEnd}'}</code>
            <span>Example: urn:li:share:xyz789|2024-01-01|2024-01-07</span>
          </div>
        </div>
      </div>

      <div className="help-card">
        <h3>🔄 Sync Process</h3>
        <ol className="help-steps">
          <li>
            <strong>Connect LinkedIn</strong>
            <p>Each employee connects their LinkedIn account via OAuth</p>
          </li>
          <li>
            <strong>Trigger Sync</strong>
            <p>Click "Sync Now" to fetch latest analytics from LinkedIn API</p>
          </li>
          <li>
            <strong>Review Status</strong>
            <p>Check the Sync Status tab for any errors</p>
          </li>
        </ol>
      </div>

      <div className="help-card">
        <h3>⚠️ LinkedIn API Note</h3>
        <p className="warning-text">
          LinkedIn restricts analytics API access. If direct API sync is unavailable, 
          use the <strong>Manual Upload</strong> feature to import data from LinkedIn's 
          "Download Your Data" export.
        </p>
      </div>

      <div className="help-card">
        <h3>📊 Board Structure</h3>
        <div className="board-info">
          <div>
            <strong>LI | Weekly Totals</strong>
            <p>Aggregated weekly metrics per employee. One row = one employee + one week.</p>
          </div>
          <div>
            <strong>LI | Post Analytics</strong>
            <p>Individual post performance. One row = one post + one date range.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

