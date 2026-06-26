const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ── Connect DB ──
let isConnected = false;
async function connectDB() {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false });
  isConnected = true;
}

// ── User Model ──
const UserSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  email:        { type: String, required: true, unique: true, lowercase: true },
  password:     { type: String, required: true },
  businessName: { type: String, default: '' },
  phone:        { type: String, default: '' },
  createdAt:    { type: Date, default: Date.now },
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

// ── Handler ──
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method tidak diizinkan' });

  try {
    await connectDB();

    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email dan password wajib diisi.' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: 'Email atau password salah.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Email atau password salah.' });

    const token = jwt.sign(
      { userId: user._id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      message: 'Login berhasil!',
      token,
      user: { id: user._id, name: user.name, email: user.email, businessName: user.businessName },
    });

  } catch (err) {
    console.error('[Login Error]', err);
    return res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
};