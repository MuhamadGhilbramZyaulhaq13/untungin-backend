const mongoose = require('mongoose');
const jwt      = require('jsonwebtoken');

let isConnected = false;
async function connectDB() {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false });
  isConnected = true;
}

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

function verifyToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  try { return jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET); }
  catch { return null; }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'ID produk diperlukan.' });

  try {
    await connectDB();

    // ── GET: Detail satu produk ──
    if (req.method === 'GET') {
      const product = await Product.findById(id).select('-createdBy');
      if (!product) return res.status(404).json({ error: 'Produk tidak ditemukan.' });
      return res.status(200).json({ product });
    }

    // ── Semua method lain butuh auth ──
    const decoded = verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Login diperlukan.' });

    // ── PUT: Update produk ──
    if (req.method === 'PUT') {
      const { name, description, price, category, imageUrl, stock, isActive } = req.body;

      const product = await Product.findById(id);
      if (!product) return res.status(404).json({ error: 'Produk tidak ditemukan.' });

      if (name        !== undefined) product.name        = name.trim();
      if (description !== undefined) product.description = description;
      if (price       !== undefined) product.price       = Number(price);
      if (category    !== undefined) product.category    = category;
      if (imageUrl    !== undefined) product.imageUrl    = imageUrl;
      if (stock       !== undefined) product.stock       = Number(stock);
      if (isActive    !== undefined) product.isActive    = isActive;
      product.updatedAt = new Date();

      await product.save();
      return res.status(200).json({ message: 'Produk berhasil diperbarui!', product });
    }

    // ── DELETE: Soft delete produk ──
    if (req.method === 'DELETE') {
      const { hard } = req.query;
      const product = await Product.findById(id);
      if (!product) return res.status(404).json({ error: 'Produk tidak ditemukan.' });

      if (hard === 'true') {
        // Hard delete — hapus permanen
        await Product.findByIdAndDelete(id);
        return res.status(200).json({ message: 'Produk berhasil dihapus permanen.' });
      } else {
        // Soft delete — nonaktifkan saja
        product.isActive  = false;
        product.updatedAt = new Date();
        await product.save();
        return res.status(200).json({ message: 'Produk berhasil dinonaktifkan.', product });
      }
    }

    return res.status(405).json({ error: 'Method tidak diizinkan.' });
  } catch (err) {
    console.error('[Product Detail Error]', err);
    return res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
};