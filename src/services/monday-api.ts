import mondaySdk from 'monday-sdk-js'
import type { WeeklyTotal, PostAnalytics, BoardConfig, Employee } from '@/types/analytics'

const monday = mondaySdk()

// Initialize the SDK
monday.setApiVersion('2024-01')

// Check if we're running inside Monday's iframe
export const isInsideMonday = (): boolean => {
  try {
    return window.self !== window.top
  } catch {
    return true // If we can't access, assume we're in an iframe
  }
}

// Development mode check
const isDev = import.meta.env.DEV

// Column IDs - these should match your board setup
const WEEKLY_COLUMNS = {
  employeeName: 'employee_name',
  personUrn: 'person_urn',
  weekStart: 'week_start',
  weekEnd: 'week_end',
  weekKey: 'week_key',
  impressions: 'impressions',
  membersReached: 'members_reached',
  reactions: 'reactions',
  comments: 'comments',
  reshares: 'reshares',
  syncedAt: 'synced_at',
  syncStatus: 'sync_status',
  syncNotes: 'sync_notes',
}

const POST_COLUMNS = {
  ...WEEKLY_COLUMNS,
  postUrn: 'post_urn',
  postUrl: 'post_url',
  postDate: 'post_date',
  rangeStart: 'range_start',
  rangeEnd: 'range_end',
  postKey: 'post_key',
}

export async function getContext(): Promise<{ boardId?: string; workspaceId?: string; userId?: number }> {
  return new Promise((resolve) => {
    monday.get('context').then((res) => {
      const data = res.data as unknown as { boardId?: string; workspaceId?: string | number; user?: { id: number | string } } | undefined
      resolve({
        boardId: data?.boardId,
        workspaceId: typeof data?.workspaceId === 'number' ? String(data.workspaceId) : data?.workspaceId,
        userId: typeof data?.user?.id === 'string' ? parseInt(data.user.id, 10) : data?.user?.id,
      })
    })
  })
}

/**
 * Get the current Monday.com user ID
 * Used to associate LinkedIn tokens with the user
 */
export async function getMondayUserId(): Promise<string> {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/37a99209-83e4-4cc5-b2e7-dc66d713db5d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H3',location:'src/services/monday-api.ts:getMondayUserId',message:'getMondayUserId_entry',data:{isDev,insideMonday:isInsideMonday()},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  // In dev mode outside Monday, use a mock user ID
  if (isDev && !isInsideMonday()) {
    const devUserId = localStorage.getItem('dev-mondayUserId') || 'dev-user-' + Date.now()
    localStorage.setItem('dev-mondayUserId', devUserId)
    console.log('[DEV] Using mock Monday user ID:', devUserId)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/37a99209-83e4-4cc5-b2e7-dc66d713db5d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H3',location:'src/services/monday-api.ts:getMondayUserId',message:'getMondayUserId_dev_id',data:{idPrefix:String(devUserId).slice(0,8)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return devUserId
  }

  return new Promise((resolve, reject) => {
    monday.get('context').then((res) => {
      const data = res.data as unknown as { user?: { id: number | string } } | undefined
      if (data?.user?.id) {
        // Handle both number and string user IDs
        const userId = typeof data.user.id === 'number' ? String(data.user.id) : data.user.id
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/37a99209-83e4-4cc5-b2e7-dc66d713db5d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H3',location:'src/services/monday-api.ts:getMondayUserId',message:'getMondayUserId_ctx_id',data:{idPrefix:String(userId).slice(0,6),idType:typeof data.user.id},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        resolve(userId)
      } else {
        reject(new Error('Could not get Monday.com user ID'))
      }
    }).catch(reject)
  })
}

