const mongoose = require('mongoose');
const jwt      = require('jsonwebtoken');

let isConnected = false;
async function connectDB() {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false });
  isConnected = true;
}

const OrderSchema = new mongoose.Schema({
  orderId:     { type: String, required: true, unique: true },
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userEmail:   String,
  userName:    String,
  items:       Array,
  subtotal:    Number,
  discount:    Number,
  tax:         Number,
  total:       Number,
  status:      { type: String, enum: ['pending', 'paid', 'cancelled', 'expired'], default: 'pending' },
  paymentMethod: String,
  licenseKey:  String,
  downloadUrl: String,
  paidAt:      Date,
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now },
});
const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);

function verifyToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  try { return jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET); }
  catch { return null; }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Login diperlukan.' });

  const orderId = req.query.id;
  if (!orderId) return res.status(400).json({ error: 'Order ID diperlukan.' });

  try {
    await connectDB();

    // ── GET: Detail satu order ──
    if (req.method === 'GET') {
      const order = await Order.findOne({ orderId, userId: decoded.userId });
      if (!order) return res.status(404).json({ error: 'Order tidak ditemukan.' });
      return res.status(200).json({ order });
    }

    // ── PUT: Update status order (konfirmasi bayar) ──
    if (req.method === 'PUT') {
      const { status } = req.body;
      if (!['paid', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Status tidak valid.' });
      }

      const order = await Order.findOne({ orderId, userId: decoded.userId });
      if (!order) return res.status(404).json({ error: 'Order tidak ditemukan.' });

      order.status    = status;
      order.updatedAt = new Date();
      if (status === 'paid') order.paidAt = new Date();
      await order.save();

      return res.status(200).json({
        message: status === 'paid' ? 'Pembayaran dikonfirmasi!' : 'Order dibatalkan.',
        order,
      });
    }

    return res.status(405).json({ error: 'Method tidak diizinkan.' });
  } catch (err) {
    console.error('[Order Detail Error]', err);
    return res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
};