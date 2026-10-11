export interface User {
  id: string
  username: string
  email: string
  fullName?: string
  phone?: string
  location?: string
  rank?: string
  level: number
  sponsorUsername?: string
  memberSince: Date
  activeSince?: Date
  role: 'USER' | 'ADMIN'
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  createdAt: Date
  updatedAt: Date
  lastSyncAt?: Date
}

export interface Wallet {
  id: string
  userId: string
  capital: number
  totalInvested: number
  totalProfit: number
  totalEarned: number
  totalWithdrawn: number
  availableBalance: number
  updatedAt: Date
}

export interface Transaction {
  id: string
  userId: string
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'COMMISSION' | 'EARNINGS' | 'BONUS'
  amount: number
  currency: string
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  reference?: string
  description?: string
  createdAt: Date
  updatedAt: Date
}

export interface ReferralLink {
  id: string
  userId: string
  side: 'left' | 'right'
  url: string
  createdAt: Date
  updatedAt: Date
}

export interface ReferralMember {
  id: string
  ownerUserId: string
  externalMemberId: string
  username: string
  name?: string
  side: 'left' | 'right'
  parentExternalMemberId?: string
  status: 'ACTIVE' | 'INACTIVE'
  level: number
  pv: number
  syncedAt: Date
}

export interface SyncRun {
  id: string
  userId: string
  provider: string
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SYNC_REQUIRES_USER_ACTION'
  startedAt: Date
  completedAt?: Date
  errorMessage?: string
  recordsProcessed: number
  createdAt: Date
}

export interface SyncValidationError {
  id: string
  syncRunId: string
  errorType: string
  errorMessage: string
  recordIdentifier?: string
  severity: 'warning' | 'error' | 'critical'
  createdAt: Date
}

export interface AuditLog {
  id: string
  userId: string
  action: string
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  createdAt: Date
}

export interface ExternalProfile {
  username: string
  fullName: string
  email: string
  phone?: string
  location?: string
  rank: string
  sponsorUsername?: string
  memberSince: Date
  activeSince?: Date
  capital: number
  totalInvested: number
  totalProfit: number
  totalEarned: number
  totalWithdrawn: number
}

export interface ExternalDashboard {
  profile: ExternalProfile
  marketData?: MarketData
}

export interface MarketData {
  EUR_USD: number
  BITCOIN: number
  ETHEREUM: number
  timestamp: Date
}

export interface ExternalTree {
  root: ExternalMemberNode
  totalMembers: number
  activeMembers: number
  inactiveMembers: number
  availablePositions: number
}

export interface ExternalMemberNode {
  id: string
  username: string
  name: string
  status: 'AVAILABLE' | 'ACTIVE' | 'INACTIVE'
  side: 'left' | 'right'
  children: ExternalMemberNode[]
}

export interface ReferralsResponse {
  leftTeam: ReferralMember[]
  rightTeam: ReferralMember[]
  totalMembers: number
  activeMembers: number
  leftTeamCount: number
  rightTeamCount: number
  leftPv: number
  rightPv: number
  totalPv: number
}

export interface SyncStatus {
  status: string
  lastSuccessfulSync?: Date
  lastAttempt?: Date
  recordsProcessed: number
  errorMessage?: string
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: ApiError
}

export interface ApiError {
  code: string
  message: string
}

export interface PaginationParams {
  page: number
  limit: number
  search?: string
  sortBy?: string
  order?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}