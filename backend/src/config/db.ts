import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/app-abbraccio';

const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connesso');
  } catch (error) {
    console.error('Impossibile connettersi a MongoDB', error);
    process.exit(1);
  }
};

export default connectDB;
