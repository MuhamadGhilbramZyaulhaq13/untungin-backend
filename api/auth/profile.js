const mongoose = require('mongoose');
const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');

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

// ── Verify JWT ──
function verifyToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

// ── Handler ──
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Token tidak valid. Silakan login ulang.' });

  try {
    await connectDB();

    // ── GET: Ambil profil user ──
    if (req.method === 'GET') {
      const user = await User.findById(decoded.userId).select('-password');
      if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });

      return res.status(200).json({
        user: {
          id:           user._id,
          name:         user.name,
          email:        user.email,
          businessName: user.businessName,
          phone:        user.phone,
          createdAt:    user.createdAt,
        }
      });
    }

    // ── PUT: Update profil user ──
    if (req.method === 'PUT') {
      const { name, businessName, phone, currentPassword, newPassword } = req.body;

      const user = await User.findById(decoded.userId);
      if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });

      // Update field biasa
      if (name)         user.name         = name.trim();
      if (businessName !== undefined) user.businessName = businessName.trim();
      if (phone !== undefined)        user.phone        = phone.trim();

      // Update password (opsional)
      if (newPassword) {
        if (!currentPassword) {
          return res.status(400).json({ error: 'Masukkan password lama untuk mengganti password.' });
        }
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
          return res.status(400).json({ error: 'Password lama tidak sesuai.' });
        }
        if (newPassword.length < 8) {
          return res.status(400).json({ error: 'Password baru minimal 8 karakter.' });
        }
        user.password = await bcrypt.hash(newPassword, 12);
      }

      await user.save();

      return res.status(200).json({
        message: 'Profil berhasil diperbarui!',
        user: {
          id:           user._id,
          name:         user.name,
          email:        user.email,
          businessName: user.businessName,
          phone:        user.phone,
        }
      });
    }

    return res.status(405).json({ error: 'Method tidak diizinkan.' });

  } catch (err) {
    console.error('[Profile Error]', err);
    return res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
};