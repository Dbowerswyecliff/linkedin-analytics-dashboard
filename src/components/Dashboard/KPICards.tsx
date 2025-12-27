import type { KPIData } from '@/types/analytics'
import './kpi-cards.css'

interface KPICardsProps {
  data: KPIData
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toLocaleString()
}

function formatPercent(num: number): string {
  return num.toFixed(2) + '%'
}

function TrendIndicator({ value }: { value: number }) {
  if (value === 0) return null
  
  const isPositive = value > 0
  return (
    <span className={`trend ${isPositive ? 'positive' : 'negative'}`}>
      {isPositive ? '↑' : '↓'} {Math.abs(value).toFixed(1)}%
    </span>
  )
}

export default function KPICards({ data }: KPICardsProps) {
  const cards = [
    {
      label: 'Total Impressions',
      value: formatNumber(data.totalImpressions),
      trend: data.impressionsTrend,
      gradient: 'impressions',
      icon: '👁',
    },
    {
      label: 'Members Reached',
      value: formatNumber(data.totalReach),
      trend: data.reachTrend,
      gradient: 'reach',
      icon: '👥',
    },
    {
      label: 'Total Engagements',
      value: formatNumber(data.totalEngagements),
      trend: data.engagementsTrend,
      gradient: 'engagements',
      icon: '💬',
    },
    {
      label: 'Engagement Rate',
      value: formatPercent(data.engagementRate),
      trend: data.rateTrend,
      gradient: 'rate',
      icon: '📈',
    },
  ]

  return (
    <div className="kpi-grid">
      {cards.map((card, idx) => (
        <div 
          key={card.label} 
          className={`kpi-card animate-slide-up stagger-${idx + 1}`}
        >
          <div className={`kpi-accent gradient-${card.gradient}`} />
          <div className="kpi-content">
            <div className="kpi-header">
              <span className="kpi-icon">{card.icon}</span>
              <span className="kpi-label">{card.label}</span>
            </div>
            <div className="kpi-value">{card.value}</div>
            <TrendIndicator value={card.trend} />
          </div>
        </div>
      ))}
    </div>
  )
}

