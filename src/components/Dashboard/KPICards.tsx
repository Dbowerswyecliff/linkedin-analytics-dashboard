import './kpi-cards.css'

interface KPIData {
  impressions: number;
  reach: number;
  engagements: number;
  engagementRate: string;
  employeeCount: number;
  avgImpressions: number;
}

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

export default function KPICards({ data }: KPICardsProps) {
  const cards = [
    {
      label: 'Total Impressions',
      value: formatNumber(data.impressions),
      subValue: `${formatNumber(data.avgImpressions)} avg/employee`,
      gradient: 'impressions',
      icon: '👁',
    },
    {
      label: 'Unique Views',
      value: formatNumber(data.reach),
      subValue: 'Members reached',
      gradient: 'reach',
      icon: '👥',
    },
    {
      label: 'Total Engagements',
      value: formatNumber(data.engagements),
      subValue: 'Reactions, comments, shares',
      gradient: 'engagements',
      icon: '💬',
    },
    {
      label: 'Engagement Rate',
      value: `${data.engagementRate}%`,
      subValue: `${data.employeeCount} employees tracked`,
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
            <span className="kpi-sub-value">{card.subValue}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

