const connectDB      = require('../../middleware/db');
const User           = require('../../models/User');
const authMiddleware = require('../../middleware/auth');

// Vercel serverless tidak support middleware express secara langsung,
// jadi kita jalankan authMiddleware manual
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method tidak diizinkan' });
  }

  // Jalankan auth middleware secara manual
  await new Promise((resolve, reject) => {
    authMiddleware(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  }).catch(() => null);

  // Jika res sudah dikirim oleh middleware (unauthorized), hentikan
  if (res.headersSent) return;

  try {
    await connectDB();

    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User tidak ditemukan.' });
    }

    return res.status(200).json({
      user: {
        id:           user._id,
        name:         user.name,
        email:        user.email,
        businessName: user.businessName,
        phone:        user.phone,
        createdAt:    user.createdAt,
      },
    });

  } catch (err) {
    console.error('[Me Error]', err);
    return res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
};