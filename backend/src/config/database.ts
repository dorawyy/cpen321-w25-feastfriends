import mongoose from 'mongoose';

export const connectDatabase = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    const options = {
      maxPoolSize: 10,
      minPoolSize: 5,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 5000,
      family: 4
    };

    await mongoose.connect(mongoUri, options);

    mongoose.connection.on('error', () => {});
    mongoose.connection.on('disconnected', () => {});
    mongoose.connection.on('reconnected', () => {});

    process.on('SIGINT', () => {
      void (async () => {
        await mongoose.connection.close();
        process.exit(0);
      })();
    });

  } catch (error) {
    process.exit(1);
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
  } catch (error) {
    throw error;
  }
};
