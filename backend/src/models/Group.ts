import mongoose, { Document, Schema, Model } from 'mongoose';

// Restaurant type as defined in your specifications
export interface IRestaurant {
  name: string;
  location: string;
  restaurantId?: string;
  url?: string;
  phoneNumber?: string;
  cuisine?: string;
  priceRange?: string;
}

// Voting session for a single restaurant
export interface IVotingRound {
  restaurantId: string;
  restaurant: IRestaurant;
  startTime: Date;
  expiresAt: Date;
  votes: Map<string, boolean>; // userId -> yes/no vote
  yesVotes: number;
  noVotes: number;
  status: 'active' | 'majority_reached' | 'expired';
}

// Historical voting record for a restaurant
export interface IVotingHistoryEntry {
  restaurantId: string;
  restaurant: IRestaurant;
  yesVotes: number;
  noVotes: number;
  result: 'accepted' | 'rejected' | 'timeout';
  votedAt: Date;
}

// Base Group interface
export interface IGroup {
  roomId: string;
  completionTime: Date;
  maxMembers: number;
  members: string[];
  restaurantSelected: boolean;
  restaurant?: IRestaurant;
  
  // Legacy voting (keep for backward compatibility)
  votes: Map<string, string>;
  restaurantVotes: Map<string, number>;
  
  // NEW: Sequential voting fields
  votingMode: 'list' | 'sequential'; // 'list' = old mode, 'sequential' = new mode
  currentRound?: IVotingRound;
  votingHistory: string[]; // restaurantIds already shown
  votingHistoryDetailed: IVotingHistoryEntry[]; // Detailed history with vote counts
  restaurantPool: IRestaurant[]; // Pre-fetched restaurants to show
  maxRounds: number; // Maximum restaurants to show (default 15)
  votingTimeoutSeconds: number; // Timeout per restaurant (default 90)
  
  cuisines: string[];
  averageBudget?: number;
  averageRadius?: number;
  
  createdAt: Date;
  updatedAt: Date;
}

// Instance methods interface
export interface IGroupMethods {
  // Legacy methods
  addVote(userId: string, restaurantId: string): void;
  removeVote(userId: string): void;
  getWinningRestaurant(): string | null;
  hasAllVoted(): boolean;
  removeMember(userId: string): void;
  
  // NEW: Sequential voting methods
  startVotingRound(restaurant: IRestaurant): void;
  submitVote(userId: string, vote: boolean): void;
  checkMajority(): { hasMajority: boolean; result?: 'yes' | 'no'; votesFor: number; votesAgainst: number };
  endCurrentRound(): void;
  getBestRestaurantFromHistory(): IRestaurant | null;
}

// Document interface
export interface IGroupDocument extends Document, IGroup, IGroupMethods {
  groupId: string;
}

// Static methods interface
export interface IGroupModel extends Model<IGroup, {}, IGroupMethods> {}

// Schema definitions
const RestaurantSchema = new Schema<IRestaurant>(
  {
    name: { type: String, required: true },
    location: { type: String, required: true },
    restaurantId: { type: String },
    url: { type: String },
    phoneNumber: { type: String },
    cuisine: { type: String },
    priceRange: { type: String }
  },
  { _id: false }
);

const VotingRoundSchema = new Schema<IVotingRound>(
  {
    restaurantId: { type: String, required: true },
    restaurant: { type: RestaurantSchema, required: true },
    startTime: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    votes: {
      type: Map,
      of: Boolean,
      default: new Map()
    },
    yesVotes: { type: Number, default: 0 },
    noVotes: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['active', 'majority_reached', 'expired'],
      default: 'active'
    }
  },
  { _id: false }
);

const VotingHistoryEntrySchema = new Schema<IVotingHistoryEntry>(
  {
    restaurantId: { type: String, required: true },
    restaurant: { type: RestaurantSchema, required: true },
    yesVotes: { type: Number, required: true },
    noVotes: { type: Number, required: true },
    result: {
      type: String,
      enum: ['accepted', 'rejected', 'timeout'],
      required: true
    },
    votedAt: { type: Date, required: true }
  },
  { _id: false }
);

