import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchWeeklyTotals,
  fetchPostAnalytics,
  fetchUniqueEmployees,
  fetchSyncErrors,
  getBoardConfig,
  saveBoardConfig,
  createWeeklyTotalsBoard,
  createPostAnalyticsBoard,
} from '@/services/monday-api'
import type { BoardConfig, WeeklyTotal, PostAnalytics, Employee } from '@/types/analytics'

export function useBoardConfig() {
  return useQuery({
    queryKey: ['boardConfig'],
    queryFn: getBoardConfig,
  })
}

export function useSetupBoards() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (workspaceId: string) => {
      const weeklyBoardId = await createWeeklyTotalsBoard(workspaceId)
      const postsBoardId = await createPostAnalyticsBoard(workspaceId)
      
      const config: BoardConfig = {
        weeklyTotalsBoardId: weeklyBoardId,
        postAnalyticsBoardId: postsBoardId,
      }
      
      await saveBoardConfig(config)
      return config
    },
    onSuccess: (config) => {
      queryClient.setQueryData(['boardConfig'], config)
    },
  })
}

export function useWeeklyTotals(
  boardId: string | null,
  filters?: { employeeIds?: string[]; startDate?: string; endDate?: string }
) {
  return useQuery<WeeklyTotal[]>({
    queryKey: ['weeklyTotals', boardId, filters],
    queryFn: () => fetchWeeklyTotals(boardId!, filters),
    enabled: !!boardId,
  })
}

export function usePostAnalytics(
  boardId: string | null,
  filters?: { employeeIds?: string[]; startDate?: string; endDate?: string }
) {
  return useQuery<PostAnalytics[]>({
    queryKey: ['postAnalytics', boardId, filters],
    queryFn: () => fetchPostAnalytics(boardId!, filters),
    enabled: !!boardId,
  })
}

export function useEmployees(boardId: string | null) {
  return useQuery<Employee[]>({
    queryKey: ['employees', boardId],
    queryFn: () => fetchUniqueEmployees(boardId!),
    enabled: !!boardId,
  })
}

export function useSyncErrors(weeklyBoardId: string | null, postsBoardId: string | null) {
  return useQuery({
    queryKey: ['syncErrors', weeklyBoardId, postsBoardId],
    queryFn: () => fetchSyncErrors(weeklyBoardId!, postsBoardId!),
    enabled: !!weeklyBoardId || !!postsBoardId,
    refetchInterval: 30000, // Refresh every 30 seconds
  })
}

