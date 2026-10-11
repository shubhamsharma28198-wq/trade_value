// App constants
export const APP_NAME = 'TradeVault'
export const APP_URL = process.env.APP_URL || 'http://localhost:3000'
export const API_URL = process.env.API_URL || 'http://localhost:4000'

// Role constants
export const ROLE = {
  USER: 'USER' as const,
  ADMIN: 'ADMIN' as const,
} as const

export type Role = keyof typeof ROLE

// Status constants
export const STATUS = {
  ACTIVE: 'ACTIVE' as const,
  INACTIVE: 'INACTIVE' as const,
  SUSPENDED: 'SUSPENDED' as const,
} as const

export type UserStatus = keyof typeof STATUS

// Sync constants
export const SYNC_STATUS = {
  PENDING: 'PENDING' as const,
  RUNNING: 'RUNNING' as const,
  SUCCESS: 'SUCCESS' as const,
  FAILED: 'FAILED' as const,
  SYNC_REQUIRES_USER_ACTION: 'SYNC_REQUIRES_USER_ACTION' as const,
} as const

export type SyncStatusType = keyof typeof SYNC_STATUS

// Sync interval
export const DEFAULT_SYNC_INTERVAL_MINUTES = 30

// FXUNIFI constants
export const FXUNIFI = {
  BASE_URL: 'https://fxunifi.com',
  LOGIN_PATH: '/login',
  DASHBOARD_PATH: '/dashboard',
  PROFILE_PATH: '/profile',
  WALLET_PATH: '/wallet',
  REFERRALS_PATH: '/referrals',
  BINARY_TREE_PATH: '/binary-tree',
} as const

// Color palette from design system
export const COLORS = {
  BACKGROUND: '#070b07',
  PANEL: '#111711',
  BORDER: '#303729',
  PRIMARY: '#f3e51b',
  ACCENT: '#00c7a1',
  TEXT: '#f2f4e9',
  MUTED: '#aeb4a5',
  DANGER: '#ef4444',
  SUCCESS: '#22c55e',
  NEON_GREEN: '#0f0f1f',
} as const

// Rate limiting
export const RATE_LIMIT = {
  WINDOW_MS: 900000, // 15 minutes
  MAX_REQUESTS: 100,
} as const

// JWT defaults
export const JWT_DEFAULTS = {
  EXPIRES_IN: '15m',
  REFRESH_EXPIRES_IN: '7d',
} as const

// Prisma model names
export const PRISMA_MODELS = {
  USER: 'User',
  EXTERNAL_ACCOUNT: 'ExternalAccount',
  WALLET: 'Wallet',
  REFERRAL_LINK: 'ReferralLink',
  TRANSACTION: 'Transaction',
  REFERRAL_MEMBER: 'ReferralMember',
  SYNC_RUN: 'SyncRun',
  AUDIT_LOG: 'AuditLog',
  SYNC_VALIDATION_ERROR: 'SyncValidationError',
} as const