const GroupSchema = new Schema<IGroup, IGroupModel, IGroupMethods>(
  {
    roomId: {
      type: String,
      required: true,
      index: true
    },
    completionTime: {
      type: Date,
      required: true,
      index: true
    },
    maxMembers: {
      type: Number,
      required: true,
      default: 4,
      min: 2,
      max: 10
    },
    members: {
      type: [String],
      required: true,
      default: []
    },
    restaurantSelected: {
      type: Boolean,
      default: false
    },
    restaurant: {
      type: RestaurantSchema,
      default: null
    },
    votes: {
      type: Map,
      of: String,
      default: new Map()
    },
    restaurantVotes: {
      type: Map,
      of: Number,
      default: new Map()
    },
    // NEW FIELDS
    votingMode: {
      type: String,
      enum: ['list', 'sequential'],
      default: 'sequential' // Set new mode as default
    },
    currentRound: {
      type: VotingRoundSchema,
      default: null
    },
    votingHistory: {
      type: [String],
      default: []
    },
    votingHistoryDetailed: {
      type: [VotingHistoryEntrySchema],
      default: []
    },
    restaurantPool: {
      type: [RestaurantSchema],
      default: []
    },
    maxRounds: {
      type: Number,
      default: 15,
      min: 5,
      max: 30
    },
    votingTimeoutSeconds: {
      type: Number,
      default: 90,
      min: 30,
      max: 300
    },
    cuisines: {
      type: [String],
      default: []
    },
    averageBudget: {
      type: Number,
      min: 0,
      default: null
    },
    averageRadius: {
      type: Number,
      min: 0,
      default: null
    }
  },
  {
    timestamps: true,
    collection: 'groups'
  }
);

// Virtual for groupId
GroupSchema.virtual('groupId').get(function() {
  return this._id.toString();
});

// Configure JSON serialization
GroupSchema.set('toJSON', {
  virtuals: true,
  transform: function(_doc, ret) {
    const groupId = ret._id.toString();
    const { _id, __v, ...rest } = ret;
    return { 
      groupId, 
      ...rest
    };
  }
});

GroupSchema.set('toObject', { 
  virtuals: true 
});

// ============================================
// LEGACY METHODS (keep for backward compatibility)
// ============================================

GroupSchema.methods.addVote = function(userId: string, restaurantId: string): void {
  const previousVote = this.votes.get(userId);
  if (previousVote) {
    const prevCount = this.restaurantVotes.get(previousVote) || 0;
    this.restaurantVotes.set(previousVote, Math.max(0, prevCount - 1));
  }
  
  this.votes.set(userId, restaurantId);
  const currentCount = this.restaurantVotes.get(restaurantId) || 0;
  this.restaurantVotes.set(restaurantId, currentCount + 1);
};

GroupSchema.methods.removeVote = function(userId: string): void {
  const restaurantId = this.votes.get(userId);
  if (restaurantId) {
    this.votes.delete(userId);
    const count = this.restaurantVotes.get(restaurantId) || 0;
    this.restaurantVotes.set(restaurantId, Math.max(0, count - 1));
  }
};

GroupSchema.methods.getWinningRestaurant = function(): string | null {
  let maxVotes = 0;
  let winner: string | null = null;
  
  this.restaurantVotes.forEach((votes, restaurantId) => {
    if (votes > maxVotes) {
      maxVotes = votes;
      winner = restaurantId;
    }
  });
  
  return winner;
};

GroupSchema.methods.hasAllVoted = function(): boolean {
  return this.votes.size === this.members.length;
};

GroupSchema.methods.removeMember = function(userId: string): void {
  this.members = this.members.filter(id => id !== userId);
  this.removeVote(userId);
  
  // Also remove from current round if in sequential mode
  if (this.votingMode === 'sequential' && this.currentRound) {
    this.currentRound.votes.delete(userId);
    // Recalculate vote counts
    let yesVotes = 0;
    let noVotes = 0;
    this.currentRound.votes.forEach(vote => {
      if (vote) yesVotes++;
      else noVotes++;
    });
    this.currentRound.yesVotes = yesVotes;
    this.currentRound.noVotes = noVotes;
  }
};

