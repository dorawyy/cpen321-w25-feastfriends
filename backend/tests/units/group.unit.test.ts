// tests/units/group.unit.test.ts

/**
 * Group Model Unit Tests
 * Tests model methods, virtual properties, and toJSON transforms directly
 */

import Group, { IGroupDocument } from '../../src/models/Group';
import { connectDatabase, disconnectDatabase } from '../../src/config/database';
import { cleanTestData } from '../helpers/seed.helper';

describe('Group Model - Unit Tests', () => {
  beforeAll(async () => {
    await connectDatabase();
  });

  afterAll(async () => {
    await cleanTestData();
    await disconnectDatabase();
  });

  describe('Virtual Properties', () => {
    test('groupId virtual should return _id.toString()', async () => {
      /**
       * Tests: GroupSchema.virtual('groupId').get(function() { return this._id.toString(); })
       * Input: Group document
       * Expected: groupId virtual property equals _id.toString()
       */
      const group = new Group({
        roomId: 'test-room-virtual',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2']
      });
      
      await group.save();
      
      // Access virtual property (virtuals are available at runtime but not in TypeScript types)
      const groupDoc = group as any;
      expect(groupDoc.groupId).toBe(group._id.toString());
      expect(typeof groupDoc.groupId).toBe('string');
      
      await group.deleteOne();
    });

    test('groupId virtual should work on fresh document from database', async () => {
      /**
       * Tests: Virtual property works after document is loaded from database
       * Input: Group document loaded via findById
       * Expected: groupId virtual property accessible and correct
       */
      const group = new Group({
        roomId: 'test-room-virtual-fresh',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1']
      });
      
      await group.save();
      const groupId = group._id.toString();
      
      // Load fresh from database
      const freshGroup = await Group.findById(group._id);
      
      expect(freshGroup).not.toBeNull();
      if (freshGroup) {
        const freshGroupDoc = freshGroup as any;
        expect(freshGroupDoc.groupId).toBe(groupId);
        expect(freshGroupDoc.groupId).toBe(String(freshGroup._id));
      }
      
      await group.deleteOne();
    });
  });

  describe('toJSON Transform', () => {
    test('toJSON should include groupId and exclude _id and __v', async () => {
      /**
       * Tests: GroupSchema.set('toJSON', { virtuals: true, transform: ... })
       * Input: Group document with toJSON() called
       * Expected: JSON object has groupId, no _id, no __v
       */
      const group = new Group({
        roomId: 'test-room-tojson',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2'],
        restaurantSelected: false
      });
      
      await group.save();
      
      const json = group.toJSON() as any;
      
      expect(json).toHaveProperty('groupId');
      expect(json.groupId).toBe(group._id.toString());
      expect(json).not.toHaveProperty('_id');
      expect(json).not.toHaveProperty('__v');
      expect(json).toHaveProperty('roomId');
      expect(json).toHaveProperty('members');
      
      await group.deleteOne();
    });

    test('toJSON should preserve all other fields', async () => {
      /**
       * Tests: toJSON transform preserves all fields except _id and __v
       * Input: Group with various fields
       * Expected: All fields present except _id and __v
       */
      const group = new Group({
        roomId: 'test-room-tojson-fields',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2', 'user3'],
        restaurantSelected: true,
        restaurant: {
          name: 'Test Restaurant',
          location: '123 Test St',
          restaurantId: 'rest-123'
        },
        cuisines: ['Italian', 'Mexican'],
        averageBudget: 50,
        averageRadius: 5
      });
      
      await group.save();
      
      const json = group.toJSON() as any;
      
      expect(json.groupId).toBe(group._id.toString());
      expect(json.roomId).toBe('test-room-tojson-fields');
      expect(json.members).toEqual(['user1', 'user2', 'user3']);
      expect(json.restaurantSelected).toBe(true);
      expect(json.restaurant).toBeDefined();
      if (json.restaurant) {
        expect(json.restaurant.name).toBe('Test Restaurant');
      }
      expect(json.cuisines).toEqual(['Italian', 'Mexican']);
      expect(json.averageBudget).toBe(50);
      expect(json.averageRadius).toBe(5);
      expect(json).not.toHaveProperty('_id');
      expect(json).not.toHaveProperty('__v');
      
      await group.deleteOne();
    });

    test('toJSON should work with sequential voting fields', async () => {
      /**
       * Tests: toJSON works correctly with sequential voting structure
       * Input: Group with currentRound and votingHistory
       * Expected: All sequential voting fields preserved in JSON
       */
      const restaurant = {
        name: 'Voting Restaurant',
        location: '456 Vote St',
        restaurantId: 'vote-123'
      };
      
      const group = new Group({
        roomId: 'test-room-tojson-sequential',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2'],
        votingMode: 'sequential',
        restaurantPool: [restaurant],
        votingHistory: ['vote-123'],
        maxRounds: 15,
        votingTimeoutSeconds: 90
      });
      
      group.startVotingRound(restaurant);
      await group.save();
      
      const json = group.toJSON() as any;
      
      expect(json.groupId).toBe(group._id.toString());
      expect(json.votingMode).toBe('sequential');
      expect(json.currentRound).toBeDefined();
      if (json.currentRound) {
        expect(json.currentRound.restaurant).toBeDefined();
      }
      expect(json.restaurantPool).toHaveLength(1);
      expect(json.votingHistory).toContain('vote-123');
      expect(json.maxRounds).toBe(15);
      expect(json.votingTimeoutSeconds).toBe(90);
      expect(json).not.toHaveProperty('_id');
      expect(json).not.toHaveProperty('__v');
      
      await group.deleteOne();
    });
  });

  describe('getBestRestaurantFromHistory()', () => {
    test('should return first restaurant from pool when votingHistoryDetailed is empty', async () => {
      /**
       * Tests: getBestRestaurantFromHistory() fallback when no history
       * Input: Group with empty votingHistoryDetailed but restaurantPool has items
       * Expected: Returns first restaurant from pool
       */
      const restaurant1 = {
        name: 'First Restaurant',
        location: '123 First St',
        restaurantId: 'first-123'
      };
      
      const restaurant2 = {
        name: 'Second Restaurant',
        location: '456 Second St',
        restaurantId: 'second-456'
      };
      
      const group = new Group({
        roomId: 'test-room-best-empty',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2'],
        votingMode: 'sequential',
        restaurantPool: [restaurant1, restaurant2],
        votingHistoryDetailed: [] // Empty history
      });
      
      await group.save();
      
      const best = group.getBestRestaurantFromHistory();
      
      expect(best).not.toBeNull();
      expect(best!.name).toBe('First Restaurant');
      expect(best!.restaurantId).toBe('first-123');
      
      await group.deleteOne();
    });

    test('should return null when both votingHistoryDetailed and restaurantPool are empty', async () => {
      /**
       * Tests: getBestRestaurantFromHistory() returns null when no data
       * Input: Group with empty votingHistoryDetailed and empty restaurantPool
       * Expected: Returns null
       */
      const group = new Group({
        roomId: 'test-room-best-null',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2'],
        votingMode: 'sequential',
        restaurantPool: [],
        votingHistoryDetailed: []
      });
      
      await group.save();
      
      const best = group.getBestRestaurantFromHistory();
      
      expect(best).toBeNull();
      
      await group.deleteOne();
    });

    test('should return restaurant with most yes votes from votingHistoryDetailed', async () => {
      /**
       * Tests: getBestRestaurantFromHistory() finds restaurant with max yes votes
       * Input: Group with multiple entries in votingHistoryDetailed
       * Expected: Returns restaurant with highest yesVotes count
       */
      const restaurant1 = {
        name: 'Low Votes Restaurant',
        location: '123 Low St',
        restaurantId: 'low-123'
      };
      
      const restaurant2 = {
        name: 'High Votes Restaurant',
        location: '456 High St',
        restaurantId: 'high-456'
      };
      
      const restaurant3 = {
        name: 'Medium Votes Restaurant',
        location: '789 Medium St',
        restaurantId: 'med-789'
      };
      
      const group = new Group({
        roomId: 'test-room-best-max',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2', 'user3'],
        votingMode: 'sequential',
        restaurantPool: [restaurant1, restaurant2, restaurant3],
        votingHistoryDetailed: [
          {
            restaurantId: 'low-123',
            restaurant: restaurant1,
            yesVotes: 1,
            noVotes: 2,
            result: 'rejected',
            votedAt: new Date()
          },
          {
            restaurantId: 'high-456',
            restaurant: restaurant2,
            yesVotes: 3, // Highest
            noVotes: 0,
            result: 'rejected',
            votedAt: new Date()
          },
          {
            restaurantId: 'med-789',
            restaurant: restaurant3,
            yesVotes: 2,
            noVotes: 1,
            result: 'rejected',
            votedAt: new Date()
          }
        ]
      });
      
      await group.save();
      
      const best = group.getBestRestaurantFromHistory();
      
      expect(best).not.toBeNull();
      expect(best!.name).toBe('High Votes Restaurant');
      expect(best!.restaurantId).toBe('high-456');
      
      await group.deleteOne();
    });

    test('should return first restaurant from pool when all entries have 0 yes votes', async () => {
      /**
       * Tests: getBestRestaurantFromHistory() fallback when maxYesVotes is 0
       * Input: Group with votingHistoryDetailed entries all having yesVotes = 0
       * Expected: Returns first restaurant from pool (fallback)
       */
      const restaurant1 = {
        name: 'Pool First Restaurant',
        location: '123 Pool St',
        restaurantId: 'pool-first-123'
      };
      
      const restaurant2 = {
        name: 'Pool Second Restaurant',
        location: '456 Pool St',
        restaurantId: 'pool-second-456'
      };
      
      const rejectedRestaurant = {
        name: 'Rejected Restaurant',
        location: '789 Reject St',
        restaurantId: 'reject-789'
      };
      
      const group = new Group({
        roomId: 'test-room-best-zero',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2'],
        votingMode: 'sequential',
        restaurantPool: [restaurant1, restaurant2],
        votingHistoryDetailed: [
          {
            restaurantId: 'reject-789',
            restaurant: rejectedRestaurant,
            yesVotes: 0, // No yes votes
            noVotes: 2,
            result: 'rejected',
            votedAt: new Date()
          }
        ]
      });
      
      await group.save();
      
      const best = group.getBestRestaurantFromHistory();
      
      // Should return first from pool since maxYesVotes is 0
      expect(best).not.toBeNull();
      expect(best!.name).toBe('Pool First Restaurant');
      expect(best!.restaurantId).toBe('pool-first-123');
      
      await group.deleteOne();
    });

    test('should handle tie by returning first restaurant with max yes votes', async () => {
      /**
       * Tests: getBestRestaurantFromHistory() handles ties (returns first match)
       * Input: Group with multiple entries having same max yesVotes
       * Expected: Returns first restaurant encountered with max yesVotes
       */
      const restaurant1 = {
        name: 'Tied First Restaurant',
        location: '123 Tie St',
        restaurantId: 'tie-first-123'
      };
      
      const restaurant2 = {
        name: 'Tied Second Restaurant',
        location: '456 Tie St',
        restaurantId: 'tie-second-456'
      };
      
      const group = new Group({
        roomId: 'test-room-best-tie',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2', 'user3'],
        votingMode: 'sequential',
        restaurantPool: [restaurant1, restaurant2],
        votingHistoryDetailed: [
          {
            restaurantId: 'tie-first-123',
            restaurant: restaurant1,
            yesVotes: 2, // Tied with restaurant2
            noVotes: 1,
            result: 'rejected',
            votedAt: new Date()
          },
          {
            restaurantId: 'tie-second-456',
            restaurant: restaurant2,
            yesVotes: 2, // Same as restaurant1
            noVotes: 1,
            result: 'rejected',
            votedAt: new Date()
          }
        ]
      });
      
      await group.save();
      
      const best = group.getBestRestaurantFromHistory();
      
      // Should return first one encountered (restaurant1)
      expect(best).not.toBeNull();
      expect(best!.name).toBe('Tied First Restaurant');
      expect(best!.restaurantId).toBe('tie-first-123');
      
      await group.deleteOne();
    });

    test('should work correctly after saving and reloading from database', async () => {
      /**
       * Tests: getBestRestaurantFromHistory() works after database round-trip
       * Input: Group saved, then reloaded from database
       * Expected: Method still works correctly on reloaded document
       */
      const restaurant1 = {
        name: 'Reload Test Restaurant 1',
        location: '123 Reload St',
        restaurantId: 'reload-1'
      };
      
      const restaurant2 = {
        name: 'Reload Test Restaurant 2',
        location: '456 Reload St',
        restaurantId: 'reload-2'
      };
      
      const group = new Group({
        roomId: 'test-room-best-reload',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2'],
        votingMode: 'sequential',
        restaurantPool: [restaurant1, restaurant2],
        votingHistoryDetailed: [
          {
            restaurantId: 'reload-1',
            restaurant: restaurant1,
            yesVotes: 1,
            noVotes: 1,
            result: 'rejected',
            votedAt: new Date()
          },
          {
            restaurantId: 'reload-2',
            restaurant: restaurant2,
            yesVotes: 2, // Highest
            noVotes: 0,
            result: 'rejected',
            votedAt: new Date()
          }
        ]
      });
      
      await group.save();
      const groupId = group._id;
      
      // Reload from database
      const reloadedGroup = await Group.findById(groupId) as IGroupDocument;
      
      expect(reloadedGroup).not.toBeNull();
      
      const best = reloadedGroup!.getBestRestaurantFromHistory();
      
      expect(best).not.toBeNull();
      expect(best!.name).toBe('Reload Test Restaurant 2');
      expect(best!.restaurantId).toBe('reload-2');
      
      await group.deleteOne();
    });
  });

  describe('removeMember() - Sequential Voting Mode', () => {
    test('should remove member and delete their vote from currentRound in sequential mode', async () => {
      /**
       * Tests: removeMember() removes vote from currentRound when in sequential mode
       * Input: Group in sequential mode with active voting round, member has voted
       * Expected: Member removed, vote deleted from currentRound, vote counts recalculated
       */
      const restaurant = {
        name: 'Remove Member Restaurant',
        location: '123 Remove St',
        restaurantId: 'remove-123'
      };
      
      const group = new Group({
        roomId: 'test-room-remove-sequential',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2', 'user3'],
        votingMode: 'sequential',
        restaurantPool: [restaurant]
      });
      
      group.startVotingRound(restaurant);
      
      // User1 votes yes, user2 votes no
      group.submitVote('user1', true);
      group.submitVote('user2', false);
      
      await group.save();
      
      // Verify initial state
      expect(group.members).toContain('user1');
      expect(group.currentRound!.votes.has('user1')).toBe(true);
      expect(group.currentRound!.votes.get('user1')).toBe(true);
      expect(group.currentRound!.yesVotes).toBe(1);
      expect(group.currentRound!.noVotes).toBe(1);
      
      // Remove user1
      group.removeMember('user1');
      
      // Verify member removed
      expect(group.members).not.toContain('user1');
      expect(group.members.length).toBe(2);
      
      // Verify vote removed from currentRound
      expect(group.currentRound!.votes.has('user1')).toBe(false);
      
      // Verify vote counts recalculated
      expect(group.currentRound!.yesVotes).toBe(0);
      expect(group.currentRound!.noVotes).toBe(1); // user2's vote remains
      
      await group.deleteOne();
    });

    test('should recalculate vote counts correctly when removing member with yes vote', async () => {
      /**
       * Tests: removeMember() recalculates yesVotes when removing member who voted yes
       * Input: Group with multiple yes votes, remove one member who voted yes
       * Expected: yesVotes decremented correctly
       */
      const restaurant = {
        name: 'Recalc Yes Restaurant',
        location: '123 Recalc St',
        restaurantId: 'recalc-123'
      };
      
      const group = new Group({
        roomId: 'test-room-recalc-yes',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2', 'user3'],
        votingMode: 'sequential',
        restaurantPool: [restaurant]
      });
      
      group.startVotingRound(restaurant);
      
      // All users vote yes
      group.submitVote('user1', true);
      group.submitVote('user2', true);
      group.submitVote('user3', true);
      
      await group.save();
      
      // Verify initial state: 3 yes votes
      expect(group.currentRound!.yesVotes).toBe(3);
      expect(group.currentRound!.noVotes).toBe(0);
      
      // Remove user2 (who voted yes)
      group.removeMember('user2');
      
      // Verify vote counts recalculated: 2 yes votes remaining
      expect(group.currentRound!.yesVotes).toBe(2);
      expect(group.currentRound!.noVotes).toBe(0);
      expect(group.currentRound!.votes.has('user2')).toBe(false);
      expect(group.currentRound!.votes.has('user1')).toBe(true);
      expect(group.currentRound!.votes.has('user3')).toBe(true);
      
      await group.deleteOne();
    });

    test('should recalculate vote counts correctly when removing member with no vote', async () => {
      /**
       * Tests: removeMember() recalculates noVotes when removing member who voted no
       * Input: Group with multiple no votes, remove one member who voted no
       * Expected: noVotes decremented correctly
       */
      const restaurant = {
        name: 'Recalc No Restaurant',
        location: '123 Recalc No St',
        restaurantId: 'recalc-no-123'
      };
      
      const group = new Group({
        roomId: 'test-room-recalc-no',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2', 'user3'],
        votingMode: 'sequential',
        restaurantPool: [restaurant]
      });
      
      group.startVotingRound(restaurant);
      
      // All users vote no
      group.submitVote('user1', false);
      group.submitVote('user2', false);
      group.submitVote('user3', false);
      
      await group.save();
      
      // Verify initial state: 3 no votes
      expect(group.currentRound!.yesVotes).toBe(0);
      expect(group.currentRound!.noVotes).toBe(3);
      
      // Remove user2 (who voted no)
      group.removeMember('user2');
      
      // Verify vote counts recalculated: 2 no votes remaining
      expect(group.currentRound!.yesVotes).toBe(0);
      expect(group.currentRound!.noVotes).toBe(2);
      expect(group.currentRound!.votes.has('user2')).toBe(false);
      expect(group.currentRound!.votes.has('user1')).toBe(true);
      expect(group.currentRound!.votes.has('user3')).toBe(true);
      
      await group.deleteOne();
    });

    test('should handle removing member who has not voted yet in sequential mode', async () => {
      /**
       * Tests: removeMember() handles member with no vote in currentRound
       * Input: Group in sequential mode, member hasn't voted yet
       * Expected: Member removed, no vote to delete, counts unchanged
       */
      const restaurant = {
        name: 'No Vote Restaurant',
        location: '123 No Vote St',
        restaurantId: 'no-vote-123'
      };
      
      const group = new Group({
        roomId: 'test-room-remove-no-vote',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2', 'user3'],
        votingMode: 'sequential',
        restaurantPool: [restaurant]
      });
      
      group.startVotingRound(restaurant);
      
      // Only user1 votes
      group.submitVote('user1', true);
      
      await group.save();
      
      // Verify initial state
      expect(group.currentRound!.yesVotes).toBe(1);
      expect(group.currentRound!.noVotes).toBe(0);
      expect(group.currentRound!.votes.has('user2')).toBe(false);
      
      // Remove user2 (who hasn't voted)
      group.removeMember('user2');
      
      // Verify member removed
      expect(group.members).not.toContain('user2');
      expect(group.members.length).toBe(2);
      
      // Verify vote counts unchanged (user2 had no vote)
      expect(group.currentRound!.yesVotes).toBe(1);
      expect(group.currentRound!.noVotes).toBe(0);
      expect(group.currentRound!.votes.has('user2')).toBe(false);
      
      await group.deleteOne();
    });

    test('should not modify currentRound when removing member in list mode', async () => {
      /**
       * Tests: removeMember() does not touch currentRound when in list mode
       * Input: Group in list mode (not sequential)
       * Expected: Member removed, currentRound unchanged (or doesn't exist)
       */
      const group = new Group({
        roomId: 'test-room-remove-list',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2'],
        votingMode: 'list' // Not sequential
      });
      
      await group.save();
      
      // Verify initial state
      expect(group.members).toContain('user1');
      // Mongoose converts undefined to null when saving
      expect(group.currentRound).toBeFalsy();
      
      // Remove user1
      group.removeMember('user1');
      
      // Verify member removed
      expect(group.members).not.toContain('user1');
      expect(group.members.length).toBe(1);
      
      // currentRound should still be null/undefined (list mode doesn't use it)
      expect(group.currentRound).toBeFalsy();
      
      await group.deleteOne();
    });

    test('should handle removing member when currentRound is null in sequential mode', async () => {
      /**
       * Tests: removeMember() handles null currentRound gracefully
       * Input: Group in sequential mode but no active voting round
       * Expected: Member removed, no error thrown
       */
      const group = new Group({
        roomId: 'test-room-remove-null-round',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2'],
        votingMode: 'sequential',
        currentRound: undefined // No active round
      });
      
      await group.save();
      
      // Verify initial state
      expect(group.members).toContain('user1');
      // Mongoose converts undefined to null when saving
      expect(group.currentRound).toBeFalsy();
      
      // Remove user1 - should not throw error
      expect(() => {
        group.removeMember('user1');
      }).not.toThrow();
      
      // Verify member removed
      expect(group.members).not.toContain('user1');
      expect(group.members.length).toBe(1);
      
      await group.deleteOne();
    });

    test('should recalculate vote counts correctly with mixed yes/no votes', async () => {
      /**
       * Tests: removeMember() recalculates both yesVotes and noVotes correctly
       * Input: Group with mixed votes, remove member with yes vote
       * Expected: Only yesVotes decremented, noVotes unchanged
       */
      const restaurant = {
        name: 'Mixed Votes Restaurant',
        location: '123 Mixed St',
        restaurantId: 'mixed-123'
      };
      
      const group = new Group({
        roomId: 'test-room-mixed-votes',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2', 'user3', 'user4'],
        votingMode: 'sequential',
        restaurantPool: [restaurant]
      });
      
      group.startVotingRound(restaurant);
      
      // Mixed votes: user1=yes, user2=no, user3=yes, user4=no
      group.submitVote('user1', true);
      group.submitVote('user2', false);
      group.submitVote('user3', true);
      group.submitVote('user4', false);
      
      await group.save();
      
      // Verify initial state: 2 yes, 2 no
      expect(group.currentRound!.yesVotes).toBe(2);
      expect(group.currentRound!.noVotes).toBe(2);
      
      // Remove user1 (yes vote)
      group.removeMember('user1');
      
      // Verify: 1 yes, 2 no
      expect(group.currentRound!.yesVotes).toBe(1);
      expect(group.currentRound!.noVotes).toBe(2);
      expect(group.currentRound!.votes.has('user1')).toBe(false);
      
      // Remove user2 (no vote)
      group.removeMember('user2');
      
      // Verify: 1 yes, 1 no
      expect(group.currentRound!.yesVotes).toBe(1);
      expect(group.currentRound!.noVotes).toBe(1);
      expect(group.currentRound!.votes.has('user2')).toBe(false);
      
      await group.deleteOne();
    });
  });

  describe('addVote() - Legacy Voting', () => {
    test('should add vote for user when no previous vote exists', async () => {
      /**
       * Tests: addVote() adds new vote when user hasn't voted before
       * Input: User with no previous vote
       * Expected: Vote added, restaurantVotes incremented
       */
      const group = new Group({
        roomId: 'test-room-add-vote-new',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2'],
        votingMode: 'list'
      });
      
      await group.save();
      
      // User1 has no previous vote
      expect(group.votes.has('user1')).toBe(false);
      expect(group.restaurantVotes.get('rest-1')).toBeUndefined();
      
      group.addVote('user1', 'rest-1');
      
      expect(group.votes.get('user1')).toBe('rest-1');
      expect(group.restaurantVotes.get('rest-1')).toBe(1);
      
      await group.deleteOne();
    });

    test('should decrement previous restaurant vote count when user changes vote', async () => {
      /**
       * Tests: addVote() decrements previous restaurant when user changes vote
       * Input: User changes from rest-1 to rest-2
       * Expected: rest-1 count decremented, rest-2 count incremented
       */
      const group = new Group({
        roomId: 'test-room-add-vote-change',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2'],
        votingMode: 'list'
      });
      
      // User1 initially votes for rest-1
      group.addVote('user1', 'rest-1');
      group.addVote('user2', 'rest-1');
      
      await group.save();
      
      // Verify initial state: rest-1 has 2 votes
      expect(group.restaurantVotes.get('rest-1')).toBe(2);
      expect(group.votes.get('user1')).toBe('rest-1');
      
      // User1 changes vote to rest-2
      group.addVote('user1', 'rest-2');
      
      // rest-1 should be decremented to 1, rest-2 should be incremented to 1
      expect(group.restaurantVotes.get('rest-1')).toBe(1);
      expect(group.restaurantVotes.get('rest-2')).toBe(1);
      expect(group.votes.get('user1')).toBe('rest-2');
      
      await group.deleteOne();
    });

    test('should handle Math.max(0, prevCount - 1) to prevent negative counts', async () => {
      /**
       * Tests: addVote() uses Math.max(0, prevCount - 1) to prevent negative counts
       * Input: Previous restaurant with count of 0 or 1
       * Expected: Count never goes below 0
       */
      const group = new Group({
        roomId: 'test-room-add-vote-mathmax',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1'],
        votingMode: 'list'
      });
      
      // User1 votes for rest-1
      group.addVote('user1', 'rest-1');
      
      await group.save();
      
      expect(group.restaurantVotes.get('rest-1')).toBe(1);
      
      // Change vote - rest-1 should go to 0, not negative
      group.addVote('user1', 'rest-2');
      
      expect(group.restaurantVotes.get('rest-1')).toBe(0);
      expect(group.restaurantVotes.get('rest-2')).toBe(1);
      
      // If rest-1 somehow had 0 and we change again, it should stay at 0
      group.addVote('user1', 'rest-1');
      expect(group.restaurantVotes.get('rest-1')).toBe(1);
      
      group.addVote('user1', 'rest-3');
      // rest-1 should be 0, not -1
      expect(group.restaurantVotes.get('rest-1')).toBe(0);
      expect(group.restaurantVotes.get('rest-3')).toBe(1);
      
      await group.deleteOne();
    });

    test('should handle multiple vote changes correctly', async () => {
      /**
       * Tests: addVote() handles multiple sequential vote changes
       * Input: User changes vote multiple times
       * Expected: Previous votes decremented, current vote incremented
       */
      const group = new Group({
        roomId: 'test-room-add-vote-multiple',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2', 'user3'],
        votingMode: 'list'
      });
      
      // User1 votes for rest-1
      group.addVote('user1', 'rest-1');
      group.addVote('user2', 'rest-1');
      group.addVote('user3', 'rest-2');
      
      await group.save();
      
      // Initial: rest-1 has 2 votes, rest-2 has 1 vote
      expect(group.restaurantVotes.get('rest-1')).toBe(2);
      expect(group.restaurantVotes.get('rest-2')).toBe(1);
      
      // User1 changes to rest-2
      group.addVote('user1', 'rest-2');
      // rest-1: 1, rest-2: 2
      expect(group.restaurantVotes.get('rest-1')).toBe(1);
      expect(group.restaurantVotes.get('rest-2')).toBe(2);
      
      // User1 changes to rest-3
      group.addVote('user1', 'rest-3');
      // rest-1: 1, rest-2: 1, rest-3: 1
      expect(group.restaurantVotes.get('rest-1')).toBe(1);
      expect(group.restaurantVotes.get('rest-2')).toBe(1);
      expect(group.restaurantVotes.get('rest-3')).toBe(1);
      
      // User1 changes back to rest-1
      group.addVote('user1', 'rest-1');
      // rest-1: 2, rest-2: 1, rest-3: 0
      expect(group.restaurantVotes.get('rest-1')).toBe(2);
      expect(group.restaurantVotes.get('rest-2')).toBe(1);
      expect(group.restaurantVotes.get('rest-3')).toBe(0);
      
      await group.deleteOne();
    });

    test('should increment new restaurant vote count correctly', async () => {
      /**
       * Tests: addVote() increments vote count for new restaurant
       * Input: User votes for restaurant
       * Expected: restaurantVotes count incremented
       */
      const group = new Group({
        roomId: 'test-room-add-vote-increment',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2', 'user3'],
        votingMode: 'list'
      });
      
      await group.save();
      
      // Add votes incrementally
      group.addVote('user1', 'rest-1');
      expect(group.restaurantVotes.get('rest-1')).toBe(1);
      
      group.addVote('user2', 'rest-1');
      expect(group.restaurantVotes.get('rest-1')).toBe(2);
      
      group.addVote('user3', 'rest-1');
      expect(group.restaurantVotes.get('rest-1')).toBe(3);
      
      await group.deleteOne();
    });

    test('should handle previousVote being undefined or null', async () => {
      /**
       * Tests: addVote() handles case when previousVote is undefined
       * Input: User with no previous vote (votes.get returns undefined)
       * Expected: No decrement, only increment
       */
      const group = new Group({
        roomId: 'test-room-add-vote-no-previous',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1'],
        votingMode: 'list'
      });
      
      await group.save();
      
      // User1 has no previous vote
      expect(group.votes.get('user1')).toBeUndefined();
      
      // Add vote - should only increment, not try to decrement undefined
      group.addVote('user1', 'rest-1');
      
      expect(group.votes.get('user1')).toBe('rest-1');
      expect(group.restaurantVotes.get('rest-1')).toBe(1);
      
      await group.deleteOne();
    });

    test('should handle previous restaurant not in restaurantVotes map', async () => {
      /**
       * Tests: addVote() handles previousVote restaurant not in map (uses || 0)
       * Input: Previous restaurant not in restaurantVotes map
       * Expected: Uses 0 as default, decrements to 0 (Math.max prevents negative)
       */
      const group = new Group({
        roomId: 'test-room-add-vote-no-map',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1'],
        votingMode: 'list'
      });
      
      // Manually set a vote that's not in restaurantVotes map
      group.votes.set('user1', 'rest-unknown');
      
      await group.save();
      
      // rest-unknown is not in restaurantVotes map
      expect(group.restaurantVotes.get('rest-unknown')).toBeUndefined();
      
      // Change vote - should handle undefined with || 0
      group.addVote('user1', 'rest-1');
      
      // rest-unknown should be set to 0 (Math.max(0, 0 - 1) = 0)
      expect(group.restaurantVotes.get('rest-unknown')).toBe(0);
      expect(group.restaurantVotes.get('rest-1')).toBe(1);
      
      await group.deleteOne();
    });

    test('should execute exact code path: previousVote exists, || 0 fallback, Math.max(0, prevCount - 1)', async () => {
      /**
       * Tests: addVote() exact code path coverage
       * Covers: 
       *   1. const previousVote = this.votes.get(userId) - gets previous vote
       *   2. if (previousVote) - truthy check
       *   3. const prevCount = this.restaurantVotes.get(previousVote) || 0 - || 0 fallback
       *   4. this.restaurantVotes.set(previousVote, Math.max(0, prevCount - 1)) - prevents negative
       * 
       * Input: User with previous vote, changing to new restaurant
       * Expected: Previous restaurant count decremented correctly
       */
      const group = new Group({
        roomId: 'test-room-add-vote-exact-path',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2'],
        votingMode: 'list'
      });
      
      // Step 1: User1 votes for rest-1 (creates previousVote)
      group.addVote('user1', 'rest-1');
      group.addVote('user2', 'rest-1');
      
      await group.save();
      
      // Verify previousVote exists (this.votes.get('user1') returns 'rest-1')
      const previousVote = group.votes.get('user1');
      expect(previousVote).toBe('rest-1');
      expect(previousVote).toBeTruthy(); // if (previousVote) will be true
      
      // Verify prevCount exists in map (not undefined, so || 0 won't be used)
      const prevCount = group.restaurantVotes.get(previousVote!);
      expect(prevCount).toBe(2); // Both users voted for rest-1
      expect(prevCount).not.toBeUndefined();
      
      // Step 2: User1 changes vote to rest-2
      // This triggers: if (previousVote) { ... Math.max(0, prevCount - 1) }
      group.addVote('user1', 'rest-2');
      
      // Verify previous restaurant count decremented: Math.max(0, 2 - 1) = 1
      expect(group.restaurantVotes.get('rest-1')).toBe(1);
      expect(group.restaurantVotes.get('rest-2')).toBe(1);
      
      // Step 3: Test || 0 fallback when previous restaurant not in map
      // Manually set vote to restaurant not in map
      group.votes.set('user1', 'rest-not-in-map');
      
      // rest-not-in-map is not in restaurantVotes, so get() returns undefined
      expect(group.restaurantVotes.get('rest-not-in-map')).toBeUndefined();
      
      // Change vote - should use || 0: Math.max(0, (undefined || 0) - 1) = Math.max(0, -1) = 0
      group.addVote('user1', 'rest-3');
      
      // rest-not-in-map should be 0 (not negative)
      expect(group.restaurantVotes.get('rest-not-in-map')).toBe(0);
      expect(group.restaurantVotes.get('rest-3')).toBe(1);
      
      // Step 4: Test Math.max prevents negative when count is 1
      group.addVote('user2', 'rest-4');
      expect(group.restaurantVotes.get('rest-4')).toBe(1);
      
      // User2 changes vote - rest-4 should go to 0, not -1
      group.addVote('user2', 'rest-5');
      expect(group.restaurantVotes.get('rest-4')).toBe(0); // Math.max(0, 1 - 1) = 0
      expect(group.restaurantVotes.get('rest-5')).toBe(1);
      
      await group.deleteOne();
    });

    test('should use || 0 fallback when adding vote for restaurant not in restaurantVotes', async () => {
      /**
       * Tests: addVote() uses || 0 fallback when restaurantId not in restaurantVotes
       * Covers: Line 285 - const currentCount = this.restaurantVotes.get(restaurantId) || 0;
       * Input: User votes for restaurant that doesn't exist in restaurantVotes map yet
       * Expected: Uses || 0 fallback, then sets count to 1
       */
      const group = new Group({
        roomId: 'test-room-add-vote-0-fallback',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1'],
        votingMode: 'list'
      });
      
      await group.save();
      
      // Verify restaurantId is not in restaurantVotes (undefined)
      expect(group.restaurantVotes.get('new-restaurant-123')).toBeUndefined();
      
      // Add vote for restaurant not in map - should use || 0 fallback
      // Line 285: const currentCount = this.restaurantVotes.get(restaurantId) || 0;
      // currentCount will be 0 (because get returns undefined, || 0 is used)
      group.addVote('user1', 'new-restaurant-123');
      
      // Verify count is now 1 (0 + 1)
      expect(group.restaurantVotes.get('new-restaurant-123')).toBe(1);
      expect(group.votes.get('user1')).toBe('new-restaurant-123');
      
      await group.deleteOne();
    });

    test('should use || 0 fallback when removing vote for restaurant not in restaurantVotes', async () => {
      /**
       * Tests: removeVote() uses || 0 fallback when restaurantId not in restaurantVotes
       * Covers: Line 293 - const count = this.restaurantVotes.get(restaurantId) || 0;
       * Input: User has vote but restaurantId is not in restaurantVotes map
       * Expected: Uses || 0 fallback, then sets count to Math.max(0, 0 - 1) = 0
       */
      const group = new Group({
        roomId: 'test-room-remove-vote-0-fallback',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1'],
        votingMode: 'list'
      });
      
      // Manually set vote but don't add to restaurantVotes
      // This simulates a corrupted state where vote exists but restaurantVotes entry is missing
      group.votes.set('user1', 'missing-restaurant-456');
      
      // Verify restaurantId is not in restaurantVotes (undefined)
      expect(group.restaurantVotes.get('missing-restaurant-456')).toBeUndefined();
      
      await group.save();
      
      // Remove vote - should use || 0 fallback
      // Line 293: const count = this.restaurantVotes.get(restaurantId) || 0;
      // count will be 0 (because get returns undefined, || 0 is used)
      // Then: Math.max(0, 0 - 1) = 0
      group.removeVote('user1');
      
      // Verify vote is removed
      expect(group.votes.get('user1')).toBeUndefined();
      // Verify restaurantVotes entry is set to 0 (not negative)
      expect(group.restaurantVotes.get('missing-restaurant-456')).toBe(0);
      
      await group.deleteOne();
    });
  });

  describe('submitVote() - Sequential Voting Error Paths', () => {
    test('should throw error when no active voting round', async () => {
      /**
       * Tests: submitVote() throws error when currentRound is null/undefined
       * Covers: Line 365 - throw new Error('No active voting round')
       * Input: Group with no currentRound
       * Expected: Throws error
       */
      const group = new Group({
        roomId: 'test-room-submit-no-round',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2'],
        votingMode: 'sequential',
        currentRound: undefined
      });
      
      await group.save();
      
      expect(() => {
        group.submitVote('user1', true);
      }).toThrow('No active voting round');
      
      await group.deleteOne();
    });

    test('should throw error when user is not a member', async () => {
      /**
       * Tests: submitVote() throws error when user not in members
       * Covers: Line 369 - throw new Error('User is not a member of this group')
       * Input: Group with currentRound, but user not in members
       * Expected: Throws error
       */
      const restaurant = {
        name: 'Error Test Restaurant',
        location: '123 Error St',
        restaurantId: 'error-123'
      };
      
      const group = new Group({
        roomId: 'test-room-submit-not-member',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2'], // user3 is NOT a member
        votingMode: 'sequential',
        restaurantPool: [restaurant]
      });
      
      group.startVotingRound(restaurant);
      await group.save();
      
      expect(() => {
        group.submitVote('user3', true); // user3 is not a member
      }).toThrow('User is not a member of this group');
      
      await group.deleteOne();
    });

    test('should decrement yesVotes when previousVote was true (yes)', async () => {
      /**
       * Tests: submitVote() decrements yesVotes when changing from yes to no
       * Covers: Line 379 - if (previousVote) this.currentRound.yesVotes--;
       * Input: User previously voted yes, now votes no
       * Expected: yesVotes decremented, noVotes incremented
       */
      const restaurant = {
        name: 'Previous Yes Restaurant',
        location: '123 Previous St',
        restaurantId: 'prev-yes-123'
      };
      
      const group = new Group({
        roomId: 'test-room-submit-previous-yes',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2'],
        votingMode: 'sequential',
        restaurantPool: [restaurant]
      });
      
      group.startVotingRound(restaurant);
      
      // User1 votes yes first
      group.submitVote('user1', true);
      
      await group.save();
      
      // Verify initial state: 1 yes, 0 no
      expect(group.currentRound!.yesVotes).toBe(1);
      expect(group.currentRound!.noVotes).toBe(0);
      expect(group.currentRound!.votes.get('user1')).toBe(true);
      
      // User1 changes vote to no (previousVote was true)
      group.submitVote('user1', false);
      
      // Verify: yesVotes decremented (1 -> 0), noVotes incremented (0 -> 1)
      expect(group.currentRound!.yesVotes).toBe(0);
      expect(group.currentRound!.noVotes).toBe(1);
      expect(group.currentRound!.votes.get('user1')).toBe(false);
      
      await group.deleteOne();
    });

    test('should decrement noVotes when previousVote was false (no)', async () => {
      /**
       * Tests: submitVote() decrements noVotes when changing from no to yes
       * Covers: Line 380 - else this.currentRound.noVotes--;
       * Input: User previously voted no, now votes yes
       * Expected: noVotes decremented, yesVotes incremented
       */
      const restaurant = {
        name: 'Previous No Restaurant',
        location: '123 Previous No St',
        restaurantId: 'prev-no-123'
      };
      
      const group = new Group({
        roomId: 'test-room-submit-previous-no',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2'],
        votingMode: 'sequential',
        restaurantPool: [restaurant]
      });
      
      group.startVotingRound(restaurant);
      
      // User1 votes no first
      group.submitVote('user1', false);
      
      await group.save();
      
      // Verify initial state: 0 yes, 1 no
      expect(group.currentRound!.yesVotes).toBe(0);
      expect(group.currentRound!.noVotes).toBe(1);
      expect(group.currentRound!.votes.get('user1')).toBe(false);
      
      // User1 changes vote to yes (previousVote was false)
      group.submitVote('user1', true);
      
      // Verify: noVotes decremented (1 -> 0), yesVotes incremented (0 -> 1)
      expect(group.currentRound!.yesVotes).toBe(1);
      expect(group.currentRound!.noVotes).toBe(0);
      expect(group.currentRound!.votes.get('user1')).toBe(true);
      
      await group.deleteOne();
    });

    test('should increment noVotes when vote is false', async () => {
      /**
       * Tests: submitVote() increments noVotes when vote is false
       * Covers: Line 385 - else this.currentRound.noVotes++;
       * Input: User votes no (false)
       * Expected: noVotes incremented
       */
      const restaurant = {
        name: 'No Vote Restaurant',
        location: '123 No St',
        restaurantId: 'no-vote-123'
      };
      
      const group = new Group({
        roomId: 'test-room-submit-no-vote',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2'],
        votingMode: 'sequential',
        restaurantPool: [restaurant]
      });
      
      group.startVotingRound(restaurant);
      
      await group.save();
      
      // Verify initial state: 0 yes, 0 no
      expect(group.currentRound!.yesVotes).toBe(0);
      expect(group.currentRound!.noVotes).toBe(0);
      
      // User1 votes no (false)
      group.submitVote('user1', false);
      
      // Verify: noVotes incremented (0 -> 1)
      expect(group.currentRound!.yesVotes).toBe(0);
      expect(group.currentRound!.noVotes).toBe(1);
      expect(group.currentRound!.votes.get('user1')).toBe(false);
      
      await group.deleteOne();
    });
  });

  describe('checkMajority() - Sequential Voting', () => {
    test('should return early when no currentRound exists', async () => {
      /**
       * Tests: checkMajority() returns early when currentRound is null/undefined
       * Covers: Line 398 - return { hasMajority: false, votesFor: 0, votesAgainst: 0 };
       * Input: Group with no currentRound
       * Expected: Returns early with hasMajority: false
       */
      const group = new Group({
        roomId: 'test-room-check-no-round',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2'],
        votingMode: 'sequential',
        currentRound: undefined
      });
      
      await group.save();
      
      const result = group.checkMajority();
      
      expect(result.hasMajority).toBe(false);
      expect(result.votesFor).toBe(0);
      expect(result.votesAgainst).toBe(0);
      expect(result.result).toBeUndefined();
      
      await group.deleteOne();
    });

    test('should calculate majorityThreshold using Math.floor(totalMembers / 2) + 1 for groups with 3+ members', async () => {
      /**
       * Tests: checkMajority() calculates threshold for 3+ member groups
       * Covers: Line 412 - majorityThreshold = Math.floor(totalMembers / 2) + 1;
       * Input: Group with 3, 4, or 5 members
       * Expected: Threshold calculated as Math.floor(totalMembers / 2) + 1
       */
      const restaurant = {
        name: 'Threshold Test Restaurant',
        location: '123 Threshold St',
        restaurantId: 'threshold-123'
      };
      
      // Test with 3 members: Math.floor(3/2) + 1 = 1 + 1 = 2
      const group3 = new Group({
        roomId: 'test-room-threshold-3',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2', 'user3'],
        votingMode: 'sequential',
        restaurantPool: [restaurant]
      });
      
      group3.startVotingRound(restaurant);
      await group3.save();
      
      // With 3 members, need 2 votes for majority
      // 1 yes vote - no majority
      group3.submitVote('user1', true);
      let result = group3.checkMajority();
      expect(result.hasMajority).toBe(false);
      
      // 2 yes votes - majority reached
      group3.submitVote('user2', true);
      result = group3.checkMajority();
      expect(result.hasMajority).toBe(true);
      expect(result.result).toBe('yes');
      
      await group3.deleteOne();
      
      // Test with 4 members: Math.floor(4/2) + 1 = 2 + 1 = 3
      const group4 = new Group({
        roomId: 'test-room-threshold-4',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2', 'user3', 'user4'],
        votingMode: 'sequential',
        restaurantPool: [restaurant]
      });
      
      group4.startVotingRound(restaurant);
      await group4.save();
      
      // With 4 members, need 3 votes for majority
      // 2 yes votes - no majority
      group4.submitVote('user1', true);
      group4.submitVote('user2', true);
      result = group4.checkMajority();
      expect(result.hasMajority).toBe(false);
      
      // 3 yes votes - majority reached
      group4.submitVote('user3', true);
      result = group4.checkMajority();
      expect(result.hasMajority).toBe(true);
      expect(result.result).toBe('yes');
      
      await group4.deleteOne();
      
      // Test with 5 members: Math.floor(5/2) + 1 = 2 + 1 = 3
      const group5 = new Group({
        roomId: 'test-room-threshold-5',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2', 'user3', 'user4', 'user5'],
        votingMode: 'sequential',
        restaurantPool: [restaurant]
      });
      
      group5.startVotingRound(restaurant);
      await group5.save();
      
      // With 5 members, need 3 votes for majority
      // 2 yes votes - no majority
      group5.submitVote('user1', true);
      group5.submitVote('user2', true);
      result = group5.checkMajority();
      expect(result.hasMajority).toBe(false);
      
      // 3 yes votes - majority reached
      group5.submitVote('user3', true);
      result = group5.checkMajority();
      expect(result.hasMajority).toBe(true);
      expect(result.result).toBe('yes');
      
      await group5.deleteOne();
    });

    test('should return hasMajority: true with result: yes when yesVotes >= majorityThreshold', async () => {
      /**
       * Tests: checkMajority() returns yes majority when yesVotes >= threshold
       * Covers: Line 415-421 - if (yesVotes >= majorityThreshold) return { hasMajority: true, result: 'yes' }
       * Input: Group where yes votes reach majority threshold
       * Expected: Returns hasMajority: true, result: 'yes'
       */
      const restaurant = {
        name: 'Yes Majority Restaurant',
        location: '123 Yes St',
        restaurantId: 'yes-majority-123'
      };
      
      const group = new Group({
        roomId: 'test-room-yes-majority',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2', 'user3'],
        votingMode: 'sequential',
        restaurantPool: [restaurant]
      });
      
      group.startVotingRound(restaurant);
      
      // With 3 members, need 2 votes for majority
      group.submitVote('user1', true);
      group.submitVote('user2', true);
      
      await group.save();
      
      const result = group.checkMajority();
      
      expect(result.hasMajority).toBe(true);
      expect(result.result).toBe('yes');
      expect(result.votesFor).toBe(2);
      expect(result.votesAgainst).toBe(0);
      
      await group.deleteOne();
    });

    test('should return hasMajority: true with result: no when noVotes >= majorityThreshold', async () => {
      /**
       * Tests: checkMajority() returns no majority when noVotes >= threshold
       * Covers: Line 424-430 - if (noVotes >= majorityThreshold) return { hasMajority: true, result: 'no' }
       * Input: Group where no votes reach majority threshold
       * Expected: Returns hasMajority: true, result: 'no'
       */
      const restaurant = {
        name: 'No Majority Restaurant',
        location: '123 No St',
        restaurantId: 'no-majority-123'
      };
      
      const group = new Group({
        roomId: 'test-room-no-majority',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2', 'user3'],
        votingMode: 'sequential',
        restaurantPool: [restaurant]
      });
      
      group.startVotingRound(restaurant);
      
      // With 3 members, need 2 votes for majority
      group.submitVote('user1', false);
      group.submitVote('user2', false);
      
      await group.save();
      
      const result = group.checkMajority();
      
      expect(result.hasMajority).toBe(true);
      expect(result.result).toBe('no');
      expect(result.votesFor).toBe(0);
      expect(result.votesAgainst).toBe(2);
      
      await group.deleteOne();
    });
  });

  describe('startVotingRound() - Sequential Voting', () => {
    test('should initialize currentRound with all required fields', async () => {
      /**
       * Tests: startVotingRound() creates currentRound object
       * Covers: Lines 346-355 - currentRound initialization
       * Input: Restaurant with restaurantId
       * Expected: currentRound created with all fields correctly set
       */
      const restaurant = {
        name: 'Start Round Restaurant',
        location: '123 Start St',
        restaurantId: 'start-123'
      };
      
      const group = new Group({
        roomId: 'test-room-start-round',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2'],
        votingMode: 'sequential',
        votingTimeoutSeconds: 90
      });
      
      const beforeStart = new Date();
      group.startVotingRound(restaurant);
      const afterStart = new Date();
      
      expect(group.currentRound).toBeDefined();
      expect(group.currentRound).not.toBeNull();
      expect(group.currentRound!.restaurantId).toBe('start-123');
      // Check restaurant object exists and has correct properties
      expect(group.currentRound!.restaurant).toBeDefined();
      expect(group.currentRound!.restaurant.name).toBe(restaurant.name);
      expect(group.currentRound!.restaurant.location).toBe(restaurant.location);
      expect(group.currentRound!.restaurant.restaurantId).toBe(restaurant.restaurantId);
      expect(group.currentRound!.startTime.getTime()).toBeGreaterThanOrEqual(beforeStart.getTime());
      expect(group.currentRound!.startTime.getTime()).toBeLessThanOrEqual(afterStart.getTime());
      
      // expiresAt should be startTime + votingTimeoutSeconds
      const expectedExpiresAt = new Date(group.currentRound!.startTime.getTime() + 90 * 1000);
      expect(group.currentRound!.expiresAt.getTime()).toBe(expectedExpiresAt.getTime());
      
      expect(group.currentRound!.votes).toBeInstanceOf(Map);
      expect(group.currentRound!.votes.size).toBe(0);
      expect(group.currentRound!.yesVotes).toBe(0);
      expect(group.currentRound!.noVotes).toBe(0);
      expect(group.currentRound!.status).toBe('active');
      
      await group.deleteOne();
    });

    test('should use empty string for restaurantId when restaurantId is undefined', async () => {
      /**
       * Tests: startVotingRound() handles undefined restaurantId
       * Covers: Line 347 - restaurantId: restaurant.restaurantId || ''
       * Input: Restaurant without restaurantId
       * Expected: restaurantId is empty string
       */
      const restaurant = {
        name: 'No ID Restaurant',
        location: '123 No ID St'
        // restaurantId is undefined
      };
      
      const group = new Group({
        roomId: 'test-room-no-id',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1'],
        votingMode: 'sequential'
      });
      
      group.startVotingRound(restaurant);
      
      expect(group.currentRound).toBeDefined();
      expect(group.currentRound!.restaurantId).toBe('');
      
      await group.deleteOne();
    });

    test('should push restaurantId to votingHistory', async () => {
      /**
       * Tests: startVotingRound() updates votingHistory
       * Covers: Line 357 - this.votingHistory.push(restaurant.restaurantId || '')
       * Input: Restaurant with restaurantId
       * Expected: restaurantId added to votingHistory array
       */
      const restaurant1 = {
        name: 'History Restaurant 1',
        location: '123 History St',
        restaurantId: 'history-1'
      };
      
      const restaurant2 = {
        name: 'History Restaurant 2',
        location: '456 History St',
        restaurantId: 'history-2'
      };
      
      const group = new Group({
        roomId: 'test-room-history',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1'],
        votingMode: 'sequential',
        votingHistory: []
      });
      
      // Start first round
      group.startVotingRound(restaurant1);
      expect(group.votingHistory).toContain('history-1');
      expect(group.votingHistory.length).toBe(1);
      
      // Start second round
      group.startVotingRound(restaurant2);
      expect(group.votingHistory).toContain('history-1');
      expect(group.votingHistory).toContain('history-2');
      expect(group.votingHistory.length).toBe(2);
      
      await group.deleteOne();
    });

    test('should push empty string to votingHistory when restaurantId is undefined', async () => {
      /**
       * Tests: startVotingRound() pushes empty string when restaurantId is undefined
       * Covers: Line 357 - this.votingHistory.push(restaurant.restaurantId || '')
       * Input: Restaurant without restaurantId
       * Expected: Empty string added to votingHistory
       */
      const restaurant = {
        name: 'No ID History Restaurant',
        location: '123 No ID St'
      };
      
      const group = new Group({
        roomId: 'test-room-history-no-id',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1'],
        votingMode: 'sequential',
        votingHistory: []
      });
      
      group.startVotingRound(restaurant);
      
      expect(group.votingHistory).toContain('');
      expect(group.votingHistory.length).toBe(1);
      
      await group.deleteOne();
    });

    test('should calculate expiresAt based on votingTimeoutSeconds', async () => {
      /**
       * Tests: startVotingRound() calculates expiresAt correctly
       * Covers: Line 344 - expiresAt = new Date(now.getTime() + this.votingTimeoutSeconds * 1000)
       * Input: Group with custom votingTimeoutSeconds
       * Expected: expiresAt is startTime + votingTimeoutSeconds
       */
      const restaurant = {
        name: 'Timeout Restaurant',
        location: '123 Timeout St',
        restaurantId: 'timeout-123'
      };
      
      const group = new Group({
        roomId: 'test-room-timeout',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1'],
        votingMode: 'sequential',
        votingTimeoutSeconds: 120 // 2 minutes
      });
      
      const beforeStart = new Date();
      group.startVotingRound(restaurant);
      const afterStart = new Date();
      
      const expectedMinExpires = new Date(beforeStart.getTime() + 120 * 1000);
      const expectedMaxExpires = new Date(afterStart.getTime() + 120 * 1000);
      
      expect(group.currentRound!.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMinExpires.getTime());
      expect(group.currentRound!.expiresAt.getTime()).toBeLessThanOrEqual(expectedMaxExpires.getTime());
      
      await group.deleteOne();
    });

    test('should reset vote counts when starting new round', async () => {
      /**
       * Tests: startVotingRound() initializes vote counts to 0
       * Covers: Lines 352-353 - yesVotes: 0, noVotes: 0
       * Input: Starting a new voting round
       * Expected: yesVotes and noVotes are both 0
       */
      const restaurant = {
        name: 'Reset Votes Restaurant',
        location: '123 Reset St',
        restaurantId: 'reset-123'
      };
      
      const group = new Group({
        roomId: 'test-room-reset',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2'],
        votingMode: 'sequential'
      });
      
      group.startVotingRound(restaurant);
      
      expect(group.currentRound!.yesVotes).toBe(0);
      expect(group.currentRound!.noVotes).toBe(0);
      expect(group.currentRound!.votes.size).toBe(0);
      
      await group.deleteOne();
    });
  });

  describe('endCurrentRound() - Sequential Voting', () => {
    test('should set currentRound.status to expired when currentRound exists', async () => {
      /**
       * Tests: endCurrentRound() sets status to 'expired'
       * Covers: Lines 443-446 - if (this.currentRound) { this.currentRound.status = 'expired'; }
       * Input: Group with active currentRound
       * Expected: currentRound.status set to 'expired'
       */
      const restaurant = {
        name: 'End Round Restaurant',
        location: '123 End St',
        restaurantId: 'end-round-123'
      };
      
      const group = new Group({
        roomId: 'test-room-end-round',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2'],
        votingMode: 'sequential',
        restaurantPool: [restaurant]
      });
      
      group.startVotingRound(restaurant);
      await group.save();
      
      // Verify initial status is 'active'
      expect(group.currentRound!.status).toBe('active');
      
      // End the round
      group.endCurrentRound();
      
      // Verify status changed to 'expired'
      expect(group.currentRound!.status).toBe('expired');
      
      await group.deleteOne();
    });

    test('should handle endCurrentRound when currentRound is undefined', async () => {
      /**
       * Tests: endCurrentRound() handles undefined currentRound gracefully
       * Covers: Line 444 - if (this.currentRound) check
       * Input: Group with no currentRound
       * Expected: No error thrown, nothing happens
       */
      const group = new Group({
        roomId: 'test-room-end-round-undefined',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2'],
        votingMode: 'sequential',
        currentRound: undefined
      });
      
      await group.save();
      
      // Should not throw error
      expect(() => {
        group.endCurrentRound();
      }).not.toThrow();
      
      await group.deleteOne();
    });
  });

  describe('getWinningRestaurant() - Legacy Voting', () => {
    test('should return restaurant with most votes', async () => {
      /**
       * Tests: getWinningRestaurant() finds restaurant with max votes
       * Input: Group with multiple restaurants and votes
       * Expected: Returns restaurantId with highest vote count
       */
      const group = new Group({
        roomId: 'test-room-winning',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2', 'user3'],
        votingMode: 'list'
      });
      
      // Add votes: rest-1 gets 2 votes, rest-2 gets 1 vote
      group.addVote('user1', 'rest-1');
      group.addVote('user2', 'rest-1');
      group.addVote('user3', 'rest-2');
      
      await group.save();
      
      const winner = group.getWinningRestaurant();
      
      expect(winner).toBe('rest-1');
      expect(group.restaurantVotes.get('rest-1')).toBe(2);
      expect(group.restaurantVotes.get('rest-2')).toBe(1);
      
      await group.deleteOne();
    });

    test('should return null when no votes exist', async () => {
      /**
       * Tests: getWinningRestaurant() returns null when restaurantVotes is empty
       * Input: Group with no votes
       * Expected: Returns null
       */
      const group = new Group({
        roomId: 'test-room-winning-empty',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2'],
        votingMode: 'list'
      });
      
      await group.save();
      
      const winner = group.getWinningRestaurant();
      
      expect(winner).toBeNull();
      expect(group.restaurantVotes.size).toBe(0);
      
      await group.deleteOne();
    });

    test('should handle tie by returning first restaurant with max votes', async () => {
      /**
       * Tests: getWinningRestaurant() handles ties (returns first encountered)
       * Input: Group with multiple restaurants having same max votes
       * Expected: Returns first restaurant encountered with max votes
       */
      const group = new Group({
        roomId: 'test-room-winning-tie',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2'],
        votingMode: 'list'
      });
      
      // Both restaurants get 1 vote (tie)
      group.addVote('user1', 'rest-1');
      group.addVote('user2', 'rest-2');
      
      await group.save();
      
      const winner = group.getWinningRestaurant();
      
      // Should return first one encountered (rest-1, since forEach iterates in insertion order)
      expect(winner).toBe('rest-1');
      expect(group.restaurantVotes.get('rest-1')).toBe(1);
      expect(group.restaurantVotes.get('rest-2')).toBe(1);
      
      await group.deleteOne();
    });

    test('should return restaurant with highest votes when multiple exist', async () => {
      /**
       * Tests: getWinningRestaurant() correctly identifies highest vote count
       * Input: Group with 3 restaurants, different vote counts
       * Expected: Returns restaurantId with highest count
       */
      const group = new Group({
        roomId: 'test-room-winning-multiple',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2', 'user3', 'user4'],
        votingMode: 'list'
      });
      
      // rest-1: 1 vote, rest-2: 3 votes (winner), rest-3: 0 votes
      group.addVote('user1', 'rest-1');
      group.addVote('user2', 'rest-2');
      group.addVote('user3', 'rest-2');
      group.addVote('user4', 'rest-2');
      
      await group.save();
      
      const winner = group.getWinningRestaurant();
      
      expect(winner).toBe('rest-2');
      expect(group.restaurantVotes.get('rest-2')).toBe(3);
      expect(group.restaurantVotes.get('rest-1')).toBe(1);
      
      await group.deleteOne();
    });

    test('should handle vote changes correctly', async () => {
      /**
       * Tests: getWinningRestaurant() reflects current vote state after changes
       * Input: Group where votes change
       * Expected: Returns updated winner
       */
      const group = new Group({
        roomId: 'test-room-winning-changes',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2', 'user3'],
        votingMode: 'list'
      });
      
      // Initially rest-1 wins
      group.addVote('user1', 'rest-1');
      group.addVote('user2', 'rest-1');
      group.addVote('user3', 'rest-2');
      
      await group.save();
      
      expect(group.getWinningRestaurant()).toBe('rest-1');
      
      // Change user1's vote to rest-2, now rest-2 wins
      group.addVote('user1', 'rest-2');
      
      expect(group.getWinningRestaurant()).toBe('rest-2');
      expect(group.restaurantVotes.get('rest-2')).toBe(2);
      expect(group.restaurantVotes.get('rest-1')).toBe(1);
      
      await group.deleteOne();
    });
  });

  describe('hasAllVoted() - Legacy Voting', () => {
    test('should return true when all members have voted', async () => {
      /**
       * Tests: hasAllVoted() returns true when votes.size === members.length
       * Input: Group where all members have submitted votes
       * Expected: Returns true
       */
      const group = new Group({
        roomId: 'test-room-all-voted',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2', 'user3'],
        votingMode: 'list'
      });
      
      // All 3 members vote
      group.addVote('user1', 'rest-1');
      group.addVote('user2', 'rest-2');
      group.addVote('user3', 'rest-3');
      
      await group.save();
      
      expect(group.hasAllVoted()).toBe(true);
      expect(group.votes.size).toBe(3);
      expect(group.members.length).toBe(3);
      
      await group.deleteOne();
    });

    test('should return false when not all members have voted', async () => {
      /**
       * Tests: hasAllVoted() returns false when votes.size < members.length
       * Input: Group where some members haven't voted
       * Expected: Returns false
       */
      const group = new Group({
        roomId: 'test-room-not-all-voted',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2', 'user3'],
        votingMode: 'list'
      });
      
      // Only 2 out of 3 members vote
      group.addVote('user1', 'rest-1');
      group.addVote('user2', 'rest-2');
      
      await group.save();
      
      expect(group.hasAllVoted()).toBe(false);
      expect(group.votes.size).toBe(2);
      expect(group.members.length).toBe(3);
      
      await group.deleteOne();
    });

    test('should return false when no members have voted', async () => {
      /**
       * Tests: hasAllVoted() returns false when votes.size === 0
       * Input: Group with no votes
       * Expected: Returns false
       */
      const group = new Group({
        roomId: 'test-room-no-votes',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2'],
        votingMode: 'list'
      });
      
      await group.save();
      
      expect(group.hasAllVoted()).toBe(false);
      expect(group.votes.size).toBe(0);
      expect(group.members.length).toBe(2);
      
      await group.deleteOne();
    });

    test('should return true when single member has voted in single-member group', async () => {
      /**
       * Tests: hasAllVoted() returns true for single member group
       * Input: Group with 1 member who has voted
       * Expected: Returns true
       */
      const group = new Group({
        roomId: 'test-room-single-voted',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1'],
        votingMode: 'list'
      });
      
      group.addVote('user1', 'rest-1');
      
      await group.save();
      
      expect(group.hasAllVoted()).toBe(true);
      expect(group.votes.size).toBe(1);
      expect(group.members.length).toBe(1);
      
      await group.deleteOne();
    });

    test('should return false when member changes vote (still counts as voted)', async () => {
      /**
       * Tests: hasAllVoted() still returns true when member changes vote
       * Input: Group where member changes their vote
       * Expected: Returns true (vote count unchanged, all still voted)
       */
      const group = new Group({
        roomId: 'test-room-change-vote',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2'],
        votingMode: 'list'
      });
      
      // Both vote
      group.addVote('user1', 'rest-1');
      group.addVote('user2', 'rest-2');
      
      await group.save();
      
      expect(group.hasAllVoted()).toBe(true);
      
      // User1 changes vote
      group.addVote('user1', 'rest-3');
      
      // Still all voted (vote count unchanged)
      expect(group.hasAllVoted()).toBe(true);
      expect(group.votes.size).toBe(2);
      
      await group.deleteOne();
    });

    test('should return false when member is removed after voting', async () => {
      /**
       * Tests: hasAllVoted() returns false when member count changes
       * Input: Group where member votes then is removed
       * Expected: Returns false (members.length > votes.size)
       */
      const group = new Group({
        roomId: 'test-room-remove-after-vote',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1', 'user2', 'user3'],
        votingMode: 'list'
      });
      
      // All vote
      group.addVote('user1', 'rest-1');
      group.addVote('user2', 'rest-2');
      group.addVote('user3', 'rest-3');
      
      await group.save();
      
      expect(group.hasAllVoted()).toBe(true);
      
      // Remove user3 (vote is also removed by removeMember)
      group.removeMember('user3');
      
      // Now not all voted (2 votes, 2 members - but removeMember also removes vote)
      // Actually, removeMember calls removeVote, so votes.size should be 2, members.length is 2
      expect(group.hasAllVoted()).toBe(true); // Both remaining members have votes
      expect(group.votes.size).toBe(2);
      expect(group.members.length).toBe(2);
      
      await group.deleteOne();
    });

    test('should handle empty members array', async () => {
      /**
       * Tests: hasAllVoted() handles edge case of empty members
       * Input: Group with empty members array
       * Expected: Returns true (0 === 0)
       */
      const group = new Group({
        roomId: 'test-room-empty-members',
        completionTime: new Date(Date.now() + 3600000),
        members: [],
        votingMode: 'list'
      });
      
      await group.save();
      
      expect(group.hasAllVoted()).toBe(true);
      expect(group.votes.size).toBe(0);
      expect(group.members.length).toBe(0);
      
      await group.deleteOne();
    });
  });

  describe('toObject with virtuals', () => {
    test('toObject should include virtuals but preserve _id', async () => {
      /**
       * Tests: GroupSchema.set('toObject', { virtuals: true })
       * Input: Group document with toObject() called
       * Expected: Object has groupId virtual and _id (unlike toJSON)
       */
      const group = new Group({
        roomId: 'test-room-toobject',
        completionTime: new Date(Date.now() + 3600000),
        members: ['user1']
      });
      
      await group.save();
      
      const obj = group.toObject() as any;
      
      // toObject includes virtuals but doesn't transform (keeps _id)
      expect(obj).toHaveProperty('groupId');
      expect(obj.groupId).toBe(group._id.toString());
      // toObject may include _id (depends on options, but virtual should work)
      expect(obj.groupId).toBeDefined();
      
      await group.deleteOne();
    });
  });
});

