// tests/with-mocks/voting.routes.mock.test.ts
//
// Purpose: Cover edge branches in voting.routes.ts:
// - 401 guard when req.user is missing inside the route handler
// - 500 error handler for submit vote when groupService throws

import express from 'express';
import request from 'supertest';

// Mock auth middleware so we can control whether req.user is set
let attachUser = true;

jest.mock('../../src/middleware/auth.middleware', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    if (attachUser) {
      req.user = { userId: 'test-user-id' };
    }
    next();
  },
}));

// Mock groupService so we can force errors
const submitSequentialVoteMock = jest.fn();
const getCurrentVotingRoundMock = jest.fn();

jest.mock('../../src/services/groupService', () => ({
  __esModule: true,
  default: {
    initializeSequentialVoting: jest.fn(),
    submitSequentialVote: submitSequentialVoteMock,
    getCurrentVotingRound: getCurrentVotingRoundMock,
  },
}));

import votingRoutes from '../../src/routes/voting.routes';

const app = express();
app.use(express.json());
app.use('/api/groups', votingRoutes);

describe('Voting Routes Edge Cases (/api/groups)', () => {
  beforeEach(() => {
    attachUser = true;
    submitSequentialVoteMock.mockReset();
    getCurrentVotingRoundMock.mockReset();
  });

  test('should return 401 when req.user is missing for /:groupId/voting/vote', async () => {
    attachUser = false;

    const response = await request(app)
      .post('/api/groups/some-group-id/voting/vote')
      .send({ vote: true });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      Status: 401,
      Message: { error: 'Unauthorized' },
      Body: null,
    });
  });

  test('should return 401 when req.user is missing for /:groupId/voting/current', async () => {
    attachUser = false;

    const response = await request(app)
      .get('/api/groups/some-group-id/voting/current');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      Status: 401,
      Message: { error: 'Unauthorized' },
      Body: null,
    });
  });

  test('should return 500 with fallback message when submitSequentialVote throws non-Error', async () => {
    attachUser = true;
    // Throw a non-Error value so the route uses the fallback message
    submitSequentialVoteMock.mockRejectedValueOnce('some submit failure');

    const response = await request(app)
      .post('/api/groups/some-group-id/voting/vote')
      .send({ vote: true });

    expect(response.status).toBe(500);
    expect(response.body.Status).toBe(500);
    expect(response.body.Message).toHaveProperty('error', 'Failed to submit vote');
    expect(response.body.Body).toBeNull();
  });

  test('should return 500 when getCurrentVotingRound throws non-Error', async () => {
    attachUser = true;
    // Throw a non-Error value to hit the fallback message path
    getCurrentVotingRoundMock.mockRejectedValueOnce('some failure');

    const response = await request(app)
      .get('/api/groups/some-group-id/voting/current');

    expect(response.status).toBe(500);
    expect(response.body.Status).toBe(500);
    expect(response.body.Message).toHaveProperty('error', 'Failed to get voting round');
    expect(response.body.Body).toBeNull();
  });
});