// ============================================
// NEW SEQUENTIAL VOTING METHODS
// ============================================

/**
 * Start a new voting round for a restaurant
 */
GroupSchema.methods.startVotingRound = function(restaurant: IRestaurant): void {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + this.votingTimeoutSeconds * 1000);
  
  this.currentRound = {
    restaurantId: restaurant.restaurantId || '',
    restaurant: restaurant,
    startTime: now,
    expiresAt: expiresAt,
    votes: new Map(),
    yesVotes: 0,
    noVotes: 0,
    status: 'active'
  };
  
  this.votingHistory.push(restaurant.restaurantId || '');
};

/**
 * Submit a yes/no vote for the current restaurant
 */
GroupSchema.methods.submitVote = function(userId: string, vote: boolean): void {
  if (!this.currentRound) {
    throw new Error('No active voting round');
  }
  
  if (!this.members.includes(userId)) {
    throw new Error('User is not a member of this group');
  }
  
  // Add or update vote
  const previousVote = this.currentRound.votes.get(userId);
  this.currentRound.votes.set(userId, vote);
  
  // Update vote counts
  if (previousVote !== undefined) {
    // Remove previous vote count
    if (previousVote) this.currentRound.yesVotes--;
    else this.currentRound.noVotes--;
  }
  
  // Add new vote count
  if (vote) this.currentRound.yesVotes++;
  else this.currentRound.noVotes++;
};

/**
 * Check if majority has been reached for current round
 */
GroupSchema.methods.checkMajority = function(): { 
  hasMajority: boolean; 
  result?: 'yes' | 'no'; 
  votesFor: number; 
  votesAgainst: number;
} {
  if (!this.currentRound) {
    return { hasMajority: false, votesFor: 0, votesAgainst: 0 };
  }
  
  const totalMembers = this.members.length;
  const yesVotes = this.currentRound.yesVotes;
  const noVotes = this.currentRound.noVotes;
  
  // Calculate majority threshold
  let majorityThreshold: number;
  if (totalMembers === 2) {
    // For 2 members, both must agree
    majorityThreshold = 2;
  } else {
    // For 3+, need 50% + 1
    majorityThreshold = Math.floor(totalMembers / 2) + 1;
  }
  
  if (yesVotes >= majorityThreshold) {
    return { 
      hasMajority: true, 
      result: 'yes', 
      votesFor: yesVotes, 
      votesAgainst: noVotes 
    };
  }
  
  if (noVotes >= majorityThreshold) {
    return { 
      hasMajority: true, 
      result: 'no', 
      votesFor: yesVotes, 
      votesAgainst: noVotes 
    };
  }
  
  return { 
    hasMajority: false, 
    votesFor: yesVotes, 
    votesAgainst: noVotes 
  };
};

/**
 * End the current voting round
 */
GroupSchema.methods.endCurrentRound = function(): void {
  if (this.currentRound) {
    this.currentRound.status = 'expired';
  }
};

/**
 * Get the best restaurant from voting history (most yes votes)
 */
GroupSchema.methods.getBestRestaurantFromHistory = function(): IRestaurant | null {
  if (this.votingHistoryDetailed.length === 0) {
    // Fallback to first restaurant in pool if no history
    return this.restaurantPool.length > 0 ? this.restaurantPool[0] : null;
  }
  
  // Find restaurant with most yes votes from detailed history
  let bestRestaurant: IRestaurant | null = null;
  let maxYesVotes = -1;
  
  for (const entry of this.votingHistoryDetailed) {
    if (entry.yesVotes > maxYesVotes) {
      maxYesVotes = entry.yesVotes;
      bestRestaurant = entry.restaurant;
    }
  }
  
  // If no restaurant has any yes votes, return first from pool
  if (maxYesVotes === 0 && this.restaurantPool.length > 0) {
    return this.restaurantPool[0];
  }
  
  return bestRestaurant;
};

const Group = mongoose.model<IGroup, IGroupModel>('Group', GroupSchema);

export default Group;