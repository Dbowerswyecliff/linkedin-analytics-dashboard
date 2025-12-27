import './empty-state.css'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export default function EmptyState({ title, description, icon = '📭', action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3 className="empty-title">{title}</h3>
      {description && <p className="empty-description">{description}</p>}
      {action && (
        <button onClick={action.onClick} className="empty-action">
          {action.label}
        </button>
      )}
    </div>
  )
}

