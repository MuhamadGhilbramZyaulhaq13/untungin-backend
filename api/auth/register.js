const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const connectDB = require('../../middleware/db');
const User     = require('../../models/User');

module.exports = async (req, res) => {
  // CORS headers — izinkan dari domain frontend kamu
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method tidak diizinkan' });
  }

  try {
    await connectDB();

    const { name, email, password, businessName, phone } = req.body;

    // ── Validasi input ──────────────────────────────
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nama, email, dan password wajib diisi.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password minimal 8 karakter.' });
    }

    // ── Cek email sudah terdaftar ───────────────────
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'Email sudah terdaftar. Silakan login.' });
    }

    // ── Hash password ───────────────────────────────
    const hashedPassword = await bcrypt.hash(password, 12);

    // ── Simpan user baru ────────────────────────────
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      businessName: businessName || '',
      phone: phone || '',
    });

    // ── Buat JWT token ──────────────────────────────
    const token = jwt.sign(
      { userId: user._id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'Akun berhasil dibuat!',
      token,
      user: {
        id:           user._id,
        name:         user.name,
        email:        user.email,
        businessName: user.businessName,
      },
    });

  } catch (err) {
    console.error('[Register Error]', err);
    return res.status(500).json({ error: 'Terjadi kesalahan server. Coba lagi.' });
  }
};