export async function getBoardConfig(): Promise<BoardConfig> {
  // In dev mode outside Monday, check localStorage
  if (isDev && !isInsideMonday()) {
    const stored = localStorage.getItem('dev-boardConfig')
    if (stored) {
      return JSON.parse(stored)
    }
    return { weeklyTotalsBoardId: null, postAnalyticsBoardId: null }
  }

  try {
    const stored = await monday.storage.instance.getItem('boardConfig')
    if (stored.data?.value) {
      return JSON.parse(stored.data.value as string)
    }
  } catch (err) {
    console.warn('Could not fetch board config from Monday storage:', err)
  }
  return { weeklyTotalsBoardId: null, postAnalyticsBoardId: null }
}

export async function saveBoardConfig(config: BoardConfig): Promise<void> {
  // In dev mode outside Monday, use localStorage
  if (isDev && !isInsideMonday()) {
    localStorage.setItem('dev-boardConfig', JSON.stringify(config))
    return
  }

  try {
    await monday.storage.instance.setItem('boardConfig', JSON.stringify(config))
  } catch (err) {
    console.warn('Could not save board config to Monday storage:', err)
    // Fallback to localStorage
    localStorage.setItem('dev-boardConfig', JSON.stringify(config))
  }
}

export async function createWeeklyTotalsBoard(workspaceId: string): Promise<string> {
  // In dev mode outside Monday, return mock board ID
  if (isDev && !isInsideMonday()) {
    console.log('[DEV] Mock: Creating Weekly Totals board')
    return 'dev-weekly-board-123'
  }

  const mutation = `
    mutation {
      create_board(
        board_name: "LI | Weekly Totals"
        board_kind: public
        ${workspaceId !== 'main' ? `workspace_id: ${workspaceId}` : ''}
      ) {
        id
      }
    }
  `
  const response = await monday.api(mutation) as { data?: { create_board?: { id: string } }; errors?: unknown[] }
  
  if (response.errors) {
    console.error('Monday API error:', response.errors)
    throw new Error('Failed to create board. Check console for details.')
  }
  
  if (!response.data?.create_board?.id) {
    throw new Error('Failed to create board - no ID returned. Make sure you are running inside Monday.')
  }
  
  const boardId = response.data.create_board.id

  // Add columns
  await addColumnsToBoard(boardId, [
    { title: 'Employee Name', type: 'text', id: 'employee_name' },
    { title: 'Person URN', type: 'text', id: 'person_urn' },
    { title: 'Week Start', type: 'date', id: 'week_start' },
    { title: 'Week End', type: 'date', id: 'week_end' },
    { title: 'Week Key', type: 'text', id: 'week_key' },
    { title: 'Impressions', type: 'numbers', id: 'impressions' },
    { title: 'Members Reached', type: 'numbers', id: 'members_reached' },
    { title: 'Reactions', type: 'numbers', id: 'reactions' },
    { title: 'Comments', type: 'numbers', id: 'comments' },
    { title: 'Reshares', type: 'numbers', id: 'reshares' },
    { title: 'Synced At', type: 'date', id: 'synced_at' },
    { title: 'Sync Status', type: 'status', id: 'sync_status' },
    { title: 'Sync Notes', type: 'long_text', id: 'sync_notes' },
  ])

  return boardId
}

