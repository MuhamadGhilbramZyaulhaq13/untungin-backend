const mongoose = require('mongoose');

let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI tidak ditemukan di environment variables');
  }

  const conn = await mongoose.connect(process.env.MONGODB_URI, {
    bufferCommands: false,
  });

  isConnected = conn.connections[0].readyState === 1;
  console.log('MongoDB Atlas terhubung');
}

module.exports = connectDB; 