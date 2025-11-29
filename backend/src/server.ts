import dotenv from 'dotenv';

dotenv.config();

import app from './app';
import http from 'http';
import { connectDatabase } from './config/database';
import { initializeFirebase } from './config/firebase';
import socketManager from './utils/socketManager';
import matchingService from './services/matchingService';
import groupService from './services/groupService';

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

let expiredRoomsInterval: NodeJS.Timeout | null = null;
let expiredGroupsInterval: NodeJS.Timeout | null = null;
let votingRoundsInterval: NodeJS.Timeout | null = null;

const startServer = async () => {
  try {
    await connectDatabase();

    try {
      initializeFirebase();
    } catch (error) {
    }

    socketManager.initialize(server);

    startBackgroundTasks();

    server.listen(Number(PORT), '0.0.0.0', () => {
    });
  } catch (error) {
    process.exit(1);
  }
};

function startBackgroundTasks() {
  expiredRoomsInterval = setInterval(() => {
    void (async () => {
      try {
        await matchingService.checkExpiredRooms();
      } catch (error) {
      }
    })();
  }, 60000);

  expiredGroupsInterval = setInterval(() => {
    void (async () => {
      try {
        await groupService.checkExpiredGroups();
      } catch (error) {
      }
    })();
  }, 120000);

  votingRoundsInterval = setInterval(() => {
    void (async () => {
      try {
        await groupService.checkExpiredVotingRounds();
      } catch (error) {
      }
    })();
  }, 15000);
}

function stopBackgroundTasks() {
  if (expiredRoomsInterval) {
    clearInterval(expiredRoomsInterval);
    expiredRoomsInterval = null;
  }
  if (expiredGroupsInterval) {
    clearInterval(expiredGroupsInterval);
    expiredGroupsInterval = null;
  }
  if (votingRoundsInterval) {
    clearInterval(votingRoundsInterval);
    votingRoundsInterval = null;
  }
}

let isShuttingDown = false;

process.on('unhandledRejection', (_reason: Error) => {
  if (isShuttingDown) {
    process.exit(1);
  }
  
  isShuttingDown = true;
  stopBackgroundTasks();

  const shutdownTimeout = setTimeout(() => {
    process.exit(1);
  }, 10000);

  server.close(() => {
    clearTimeout(shutdownTimeout);
    process.exit(1);
  });
  process.exitCode = 1;
});

process.on('uncaughtException', (_error: Error) => {
  if (isShuttingDown) {
    process.exit(1);
  }
  
  isShuttingDown = true;
  stopBackgroundTasks();

  const shutdownTimeout = setTimeout(() => {
    process.exit(1);
  }, 10000);

  server.close(() => {
    clearTimeout(shutdownTimeout);
    process.exit(1);
  });
  process.exitCode = 1;
});

process.on('SIGTERM', () => {
  if (isShuttingDown) {
    process.exit(0);
  }
  
  isShuttingDown = true;
  stopBackgroundTasks();

  const shutdownTimeout = setTimeout(() => {
    process.exit(0);
  }, 10000);

  server.close(() => {
    clearTimeout(shutdownTimeout);
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  if (isShuttingDown) {
    process.exit(0);
  }
  
  isShuttingDown = true;
  stopBackgroundTasks();

  const shutdownTimeout = setTimeout(() => {
    process.exit(0);
  }, 10000);

  server.close(() => {
    clearTimeout(shutdownTimeout);
    process.exit(0);
  });
});

void startServer();