export async function createPostAnalyticsBoard(workspaceId: string): Promise<string> {
  // In dev mode outside Monday, return mock board ID
  if (isDev && !isInsideMonday()) {
    console.log('[DEV] Mock: Creating Post Analytics board')
    return 'dev-posts-board-456'
  }

  const mutation = `
    mutation {
      create_board(
        board_name: "LI | Post Analytics"
        board_kind: public
        ${workspaceId !== 'main' ? `workspace_id: ${workspaceId}` : ''}
      ) {
        id
      }
    }
  `
  const response = await monday.api(mutation) as { data?: { create_board?: { id: string } }; errors?: unknown[] }
  
  if (response.errors) {
    console.error('Monday API error:', response.errors)
    throw new Error('Failed to create board. Check console for details.')
  }
  
  if (!response.data?.create_board?.id) {
    throw new Error('Failed to create board - no ID returned. Make sure you are running inside Monday.')
  }
  
  const boardId = response.data.create_board.id

  // Add columns
  await addColumnsToBoard(boardId, [
    { title: 'Employee Name', type: 'text', id: 'employee_name' },
    { title: 'Person URN', type: 'text', id: 'person_urn' },
    { title: 'Post URN', type: 'text', id: 'post_urn' },
    { title: 'Post URL', type: 'link', id: 'post_url' },
    { title: 'Post Date', type: 'date', id: 'post_date' },
    { title: 'Range Start', type: 'date', id: 'range_start' },
    { title: 'Range End', type: 'date', id: 'range_end' },
    { title: 'Post Key', type: 'text', id: 'post_key' },
    { title: 'Impressions', type: 'numbers', id: 'impressions' },
    { title: 'Members Reached', type: 'numbers', id: 'members_reached' },
    { title: 'Reactions', type: 'numbers', id: 'reactions' },
    { title: 'Comments', type: 'numbers', id: 'comments' },
    { title: 'Reshares', type: 'numbers', id: 'reshares' },
    { title: 'Synced At', type: 'date', id: 'synced_at' },
    { title: 'Sync Status', type: 'status', id: 'sync_status' },
    { title: 'Sync Notes', type: 'long_text', id: 'sync_notes' },
  ])

  return boardId
}

async function addColumnsToBoard(
  boardId: string,
  columns: Array<{ title: string; type: string; id: string }>
): Promise<void> {
  for (const col of columns) {
    const mutation = `
      mutation {
        create_column(
          board_id: ${boardId}
          title: "${col.title}"
          column_type: ${col.type}
          id: "${col.id}"
        ) {
          id
        }
      }
    `
    await monday.api(mutation)
  }
}

interface BoardItem {
  id: string
  name: string
  column_values: Array<{ id: string; text: string; value: string }>
}

interface BoardResponse {
  data: {
    boards: Array<{
      items_page: {
        items: BoardItem[]
      }
    }>
  }
}

// Mock data for development
const MOCK_WEEKLY_DATA: WeeklyTotal[] = [
  { id: '1', itemId: '1', employeeId: '1', employeeName: 'Alice Johnson', personUrn: 'urn:li:person:abc123', weekStart: '2024-12-16', weekEnd: '2024-12-22', weekKey: 'abc123|2024-12-16', impressions: 12500, membersReached: 8400, reactions: 245, comments: 32, reshares: 18, engagements: 295, engagementRate: 0.0236, syncedAt: '2024-12-23', syncStatus: 'OK', syncNotes: '' },
  { id: '2', itemId: '2', employeeId: '1', employeeName: 'Alice Johnson', personUrn: 'urn:li:person:abc123', weekStart: '2024-12-09', weekEnd: '2024-12-15', weekKey: 'abc123|2024-12-09', impressions: 9800, membersReached: 6200, reactions: 189, comments: 28, reshares: 12, engagements: 229, engagementRate: 0.0234, syncedAt: '2024-12-16', syncStatus: 'OK', syncNotes: '' },
  { id: '3', itemId: '3', employeeId: '2', employeeName: 'Bob Smith', personUrn: 'urn:li:person:def456', weekStart: '2024-12-16', weekEnd: '2024-12-22', weekKey: 'def456|2024-12-16', impressions: 8900, membersReached: 5100, reactions: 156, comments: 19, reshares: 8, engagements: 183, engagementRate: 0.0206, syncedAt: '2024-12-23', syncStatus: 'OK', syncNotes: '' },
  { id: '4', itemId: '4', employeeId: '2', employeeName: 'Bob Smith', personUrn: 'urn:li:person:def456', weekStart: '2024-12-09', weekEnd: '2024-12-15', weekKey: 'def456|2024-12-09', impressions: 7200, membersReached: 4800, reactions: 134, comments: 15, reshares: 6, engagements: 155, engagementRate: 0.0215, syncedAt: '2024-12-16', syncStatus: 'OK', syncNotes: '' },
  { id: '5', itemId: '5', employeeId: '3', employeeName: 'Carol Davis', personUrn: 'urn:li:person:ghi789', weekStart: '2024-12-16', weekEnd: '2024-12-22', weekKey: 'ghi789|2024-12-16', impressions: 15200, membersReached: 9800, reactions: 312, comments: 45, reshares: 24, engagements: 381, engagementRate: 0.0251, syncedAt: '2024-12-23', syncStatus: 'OK', syncNotes: '' },
  { id: '6', itemId: '6', employeeId: '3', employeeName: 'Carol Davis', personUrn: 'urn:li:person:ghi789', weekStart: '2024-12-09', weekEnd: '2024-12-15', weekKey: 'ghi789|2024-12-09', impressions: 11800, membersReached: 7600, reactions: 267, comments: 38, reshares: 19, engagements: 324, engagementRate: 0.0275, syncedAt: '2024-12-16', syncStatus: 'OK', syncNotes: '' },
]

