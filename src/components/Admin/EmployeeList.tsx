/**
 * Employee List Component
 * Displays all connected LinkedIn employees with their sync status
 */

import { useState } from 'react';
import { 
  useConnectedEmployees, 
  useSyncStatus, 
  useManualSync,
  formatSyncStatus,
  type EmployeeRecord,
} from '@/hooks/useLinkedInAnalytics';
import './employee-list.css';

export default function EmployeeList() {
  const { data: employeeData, isLoading: employeesLoading, refetch: refetchEmployees } = useConnectedEmployees();
  const { data: syncData } = useSyncStatus();
  const manualSync = useManualSync();
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  const employees = employeeData?.employees || [];
  const syncStatus = formatSyncStatus(syncData?.latestSync || null);

  const handleSync = async () => {
    try {
      await manualSync.mutateAsync();
      // Refresh employee list after sync
      setTimeout(() => refetchEmployees(), 2000);
    } catch (err) {
      console.error('Sync failed:', err);
    }
  };

  if (employeesLoading) {
    return (
      <div className="employee-list loading">
        <div className="loading-spinner" />
        <p>Loading connected employees...</p>
      </div>
    );
  }

  return (
    <div className="employee-list">
      {/* Sync Controls */}
      <div className="sync-controls">
        <div className="sync-info">
          <div className={`sync-status-badge ${syncStatus.color}`}>
            {syncStatus.label}
          </div>
          <span className="sync-time">Last synced: {syncStatus.lastSyncAgo}</span>
        </div>
        
        <button
          onClick={handleSync}
          disabled={manualSync.isPending}
          className="sync-button"
        >
          {manualSync.isPending ? (
            <>
              <div className="button-spinner" />
              Syncing...
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
              </svg>
              Sync Now
            </>
          )}
        </button>
      </div>

      {/* Sync Results */}
      {manualSync.isSuccess && (
        <div className="sync-result success">
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
          </svg>
          <span>
            Synced {manualSync.data.successCount} of {manualSync.data.totalUsers} employees
            {manualSync.data.errorCount > 0 && ` (${manualSync.data.errorCount} errors)`}
          </span>
        </div>
      )}

      {manualSync.isError && (
        <div className="sync-result error">
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <span>Sync failed: {manualSync.error?.message || 'Unknown error'}</span>
        </div>
      )}

      {/* Employee Stats */}
      <div className="employee-stats">
        <div className="stat-card">
          <span className="stat-value">{employeeData?.count || 0}</span>
          <span className="stat-label">Total Employees</span>
        </div>
        <div className="stat-card">
          <span className="stat-value success">{employeeData?.connectedCount || 0}</span>
          <span className="stat-label">Connected</span>
        </div>
        <div className="stat-card">
          <span className="stat-value warning">{(employeeData?.count || 0) - (employeeData?.connectedCount || 0)}</span>
          <span className="stat-label">Expired/Issues</span>
        </div>
      </div>

      {/* Employee List */}
      {employees.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
          <h3>No employees connected</h3>
          <p>Have your team members connect their LinkedIn accounts to start tracking analytics.</p>
        </div>
      ) : (
        <div className="employees-grid">
          {employees.map((employee) => (
            <EmployeeCard
              key={employee.mondayUserId}
              employee={employee}
              isExpanded={expandedEmployee === employee.mondayUserId}
              onToggle={() => setExpandedEmployee(
                expandedEmployee === employee.mondayUserId ? null : employee.mondayUserId
              )}
            />
          ))}
        </div>
      )}

      {/* Recent Sync History */}
      {syncData?.recentSyncs && syncData.recentSyncs.length > 0 && (
        <div className="sync-history">
          <h3>Recent Sync History</h3>
          <table className="history-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Status</th>
                <th>Results</th>
              </tr>
            </thead>
            <tbody>
              {syncData.recentSyncs.map((sync) => (
                <tr key={sync.id}>
                  <td>{new Date(sync.startedAt).toLocaleString()}</td>
                  <td className="type-cell">
                    <span className={`type-badge ${sync.triggerType}`}>
                      {sync.triggerType}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${sync.status}`}>
                      {sync.status}
                    </span>
                  </td>
                  <td>
                    {sync.successCount}/{sync.totalUsers} synced
                    {sync.errorCount > 0 && (
                      <span className="error-count"> ({sync.errorCount} errors)</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface EmployeeCardProps {
  employee: EmployeeRecord;
  isExpanded: boolean;
  onToggle: () => void;
}

function EmployeeCard({ employee, isExpanded, onToggle }: EmployeeCardProps) {
  const connectedDate = new Date(employee.createdAt).toLocaleDateString();
  const expiryDate = new Date(employee.expiresAt).toLocaleDateString();
  const lastUpdated = new Date(employee.updatedAt).toLocaleDateString();

  return (
    <div className={`employee-card ${employee.isExpired ? 'expired' : 'active'}`}>
      <div className="card-header" onClick={onToggle}>
        <div className="employee-avatar">
          {employee.profilePicture ? (
            <img src={employee.profilePicture} alt={employee.displayName} />
          ) : (
            <div className="avatar-placeholder">
              {employee.displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        
        <div className="employee-info">
          <h4>{employee.displayName}</h4>
          {employee.profileHeadline && (
            <p className="employee-headline">{employee.profileHeadline}</p>
          )}
        </div>

        <div className="connection-status">
          {employee.isExpired ? (
            <span className="status-indicator expired">
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              Expired
            </span>
          ) : (
            <span className="status-indicator connected">
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
              </svg>
              Connected
            </span>
          )}
        </div>

        <button className="expand-btn" aria-label="Expand details">
          <svg 
            viewBox="0 0 24 24" 
            fill="currentColor" 
            width="20" 
            height="20"
            style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
          </svg>
        </button>
      </div>

      {isExpanded && (
        <div className="card-details">
          <div className="detail-row">
            <span className="detail-label">LinkedIn ID</span>
            <span className="detail-value">{employee.linkedInId || 'Not available'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Monday User ID</span>
            <span className="detail-value">{employee.mondayUserId}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Connected On</span>
            <span className="detail-value">{connectedDate}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Token Expires</span>
            <span className={`detail-value ${employee.isExpired ? 'expired' : ''}`}>
              {expiryDate}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Last Updated</span>
            <span className="detail-value">{lastUpdated}</span>
          </div>
        </div>
      )}
    </div>
  );
}

