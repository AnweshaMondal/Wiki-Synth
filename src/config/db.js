const mongoose = require('mongoose');

module.exports = async function connectDB() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MongoDB URI not provided in environment variables');
    }
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully to:', mongoUri.replace(/\/\/.*@/, '//***:***@'));
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};