const MOCK_POSTS_DATA: PostAnalytics[] = [
  { id: '1', itemId: '1', employeeId: '1', employeeName: 'Alice Johnson', personUrn: 'urn:li:person:abc123', postUrn: 'urn:li:share:post1', postUrl: 'https://linkedin.com/posts/alice-post-1', postDate: '2024-12-18', rangeStart: '2024-12-18', rangeEnd: '2024-12-22', postKey: 'post1|2024-12-18|2024-12-22', impressions: 5200, membersReached: 3400, reactions: 98, comments: 12, reshares: 6, engagements: 116, engagementRate: 0.0223, syncedAt: '2024-12-23', syncStatus: 'OK', syncNotes: '' },
  { id: '2', itemId: '2', employeeId: '3', employeeName: 'Carol Davis', personUrn: 'urn:li:person:ghi789', postUrn: 'urn:li:share:post2', postUrl: 'https://linkedin.com/posts/carol-post-1', postDate: '2024-12-17', rangeStart: '2024-12-17', rangeEnd: '2024-12-22', postKey: 'post2|2024-12-17|2024-12-22', impressions: 8900, membersReached: 5600, reactions: 187, comments: 28, reshares: 15, engagements: 230, engagementRate: 0.0258, syncedAt: '2024-12-23', syncStatus: 'OK', syncNotes: '' },
  { id: '3', itemId: '3', employeeId: '2', employeeName: 'Bob Smith', personUrn: 'urn:li:person:def456', postUrn: 'urn:li:share:post3', postUrl: 'https://linkedin.com/posts/bob-post-1', postDate: '2024-12-19', rangeStart: '2024-12-19', rangeEnd: '2024-12-22', postKey: 'post3|2024-12-19|2024-12-22', impressions: 3800, membersReached: 2200, reactions: 67, comments: 8, reshares: 3, engagements: 78, engagementRate: 0.0205, syncedAt: '2024-12-23', syncStatus: 'OK', syncNotes: '' },
  { id: '4', itemId: '4', employeeId: '1', employeeName: 'Alice Johnson', personUrn: 'urn:li:person:abc123', postUrn: 'urn:li:share:post4', postUrl: 'https://linkedin.com/posts/alice-post-2', postDate: '2024-12-20', rangeStart: '2024-12-20', rangeEnd: '2024-12-22', postKey: 'post4|2024-12-20|2024-12-22', impressions: 4100, membersReached: 2800, reactions: 89, comments: 11, reshares: 5, engagements: 105, engagementRate: 0.0256, syncedAt: '2024-12-23', syncStatus: 'OK', syncNotes: '' },
  { id: '5', itemId: '5', employeeId: '3', employeeName: 'Carol Davis', personUrn: 'urn:li:person:ghi789', postUrn: 'urn:li:share:post5', postUrl: 'https://linkedin.com/posts/carol-post-2', postDate: '2024-12-21', rangeStart: '2024-12-21', rangeEnd: '2024-12-22', postKey: 'post5|2024-12-21|2024-12-22', impressions: 6300, membersReached: 4100, reactions: 145, comments: 19, reshares: 9, engagements: 173, engagementRate: 0.0275, syncedAt: '2024-12-23', syncStatus: 'OK', syncNotes: '' },
]

