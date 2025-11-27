import { Request } from 'express';

/**
 * Express Request with authenticated user
 */
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    googleId: string;
  };
}

// NEW: this version guarantees user exists after authMiddleware
export interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    googleId: string;
  };
}

/**
 * Socket Event Types
 */
export interface SocketJoinRoomData {
  userId: string;
}

export interface SocketLeaveRoomData {
  userId: string;
}

export interface SocketRoomUpdateData {
  roomId: string;
  members: string[];
  expiresAt: string;
  status: 'waiting' | 'matched' | 'expired';
}

export interface SocketGroupReadyData {
  groupId: string;
  roomId: string;
  members: string[];
}

export interface SocketVoteUpdateData {
  groupId: string;
  votes: Record<string, number>;
}

export interface SocketRestaurantSelectedData {
  groupId: string;
  restaurant: RestaurantType;
}

// ============================================
// NEW: SEQUENTIAL VOTING SOCKET EVENT TYPES
// ============================================

export interface NewVotingRoundEvent {
  restaurant: RestaurantType;
  roundNumber: number;
  totalRounds: number;
  timeoutSeconds: number;
  expiresAt: string; // ISO string
}

export interface VoteUpdateEvent {
  userId: string;
  vote: boolean;
  yesVotes: number;
  noVotes: number;
  totalMembers: number;
  votesRemaining: number;
}

export interface MajorityReachedEvent {
  result: 'yes' | 'no';
  restaurantId: string;
}

export interface RoundTimeoutEvent {
  restaurantId: string;
}

/**
 * API Request/Response Types
 */
export interface UserProfileResponse {
  userId: string;
  name: string;
  bio?: string;
  profilePicture?: string;
  contactNumber?: string;
}

export interface UserSettingsResponse {
  userId: string;
  name: string;
  bio?: string;
  preference: string[];
  profilePicture?: string;
  credibilityScore: number;
  contactNumber?: string;
  budget: number;
  radiusKm: number;
  status: number;
  roomID?: string;
  groupID?: string;
}

export interface RoomStatusResponse {
  roomID: string;
  completionTime: number;
  members: string[];
  groupReady: boolean;
  status: 'waiting' | 'matched' | 'expired';
}

export interface GroupStatusResponse {
  roomId: string;
  completionTime: number;
  numMembers: number;
  users: string[];
  restaurantSelected: boolean;
  restaurant?: RestaurantType;
  status: 'voting' | 'matched' | 'completed' | 'disbanded';
  cuisines?: string[];
  averageBudget?: number;
  averageRadius?: number;
}

export interface RestaurantType {
  name: string;
  location: string;
  restaurantId?: string;
  address?: string;
  priceLevel?: number;
  rating?: number;
  photos?: string[];
  phoneNumber?: string;
  website?: string;
  url?: string;
  cuisine?: string;
  priceRange?: string;
}

export interface JoinMatchingRequest {
  cuisine: string[];
  budget: number;
  radiusKm: number;
  credibilityScore: number;
}

export interface LeaveRoomRequest {
  status?: string;
}

export interface VoteRestaurantRequest {
  restaurantID: string;
  restaurant?: RestaurantType;
}

export interface VoteRestaurantResponse {
  message: string;
  Current_votes: Record<string, number>;
}

// ============================================
// NEW: SEQUENTIAL VOTING REQUEST/RESPONSE TYPES
// ============================================

export interface InitializeVotingRequest {
  // No body needed, groupId comes from URL params
}

export interface InitializeVotingResponse {
  success: boolean;
  currentRestaurant?: RestaurantType;
  message: string;
}

export interface SubmitSequentialVoteRequest {
  vote: boolean; // true = yes, false = no
}

export interface SubmitSequentialVoteResponse {
  success: boolean;
  majorityReached: boolean;
  result?: 'yes' | 'no';
  nextRestaurant?: RestaurantType;
  selectedRestaurant?: RestaurantType;
  votingComplete?: boolean;
  message: string;
}

export interface VotingRoundStatus {
  hasActiveRound: boolean;
  currentRestaurant?: RestaurantType;
  votes?: Array<{ userId: string; vote: boolean }>;
  yesVotes?: number;
  noVotes?: number;
  expiresAt?: Date;
  roundNumber?: number;
  totalRounds?: number;
  timeRemaining?: number; // seconds
}

/**
 * Standard API Response Format
 */
export interface APIResponse<T = unknown> {
  Status: number;
  Message: {
    error?: string;
    text?: string;
    [key: string]: unknown;
  };
  Body: T | null;
}

/**
 * Credibility Types
 */
export interface CredibilityChangeResponse {
  message: string;
  previousScore: number;
  newScore: number;
  scoreChange: number;
}

export interface CredibilityStatsResponse {
  currentScore: number;
  totalCheckIns: number;
  missedCheckIns: number;
  totalLogs: number;
  checkIns: number;
  leftGroups: number;
  lastCheckIn?: Date;
}

/**
 * Auth Types
 */
export interface GoogleAuthRequest {
  idToken: string;
}

export interface AuthResponse {
  token: string;
  user: {
    userId: string;
    name: string;
    email: string;
    profilePicture?: string;
    credibilityScore: number;
  };
}

/**
 * Pagination Types
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

/**
 * Search/Filter Types
 */
export interface RestaurantSearchParams {
  lat: number;
  lng: number;
  radius?: number;
  cuisineTypes?: string[];
  priceLevel?: number;
  minRating?: number;
}

/**
 * Notification payload structure
 */
export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>; // Changed to allow any string key-value pairs
}


/**
 * Credibility Code Types
 */
export interface CredibilityCodeResponse {
  code: string;
  expiresAt: number;
  groupId: string;
}

export interface VerifyCodeRequest {
  code: string;
}

export interface VerifyCodeResponse {
  success: boolean;
  message: string;
  verifiedUserId: string;
}

export interface DeductScoreResponse {
  success: boolean;
  message: string;
  scoreDeducted: number;
  newScore: number;
}

/**
 * Utility Types
 */
export type UserStatus = 'active' | 'in_waiting_room' | 'in_group' | 'inactive';
export type RoomStatus = 'waiting' | 'matched' | 'expired';
export type GroupStatus = 'voting' | 'matched' | 'completed' | 'disbanded';
export type CredibilityAction = 'check_in' | 'missed_check_in' | 'left_group' | 'manual_adjustment';
export type VotingMode = 'list' | 'sequential';