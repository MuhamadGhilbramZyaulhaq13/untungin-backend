const mongoose = require('mongoose');
const jwt      = require('jsonwebtoken');

let isConnected = false;
async function connectDB() {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false });
  isConnected = true;
}

// ── Product Model ──
const ProductSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  price:       { type: Number, required: true, min: 0 },
  category:    { type: String, default: 'Lainnya' },
  imageUrl:    { type: String, default: '' },
  stock:       { type: Number, default: 999 },
  isActive:    { type: Boolean, default: true },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now },
});
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

// ── Verify JWT ──
function verifyToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  try { return jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET); }
  catch { return null; }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await connectDB();

    // ── GET: Ambil semua produk (publik) ──
    if (req.method === 'GET') {
      const { search, category, minPrice, maxPrice, page = 1, limit = 20 } = req.query;

      const filter = { isActive: true };
      if (search)   filter.name = { $regex: search, $options: 'i' };
      if (category && category !== 'semua') filter.category = category;
      if (minPrice || maxPrice) {
        filter.price = {};
        if (minPrice) filter.price.$gte = Number(minPrice);
        if (maxPrice) filter.price.$lte = Number(maxPrice);
      }

      const total    = await Product.countDocuments(filter);
      const products = await Product.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .select('-createdBy');

      return res.status(200).json({ products, total, page: Number(page), totalPages: Math.ceil(total / limit) });
    }

    // ── POST: Tambah produk baru (admin only) ──
    if (req.method === 'POST') {
      const decoded = verifyToken(req);
      if (!decoded) return res.status(401).json({ error: 'Login diperlukan.' });

      const { name, description, price, category, imageUrl, stock } = req.body;

      if (!name)  return res.status(400).json({ error: 'Nama produk wajib diisi.' });
      if (!price) return res.status(400).json({ error: 'Harga produk wajib diisi.' });

      const product = await Product.create({
        name, description, price: Number(price),
        category: category || 'Lainnya',
        imageUrl: imageUrl || '',
        stock:    stock !== undefined ? Number(stock) : 999,
        createdBy: decoded.userId,
      });

      return res.status(201).json({ message: 'Produk berhasil ditambahkan!', product });
    }

    return res.status(405).json({ error: 'Method tidak diizinkan.' });
  } catch (err) {
    console.error('[Products Error]', err);
    return res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
};