export async function fetchWeeklyTotals(
  boardId: string,
  filters?: { employeeIds?: string[]; startDate?: string; endDate?: string }
): Promise<WeeklyTotal[]> {
  // In dev mode outside Monday, return mock data
  if (isDev && !isInsideMonday()) {
    return MOCK_WEEKLY_DATA.filter((item) => {
      if (filters?.employeeIds?.length && !filters.employeeIds.includes(item.employeeName)) {
        return false
      }
      if (filters?.startDate && item.weekStart < filters.startDate) {
        return false
      }
      if (filters?.endDate && item.weekEnd > filters.endDate) {
        return false
      }
      return true
    })
  }

  const query = `
    query {
      boards(ids: [${boardId}]) {
        items_page(limit: 500) {
          items {
            id
            name
            column_values {
              id
              text
              value
            }
          }
        }
      }
    }
  `
  
  const response = await monday.api(query) as BoardResponse
  const items = response.data?.boards?.[0]?.items_page?.items || []
  
  return items.map((item) => {
    const getValue = (colId: string) => {
      const col = item.column_values.find((c) => c.id === colId)
      return col?.text || ''
    }
    
    const getNumber = (colId: string) => {
      const val = getValue(colId)
      return val ? parseFloat(val) : 0
    }
    
    const reactions = getNumber(WEEKLY_COLUMNS.reactions)
    const comments = getNumber(WEEKLY_COLUMNS.comments)
    const reshares = getNumber(WEEKLY_COLUMNS.reshares)
    const impressions = getNumber(WEEKLY_COLUMNS.impressions)
    const engagements = reactions + comments + reshares
    
    return {
      id: item.id,
      itemId: item.id,
      employeeId: '',
      employeeName: getValue(WEEKLY_COLUMNS.employeeName),
      personUrn: getValue(WEEKLY_COLUMNS.personUrn),
      weekStart: getValue(WEEKLY_COLUMNS.weekStart),
      weekEnd: getValue(WEEKLY_COLUMNS.weekEnd),
      weekKey: getValue(WEEKLY_COLUMNS.weekKey),
      impressions,
      membersReached: getNumber(WEEKLY_COLUMNS.membersReached),
      reactions,
      comments,
      reshares,
      engagements,
      engagementRate: impressions > 0 ? engagements / impressions : 0,
      syncedAt: getValue(WEEKLY_COLUMNS.syncedAt),
      syncStatus: getValue(WEEKLY_COLUMNS.syncStatus) as 'OK' | 'Partial' | 'Error',
      syncNotes: getValue(WEEKLY_COLUMNS.syncNotes),
    }
  }).filter((item: WeeklyTotal) => {
    if (filters?.employeeIds?.length && !filters.employeeIds.includes(item.employeeName)) {
      return false
    }
    if (filters?.startDate && item.weekStart < filters.startDate) {
      return false
    }
    if (filters?.endDate && item.weekEnd > filters.endDate) {
      return false
    }
    return true
  })
}

