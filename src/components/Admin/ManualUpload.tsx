import { useState, useCallback } from 'react'
import type { BoardConfig } from '@/types/analytics'
import './manual-upload.css'

interface ManualUploadProps {
  boardConfig: BoardConfig | undefined
}

interface ParsedRow {
  employeeName: string
  personUrn: string
  postUrn?: string
  postUrl?: string
  postDate?: string
  weekStart?: string
  weekEnd?: string
  impressions: number
  membersReached: number
  reactions: number
  comments: number
  reshares: number
}

export default function ManualUpload({ boardConfig }: ManualUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploadType, setUploadType] = useState<'weekly' | 'posts'>('weekly')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ParsedRow[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv'))) {
      processFile(droppedFile)
    } else {
      setError('Please upload a CSV file')
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      processFile(selectedFile)
    }
  }

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile)
    setError(null)

    try {
      const text = await selectedFile.text()
      const lines = text.split('\n').filter(line => line.trim())
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      
      const parsed: ParsedRow[] = []
      
      for (let i = 1; i < Math.min(lines.length, 6); i++) {
        const values = lines[i].split(',')
        const row: Record<string, string> = {}
        
        headers.forEach((header, idx) => {
          row[header] = values[idx]?.trim() || ''
        })
        
        parsed.push({
          employeeName: row['employee name'] || row['name'] || row['employee'] || '',
          personUrn: row['person urn'] || row['urn'] || '',
          postUrn: row['post urn'] || '',
          postUrl: row['post url'] || row['url'] || '',
          postDate: row['post date'] || row['date'] || '',
          weekStart: row['week start'] || '',
          weekEnd: row['week end'] || '',
          impressions: parseInt(row['impressions'] || '0', 10),
          membersReached: parseInt(row['members reached'] || row['reach'] || '0', 10),
          reactions: parseInt(row['reactions'] || row['likes'] || '0', 10),
          comments: parseInt(row['comments'] || '0', 10),
          reshares: parseInt(row['reshares'] || row['shares'] || '0', 10),
        })
      }
      
      setPreview(parsed)
    } catch (err) {
      setError('Failed to parse CSV file')
      console.error(err)
    }
  }

  const handleUpload = async () => {
    if (!file || !boardConfig) return
    
    setIsUploading(true)
    setError(null)

    try {
      // In a real app, this would call the Monday API to create items
      // For now, we'll simulate the upload
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      alert(`Successfully uploaded ${preview.length} rows to ${uploadType === 'weekly' ? 'Weekly Totals' : 'Post Analytics'} board`)
      
      setFile(null)
      setPreview([])
    } catch (err) {
      setError('Failed to upload data to Monday board')
      console.error(err)
    } finally {
      setIsUploading(false)
    }
  }

  const clearFile = () => {
    setFile(null)
    setPreview([])
    setError(null)
  }

  return (
    <div className="manual-upload">
      <div className="upload-header">
        <h3>Manual Data Upload</h3>
        <p>Import LinkedIn analytics from a CSV file when API access is limited</p>
      </div>

      <div className="upload-type-selector">
        <label>Upload to:</label>
        <div className="type-buttons">
          <button
            className={`type-btn ${uploadType === 'weekly' ? 'active' : ''}`}
            onClick={() => setUploadType('weekly')}
          >
            📊 Weekly Totals
          </button>
          <button
            className={`type-btn ${uploadType === 'posts' ? 'active' : ''}`}
            onClick={() => setUploadType('posts')}
          >
            📈 Post Analytics
          </button>
        </div>
      </div>

      <div
        className={`drop-zone ${isDragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {file ? (
          <div className="file-info">
            <span className="file-icon">📄</span>
            <div className="file-details">
              <strong>{file.name}</strong>
              <span>{(file.size / 1024).toFixed(1)} KB • {preview.length} rows preview</span>
            </div>
            <button onClick={clearFile} className="clear-file-btn">×</button>
          </div>
        ) : (
          <>
            <span className="drop-icon">📥</span>
            <p>Drag & drop a CSV file here</p>
            <span className="drop-or">or</span>
            <label className="file-select-btn">
              Browse Files
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                hidden
              />
            </label>
          </>
        )}
      </div>

      {error && (
        <div className="upload-error">
          <span>⚠️</span> {error}
        </div>
      )}

      {preview.length > 0 && (
        <div className="preview-section">
          <h4>Preview (first 5 rows)</h4>
          <div className="preview-table-wrapper">
            <table className="preview-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  {uploadType === 'posts' && <th>Post URL</th>}
                  <th>Impressions</th>
                  <th>Reach</th>
                  <th>Reactions</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, idx) => (
                  <tr key={idx}>
                    <td>{row.employeeName || '-'}</td>
                    {uploadType === 'posts' && (
                      <td className="url-cell">
                        {row.postUrl ? (
                          <a href={row.postUrl} target="_blank" rel="noopener noreferrer">
                            View ↗
                          </a>
                        ) : '-'}
                      </td>
                    )}
                    <td>{row.impressions.toLocaleString()}</td>
                    <td>{row.membersReached.toLocaleString()}</td>
                    <td>{row.reactions.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || isUploading || !boardConfig}
        className="upload-btn"
      >
        {isUploading ? (
          <>
            <div className="button-spinner" />
            Uploading...
          </>
        ) : (
          `Upload to ${uploadType === 'weekly' ? 'Weekly Totals' : 'Post Analytics'}`
        )}
      </button>

      <div className="csv-format-help">
        <h4>📋 CSV Format</h4>
        <p>Your CSV should include these columns (headers are case-insensitive):</p>
        
        {uploadType === 'weekly' ? (
          <code className="format-example">
            Employee Name, Person URN, Week Start, Week End, Impressions, Members Reached, Reactions, Comments, Reshares
          </code>
        ) : (
          <code className="format-example">
            Employee Name, Person URN, Post URN, Post URL, Post Date, Range Start, Range End, Impressions, Members Reached, Reactions, Comments, Reshares
          </code>
        )}
      </div>
    </div>
  )
}

