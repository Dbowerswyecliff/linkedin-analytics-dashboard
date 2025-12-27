import { useMemo } from 'react'
import type { WeeklyTotal, PostAnalytics, KPIData, ChartDataPoint, TopPost } from '@/types/analytics'
import { format, parseISO, subWeeks, isWithinInterval, startOfWeek, endOfWeek } from 'date-fns'

export function useKPIData(
  weeklyData: WeeklyTotal[],
  previousWeeklyData?: WeeklyTotal[]
): KPIData {
  return useMemo(() => {
    const current = {
      impressions: weeklyData.reduce((sum, w) => sum + w.impressions, 0),
      reach: weeklyData.reduce((sum, w) => sum + w.membersReached, 0),
      engagements: weeklyData.reduce((sum, w) => sum + w.engagements, 0),
    }
    
    const currentRate = current.impressions > 0 
      ? (current.engagements / current.impressions) * 100 
      : 0

    const prev = previousWeeklyData ? {
      impressions: previousWeeklyData.reduce((sum, w) => sum + w.impressions, 0),
      reach: previousWeeklyData.reduce((sum, w) => sum + w.membersReached, 0),
      engagements: previousWeeklyData.reduce((sum, w) => sum + w.engagements, 0),
    } : { impressions: 0, reach: 0, engagements: 0 }
    
    const prevRate = prev.impressions > 0 
      ? (prev.engagements / prev.impressions) * 100 
      : 0

    const calcTrend = (curr: number, previous: number) => {
      if (previous === 0) return curr > 0 ? 100 : 0
      return ((curr - previous) / previous) * 100
    }

    return {
      totalImpressions: current.impressions,
      totalReach: current.reach,
      totalEngagements: current.engagements,
      engagementRate: currentRate,
      impressionsTrend: calcTrend(current.impressions, prev.impressions),
      reachTrend: calcTrend(current.reach, prev.reach),
      engagementsTrend: calcTrend(current.engagements, prev.engagements),
      rateTrend: calcTrend(currentRate, prevRate),
    }
  }, [weeklyData, previousWeeklyData])
}

export function useChartData(weeklyData: WeeklyTotal[]): ChartDataPoint[] {
  return useMemo(() => {
    // Group by week
    const byWeek = new Map<string, ChartDataPoint>()
    
    weeklyData.forEach((w) => {
      const key = w.weekStart
      const existing = byWeek.get(key)
      
      if (existing) {
        existing.impressions += w.impressions
        existing.reach += w.membersReached
        existing.engagements += w.engagements
      } else {
        byWeek.set(key, {
          date: w.weekStart,
          label: format(parseISO(w.weekStart), 'MMM d'),
          impressions: w.impressions,
          reach: w.membersReached,
          engagements: w.engagements,
        })
      }
    })
    
    return Array.from(byWeek.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [weeklyData])
}

export function useTopPosts(postsData: PostAnalytics[], limit = 10): TopPost[] {
  return useMemo(() => {
    return [...postsData]
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, limit)
      .map((p) => ({
        postUrl: p.postUrl,
        employeeName: p.employeeName,
        postDate: p.postDate,
        impressions: p.impressions,
        engagements: p.engagements,
        engagementRate: p.engagementRate * 100,
      }))
  }, [postsData, limit])
}

export function filterDataByDateRange<T extends { weekStart?: string; rangeStart?: string }>(
  data: T[],
  startDate: Date,
  endDate: Date
): T[] {
  return data.filter((item) => {
    const itemDate = item.weekStart || item.rangeStart
    if (!itemDate) return false
    
    try {
      const date = parseISO(itemDate)
      return isWithinInterval(date, { start: startDate, end: endDate })
    } catch {
      return false
    }
  })
}

export function getDefaultDateRange(): { start: Date; end: Date } {
  const now = new Date()
  return {
    start: startOfWeek(subWeeks(now, 8)),
    end: endOfWeek(now),
  }
}

