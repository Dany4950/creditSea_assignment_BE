const mongoose = require('mongoose');
const env = require('./env');

async function connectDb() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 15000 });
  console.log('MongoDB connected');
}

module.exports = { connectDb };
