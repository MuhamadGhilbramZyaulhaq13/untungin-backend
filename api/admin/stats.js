const mongoose = require('mongoose');
const jwt      = require('jsonwebtoken');

let isConnected = false;
async function connectDB() {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false });
  isConnected = true;
}

// ── Models ──
const UserSchema = new mongoose.Schema({
  name: String, email: String, password: String,
  businessName: String, phone: String, createdAt: { type: Date, default: Date.now }
});
const OrderSchema = new mongoose.Schema({
  orderId: String, userId: mongoose.Schema.Types.ObjectId,
  userEmail: String, userName: String, items: Array,
  subtotal: Number, discount: Number, tax: Number, total: Number,
  status: String, licenseKey: String, downloadUrl: String,
  paidAt: Date, createdAt: { type: Date, default: Date.now }
});
const ProductSchema = new mongoose.Schema({
  name: String, description: String, price: Number,
  category: String, imageUrl: String, stock: Number,
  isActive: Boolean, createdAt: { type: Date, default: Date.now }
});
const User    = mongoose.models.User    || mongoose.model('User', UserSchema);
const Order   = mongoose.models.Order   || mongoose.model('Order', OrderSchema);
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

function verifyToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  try { return jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET); }
  catch { return null; }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method tidak diizinkan.' });

  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Login diperlukan.' });

  try {
    await connectDB();

    const { type } = req.query;

    // ── Stats ringkasan ──
    if (!type || type === 'summary') {
      const [totalUsers, totalProducts, allOrders] = await Promise.all([
        User.countDocuments(),
        Product.countDocuments({ isActive: true }),
        Order.find().select('total status createdAt paidAt'),
      ]);

      const paidOrders    = allOrders.filter(o => o.status === 'paid');
      const pendingOrders = allOrders.filter(o => o.status === 'pending');
      const totalRevenue  = paidOrders.reduce((s, o) => s + (o.total || 0), 0);

      // Revenue 7 hari terakhir
      const now     = new Date();
      const weekly  = [];
      for (let i = 6; i >= 0; i--) {
        const day   = new Date(now);
        day.setDate(day.getDate() - i);
        const start = new Date(day.setHours(0,0,0,0));
        const end   = new Date(day.setHours(23,59,59,999));
        const dayOrders = paidOrders.filter(o => {
          const d = new Date(o.paidAt || o.createdAt);
          return d >= start && d <= end;
        });
        weekly.push({
          date:    start.toLocaleDateString('id-ID', { weekday:'short', day:'numeric', month:'short' }),
          revenue: dayOrders.reduce((s, o) => s + (o.total || 0), 0),
          orders:  dayOrders.length,
        });
      }

      // Revenue bulanan (6 bulan terakhir)
      const monthly = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const y = d.getFullYear(), m = d.getMonth();
        const monthOrders = paidOrders.filter(o => {
          const od = new Date(o.paidAt || o.createdAt);
          return od.getFullYear() === y && od.getMonth() === m;
        });
        monthly.push({
          label:   d.toLocaleDateString('id-ID', { month:'short', year:'numeric' }),
          revenue: monthOrders.reduce((s, o) => s + (o.total || 0), 0),
          orders:  monthOrders.length,
        });
      }

      return res.status(200).json({
        summary: {
          totalUsers, totalProducts,
          totalOrders:   allOrders.length,
          paidOrders:    paidOrders.length,
          pendingOrders: pendingOrders.length,
          totalRevenue,
        },
        weekly,
        monthly,
      });
    }

    // ── Daftar users ──
    if (type === 'users') {
      const users = await User.find().select('-password').sort({ createdAt: -1 }).limit(100);
      // Hitung orders per user
      const userIds  = users.map(u => u._id.toString());
      const orders   = await Order.find({ userId: { $in: userIds } }).select('userId total status');
      const userMap  = {};
      orders.forEach(o => {
        const uid = o.userId.toString();
        if (!userMap[uid]) userMap[uid] = { orders: 0, spent: 0 };
        userMap[uid].orders++;
        if (o.status === 'paid') userMap[uid].spent += o.total || 0;
      });
      const result = users.map(u => ({
        ...u.toObject(),
        stats: userMap[u._id.toString()] || { orders: 0, spent: 0 }
      }));
      return res.status(200).json({ users: result });
    }

    // ── Daftar semua orders (admin) ──
    if (type === 'orders') {
      const orders = await Order.find().sort({ createdAt: -1 }).limit(100);
      return res.status(200).json({ orders });
    }

    return res.status(400).json({ error: 'Type tidak valid.' });

  } catch (err) {
    console.error('[Admin Stats Error]', err);
    return res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
};