export async function fetchPostAnalytics(
  boardId: string,
  filters?: { employeeIds?: string[]; startDate?: string; endDate?: string }
): Promise<PostAnalytics[]> {
  // In dev mode outside Monday, return mock data
  if (isDev && !isInsideMonday()) {
    return MOCK_POSTS_DATA.filter((item) => {
      if (filters?.employeeIds?.length && !filters.employeeIds.includes(item.employeeName)) {
        return false
      }
      if (filters?.startDate && item.rangeStart < filters.startDate) {
        return false
      }
      if (filters?.endDate && item.rangeEnd > filters.endDate) {
        return false
      }
      return true
    })
  }

  const query = `
    query {
      boards(ids: [${boardId}]) {
        items_page(limit: 500) {
          items {
            id
            name
            column_values {
              id
              text
              value
            }
          }
        }
      }
    }
  `
  
  const response = await monday.api(query) as BoardResponse
  const items = response.data?.boards?.[0]?.items_page?.items || []
  
  return items.map((item) => {
    const getValue = (colId: string) => {
      const col = item.column_values.find((c) => c.id === colId)
      return col?.text || ''
    }
    
    const getNumber = (colId: string) => {
      const val = getValue(colId)
      return val ? parseFloat(val) : 0
    }
    
    const reactions = getNumber(POST_COLUMNS.reactions)
    const comments = getNumber(POST_COLUMNS.comments)
    const reshares = getNumber(POST_COLUMNS.reshares)
    const impressions = getNumber(POST_COLUMNS.impressions)
    const engagements = reactions + comments + reshares
    
    return {
      id: item.id,
      itemId: item.id,
      employeeId: '',
      employeeName: getValue(POST_COLUMNS.employeeName),
      personUrn: getValue(POST_COLUMNS.personUrn),
      postUrn: getValue(POST_COLUMNS.postUrn),
      postUrl: getValue(POST_COLUMNS.postUrl),
      postDate: getValue(POST_COLUMNS.postDate),
      rangeStart: getValue(POST_COLUMNS.rangeStart),
      rangeEnd: getValue(POST_COLUMNS.rangeEnd),
      postKey: getValue(POST_COLUMNS.postKey),
      impressions,
      membersReached: getNumber(POST_COLUMNS.membersReached),
      reactions,
      comments,
      reshares,
      engagements,
      engagementRate: impressions > 0 ? engagements / impressions : 0,
      syncedAt: getValue(POST_COLUMNS.syncedAt),
      syncStatus: getValue(POST_COLUMNS.syncStatus) as 'OK' | 'Partial' | 'Error',
      syncNotes: getValue(POST_COLUMNS.syncNotes),
    }
  }).filter((item: PostAnalytics) => {
    if (filters?.employeeIds?.length && !filters.employeeIds.includes(item.employeeName)) {
      return false
    }
    if (filters?.startDate && item.rangeStart < filters.startDate) {
      return false
    }
    if (filters?.endDate && item.rangeEnd > filters.endDate) {
      return false
    }
    return true
  })
}

export async function fetchUniqueEmployees(boardId: string): Promise<Employee[]> {
  // In dev mode outside Monday, return mock employees
  if (isDev && !isInsideMonday()) {
    return [
      { id: '1', name: 'Alice Johnson', personUrn: 'urn:li:person:abc123', linkedInConnected: true },
      { id: '2', name: 'Bob Smith', personUrn: 'urn:li:person:def456', linkedInConnected: true },
      { id: '3', name: 'Carol Davis', personUrn: 'urn:li:person:ghi789', linkedInConnected: true },
    ]
  }

  const query = `
    query {
      boards(ids: [${boardId}]) {
        items_page(limit: 500) {
          items {
            column_values {
              id
              text
            }
          }
        }
      }
    }
  `
  
  const response = await monday.api(query) as BoardResponse
  const items = response.data?.boards?.[0]?.items_page?.items || []
  
  const employeeMap = new Map<string, Employee>()
  
  items.forEach((item) => {
    const name = item.column_values.find((c) => c.id === 'employee_name')?.text
    const urn = item.column_values.find((c) => c.id === 'person_urn')?.text
    
    if (name && !employeeMap.has(name)) {
      employeeMap.set(name, {
        id: name,
        name,
        personUrn: urn || '',
        linkedInConnected: false,
      })
    }
  })
  
  return Array.from(employeeMap.values())
}

