const mongoose = require('mongoose');
const jwt      = require('jsonwebtoken');

let isConnected = false;
async function connectDB() {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false });
  isConnected = true;
}

// ── Order Model ──
const OrderItemSchema = new mongoose.Schema({
  productId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name:        { type: String, required: true },
  category:    { type: String, default: '' },
  imageUrl:    { type: String, default: '' },
  price:       { type: Number, required: true },
  quantity:    { type: Number, default: 1 },
});

const OrderSchema = new mongoose.Schema({
  orderId:     { type: String, required: true, unique: true },
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userEmail:   { type: String, required: true },
  userName:    { type: String, required: true },
  items:       [OrderItemSchema],
  subtotal:    { type: Number, required: true },
  discount:    { type: Number, default: 0 },
  tax:         { type: Number, default: 0 },
  total:       { type: Number, required: true },
  status:      { type: String, enum: ['pending', 'paid', 'cancelled', 'expired'], default: 'pending' },
  paymentMethod: { type: String, default: 'qris' },
  paymentToken:  { type: String, default: '' },
  licenseKey:    { type: String, default: '' },
  downloadUrl:   { type: String, default: '' },
  paidAt:      { type: Date },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now },
});
const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);

// ── Verify JWT ──
function verifyToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  try { return jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET); }
  catch { return null; }
}

// ── Generate IDs ──
function generateOrderId() {
  const ts  = Date.now().toString().slice(-8);
  const rnd = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `UNKG-${ts}-${rnd}`;
}
function generateLicenseKey() {
  const seg = () => Math.random().toString(36).substr(2, 4).toUpperCase();
  return `UNKG-${seg()}-${seg()}-${seg()}`;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Login diperlukan.' });

  try {
    await connectDB();

    // ── GET: Riwayat transaksi user ──
    if (req.method === 'GET') {
      const orders = await Order.find({ userId: decoded.userId })
        .sort({ createdAt: -1 })
        .limit(50);
      return res.status(200).json({ orders });
    }

    // ── POST: Buat order baru ──
    if (req.method === 'POST') {
      const { items, paymentMethod = 'qris' } = req.body;

      if (!items || !items.length) {
        return res.status(400).json({ error: 'Keranjang belanja kosong.' });
      }

      // Hitung total
      const subtotal = items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
      const discount = Math.round(subtotal * 0.10); // Diskon UMKM 10%
      const afterDisc = subtotal - discount;
      const tax      = Math.round(afterDisc * 0.11); // PPN 11%
      const total    = afterDisc + tax;

      const orderId    = generateOrderId();
      const licenseKey = generateLicenseKey();

      const order = await Order.create({
        orderId,
        userId:    decoded.userId,
        userEmail: decoded.email,
        userName:  decoded.name,
        items: items.map(item => ({
          productId: item._id || item.productId,
          name:      item.name,
          category:  item.category || '',
          imageUrl:  item.imageUrl || '',
          price:     item.price,
          quantity:  item.quantity || 1,
        })),
        subtotal,
        discount,
        tax,
        total,
        paymentMethod,
        licenseKey,
        downloadUrl: 'https://edlink.id/panel/classes/1657913/sections/24919383/7823346',
        status: 'pending',
      });

      return res.status(201).json({
        message:  'Order berhasil dibuat!',
        order,
        orderId,
        licenseKey,
        total,
      });
    }

    return res.status(405).json({ error: 'Method tidak diizinkan.' });
  } catch (err) {
    console.error('[Orders Error]', err);
    return res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
};