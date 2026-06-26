const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const connectDB = require('../../middleware/db');
const User      = require('../../models/User');

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method tidak diizinkan' });
  }

  try {
    await connectDB();

    const { email, password } = req.body;

    // ── Validasi input ──────────────────────────────
    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan password wajib diisi.' });
    }

    // ── Cari user ───────────────────────────────────
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Pesan generik supaya tidak membocorkan apakah email terdaftar
      return res.status(401).json({ error: 'Email atau password salah.' });
    }

    // ── Verifikasi password ─────────────────────────
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Email atau password salah.' });
    }

    // ── Buat JWT token ──────────────────────────────
    const token = jwt.sign(
      { userId: user._id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      message: 'Login berhasil!',
      token,
      user: {
        id:           user._id,
        name:         user.name,
        email:        user.email,
        businessName: user.businessName,
      },
    });

  } catch (err) {
    console.error('[Login Error]', err);
    return res.status(500).json({ error: 'Terjadi kesalahan server. Coba lagi.' });
  }
};