export async function fetchSyncErrors(
  weeklyBoardId: string,
  postsBoardId: string
): Promise<Array<{ boardName: string; itemId: string; employeeName: string; error: string; timestamp: string }>> {
  const errors: Array<{ boardName: string; itemId: string; employeeName: string; error: string; timestamp: string }> = []
  
  const fetchErrors = async (boardId: string, boardName: string) => {
    const query = `
      query {
        boards(ids: [${boardId}]) {
          items_page(limit: 100) {
            items {
              id
              column_values {
                id
                text
              }
            }
          }
        }
      }
    `
    
    const response = await monday.api(query) as BoardResponse
    const items = response.data?.boards?.[0]?.items_page?.items || []
    
    items.forEach((item) => {
      const status = item.column_values.find((c) => c.id === 'sync_status')?.text
      if (status === 'Error') {
        errors.push({
          boardName,
          itemId: item.id,
          employeeName: item.column_values.find((c) => c.id === 'employee_name')?.text || 'Unknown',
          error: item.column_values.find((c) => c.id === 'sync_notes')?.text || 'Unknown error',
          timestamp: item.column_values.find((c) => c.id === 'synced_at')?.text || '',
        })
      }
    })
  }
  
  if (weeklyBoardId) await fetchErrors(weeklyBoardId, 'LI | Weekly Totals')
  if (postsBoardId) await fetchErrors(postsBoardId, 'LI | Post Analytics')
  
  return errors
}

export async function upsertWeeklyTotal(
  boardId: string,
  data: Partial<WeeklyTotal>
): Promise<string> {
  // Check if item exists by week_key
  const existingQuery = `
    query {
      boards(ids: [${boardId}]) {
        items_page(limit: 500) {
          items {
            id
            column_values {
              id
              text
            }
          }
        }
      }
    }
  `
  
  const existingResponse = await monday.api(existingQuery) as BoardResponse
  const items = existingResponse.data?.boards?.[0]?.items_page?.items || []
  const existing = items.find((item) =>
    item.column_values.find((c) => c.id === 'week_key')?.text === data.weekKey
  )
  
  const columnValues = JSON.stringify({
    [WEEKLY_COLUMNS.employeeName]: data.employeeName,
    [WEEKLY_COLUMNS.personUrn]: data.personUrn,
    [WEEKLY_COLUMNS.weekStart]: { date: data.weekStart },
    [WEEKLY_COLUMNS.weekEnd]: { date: data.weekEnd },
    [WEEKLY_COLUMNS.weekKey]: data.weekKey,
    [WEEKLY_COLUMNS.impressions]: data.impressions?.toString(),
    [WEEKLY_COLUMNS.membersReached]: data.membersReached?.toString(),
    [WEEKLY_COLUMNS.reactions]: data.reactions?.toString(),
    [WEEKLY_COLUMNS.comments]: data.comments?.toString(),
    [WEEKLY_COLUMNS.reshares]: data.reshares?.toString(),
    [WEEKLY_COLUMNS.syncedAt]: { date: new Date().toISOString().split('T')[0] },
    [WEEKLY_COLUMNS.syncStatus]: { label: data.syncStatus || 'OK' },
    [WEEKLY_COLUMNS.syncNotes]: data.syncNotes || '',
  })
  
  if (existing) {
    // Update
    const mutation = `
      mutation {
        change_multiple_column_values(
          item_id: ${existing.id}
          board_id: ${boardId}
          column_values: ${JSON.stringify(columnValues)}
        ) {
          id
        }
      }
    `
    await monday.api(mutation)
    return existing.id
  } else {
    // Create
    const mutation = `
      mutation {
        create_item(
          board_id: ${boardId}
          item_name: "${data.employeeName} - ${data.weekStart}"
          column_values: ${JSON.stringify(columnValues)}
        ) {
          id
        }
      }
    `
    const response = await monday.api(mutation) as { data: { create_item: { id: string } } }
    return response.data.create_item.id
  }
}

export { monday }
