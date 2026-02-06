const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Report = require('../models/Report');

function toNumber(v, fallback = 0) {
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^0-9,.-]/g, '').replace(',', '.');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : fallback;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function roundMoney(v) {
  return Math.round(v * 100) / 100;
}

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date = new Date()) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function normalizeCategory(value) {
  return String(value || '').trim().toLowerCase();
}

function formatMonthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getIsoWeekKey(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const week = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getPeriodKey(date, groupBy) {
  if (groupBy === 'day') {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  if (groupBy === 'week') return getIsoWeekKey(date);
  return formatMonthKey(date);
}

function computeOrderTotalFromItems(items = [], productMap = null) {
  let total = 0;
  for (const item of items) {
    const qty = toNumber(item.cantidad || item.quantity || item.qty || item.unidades, 0);
    let unitPrice = toNumber(item.precio || item.unitPrice || item.price || item.precioUnitario || item.precio_unitario || item.unit_price || item.priceUnit, 0);
    if (unitPrice === 0 && productMap) {
      const pid = String(item.productId || item.id || item._id || '');
      const info = productMap.get(pid) || {};
      if (info.price) unitPrice = toNumber(info.price, 0);
    }
    let lineRevenue = toNumber(item.subtotal || item.lineTotal || item.total || item.totalPrice || item.precioTotal || item.precio_total, 0);
    if (lineRevenue === 0 && unitPrice > 0) lineRevenue = roundMoney(unitPrice * qty);
    total += lineRevenue;
  }
  return roundMoney(total);
}

async function buildProductMap() {
  const allProducts = await Product.find({}).lean();
  const productMap = new Map();
  for (const p of allProducts) {
    productMap.set(p._id.toString(), {
      id: p.id || '',
      name: p.nombre || p.name || 'Unnamed product',
      category: p.categoria || p.category || 'otros',
      price: toNumber(p.precio || p.price, 0)
    });
  }
  return productMap;
}

async function buildUserMap() {
  const allUsers = await User.find({}, { nombre: 1, apellido: 1, email: 1 }).lean();
  const userMap = new Map();
  for (const u of allUsers) {
    const fullName = [u.nombre || '', u.apellido || ''].join(' ').trim();
    userMap.set(u._id.toString(), { name: fullName, email: u.email || '' });
  }
  return userMap;
}

async function buildReportData() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);

  const orders = await Order.find({}).lean();
  console.log(`[buildReportData] Found ${orders.length} orders in database`);

  const productMap = await buildProductMap();

  let totalSales = 0;
  let totalOrders = orders.length;
  let totalItemsSold = 0;
  let salesToday = 0;
  let salesWeek = 0;
  let salesMonth = 0;
  let ordersToday = 0;
  let ordersWeek = 0;
  let ordersMonth = 0;

  const productSales = {};
  const categoryRevenue = {};

  for (const order of orders) {
    const orderDate = new Date(order.fecha || order.createdAt || 0);
    let orderTotal = toNumber(
      order.resumen?.totales?.total ??
      order.resumen?.total ??
      order.totales?.total ??
      order.total ??
      order.totalAmount ??
      0,
      0
    );

    if (orderTotal === 0 && order.resumen) {
      const resumen = order.resumen || {};
      const subtotal = toNumber(resumen.subtotal ?? resumen.subTotal ?? 0, 0);
      const taxes = toNumber(resumen.iva ?? resumen.tax ?? 0, 0);
      const shipping = toNumber(resumen.envio ?? resumen.shipping ?? 0, 0);
      const discount = toNumber(resumen.discount ?? 0, 0);
      if (subtotal || taxes || shipping || discount) {
        orderTotal = roundMoney(Math.max(0, subtotal + taxes + shipping - discount));
      }
    }

    const items = order.resumen?.productos || order.productos || order.items || [];
    if (orderTotal === 0 && items.length) {
      orderTotal = computeOrderTotalFromItems(items, productMap);
    }
    totalSales += orderTotal;

    const isToday = orderDate >= todayStart;
    const isThisWeek = orderDate >= weekStart;
    const isThisMonth = orderDate >= monthStart;

    if (isToday) { salesToday += orderTotal; ordersToday += 1; }
    if (isThisWeek) { salesWeek += orderTotal; ordersWeek += 1; }
    if (isThisMonth) { salesMonth += orderTotal; ordersMonth += 1; }

    for (const item of items) {
      const pid = String(item.productId || item.id || item._id || 'unknown');
      const qty = toNumber(item.cantidad || item.quantity, 0);
      const productInfo = productMap.get(pid) || {};
      let unitPrice = toNumber(item.precio || item.unitPrice || item.price, 0);
      if (unitPrice === 0 && productInfo.price) unitPrice = toNumber(productInfo.price, 0);
      let lineRevenue = toNumber(item.subtotal || item.lineTotal, 0);
      if (lineRevenue === 0 && unitPrice > 0) lineRevenue = roundMoney(unitPrice * qty);
      const name = productInfo.name || item.nombre || item.productName || 'Unknown product';
      const productNumericId = productInfo.id || '';
      const category = productInfo.category || item.categoria || item.category || 'otros';

      totalItemsSold += qty;

      if (!productSales[pid]) {
        productSales[pid] = { productId: pid, id: productNumericId, name, quantity: 0, revenue: 0, category };
      }
      productSales[pid].quantity += qty;
      productSales[pid].revenue += lineRevenue;

      categoryRevenue[category] = (categoryRevenue[category] || 0) + lineRevenue;
    }
  }

  const topProducts = Object.values(productSales)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10)
    .map((p) => ({
      productId: mongoose.Types.ObjectId.isValid(p.productId) ? p.productId : undefined,
      id: p.id || '',
      name: p.name,
      quantity: p.quantity,
      revenue: roundMoney(p.revenue)
    }));

  const revenueByCategory = {};
  for (const cat of Object.keys(categoryRevenue)) revenueByCategory[cat] = roundMoney(categoryRevenue[cat]);

  return {
    type: 'snapshot',
    generatedAt: now,
    periodStart: monthStart,
    periodEnd: now,
    totals: {
      sales: roundMoney(totalSales),
      orders: totalOrders,
      itemsSold: totalItemsSold,
      averageOrderValue: totalOrders ? roundMoney(totalSales / totalOrders) : 0
    },
    sales: {
      today: roundMoney(salesToday),
      week: roundMoney(salesWeek),
      month: roundMoney(salesMonth)
    },
    orders: {
      today: ordersToday,
      week: ordersWeek,
      month: ordersMonth
    },
    topProducts,
    topCustomers: [],
    revenueByCategory
  };
}

async function findUserByIdentifier(identifier) {
  if (!identifier) return null;
  const idStr = String(identifier).trim();
  const idNum = parseInt(idStr, 10);
  console.log(`[findUserByIdentifier] Searching for: "${idStr}", as number: ${idNum}`);
  if (mongoose.Types.ObjectId.isValid(idStr) && idStr.length === 24) { const byObjectId = await User.findById(idStr); if (byObjectId) { console.log(`[findUserByIdentifier] Found by _id`); return byObjectId; } }
  const orConditions = [{ id: idStr }]; if (!isNaN(idNum)) { orConditions.push({ id: idNum }); } orConditions.push({ email: idStr });
  const user = await User.findOne({ $or: orConditions }); if (user) { console.log(`[findUserByIdentifier] Found user: ${user.email}`); return user; }
  const allUsers = await User.find({}, { id: 1, email: 1, _id: 1 }).limit(10).lean();
  console.log(`[findUserByIdentifier] Not found. Sample users in DB:`, JSON.stringify(allUsers));
  return null;
}

async function findProductByIdentifier(identifier, session = null) {
  if (!identifier) return null;
  const idStr = String(identifier).trim();
  if (mongoose.Types.ObjectId.isValid(idStr) && idStr.length === 24) { const query = Product.findById(idStr); if (session) query.session(session); const byObjectId = await query; if (byObjectId) return byObjectId; }
  let query = Product.findOne({ id: idStr }); if (session) query.session(session); const byIdStr = await query; if (byIdStr) return byIdStr; query = Product.findOne({ id: Number(idStr) }); if (session) query.session(session); return await query;
}

router.post('/', authMiddleware, async (req, res) => {
  let session = null;
  try {
    const body = req.body || {};
    const shouldSave = body.save !== false && body.save !== 'false';
    const notas = body.notas || body.notes || '';

    let createdOrder = null;

    if (body.userId && body.products && Array.isArray(body.products) && body.products.length > 0) {
      const attachedUser = await findUserByIdentifier(body.userId);
      if (!attachedUser) { return res.status(404).json({ error: `User not found: ${body.userId}` }); }

      const cliente = { id: attachedUser._id.toString(), odooId: attachedUser.id || '', nombre: attachedUser.nombre || '', apellido: attachedUser.apellido || '', email: attachedUser.email || '', telefono: attachedUser.telefono || '' };

      const rawProducts = body.products;
      const sanitizedItems = [];
      for (const item of rawProducts) {
        const rawId = item.productId || item.id || item._id;
        const productId = rawId ? String(rawId).trim() : '';
        if (!productId) { return res.status(400).json({ error: 'Each product must have productId' }); }
        const quantity = Math.floor(toNumber(item.quantity ?? item.cantidad, 0));
        if (quantity <= 0) { return res.status(400).json({ error: `Invalid quantity for product ${productId}` }); }
        sanitizedItems.push({ productId, quantity });
      }

      session = await mongoose.startSession();

      await session.withTransaction(async () => {
        const orderItems = [];
        let subtotal = 0;

        for (const item of sanitizedItems) {
          const product = await findProductByIdentifier(item.productId, session);
          if (!product) { const err = new Error(`Product not found: ${item.productId}`); err.status = 404; throw err; }
          const available = toNumber(product.stock, 0);
          if (available < item.quantity) { const err = new Error(`Insufficient stock for ${product.nombre || product._id}`); err.status = 400; throw err; }
          product.stock = available - item.quantity; await product.save({ session });
          const basePrice = toNumber(product.precio, 0);
          const discountPct = toNumber(product.descuento, 0);
          const unitPrice = roundMoney(basePrice * (1 - discountPct / 100));
          const lineTotal = roundMoney(unitPrice * item.quantity);
          subtotal += lineTotal;

          orderItems.push({ productId: product._id.toString(), id: product.id || '', nombre: product.nombre, categoria: product.categoria || 'otros', cantidad: item.quantity, unitPrice, lineTotal, subtotal: lineTotal });
        }

        const TAX_RATE = 0.15;
        const shippingSource = body.shipping || body.entrega || {};
        const shippingCost = roundMoney(toNumber(shippingSource.costo ?? shippingSource.cost ?? 3.5, 0));
        const discount = roundMoney(Math.max(0, toNumber(body.discount ?? 0, 0)));
        const taxes = roundMoney(subtotal * TAX_RATE);
        const total = roundMoney(Math.max(0, subtotal + taxes + shippingCost - discount));

        const totales = { subtotal: roundMoney(subtotal), iva: taxes, envio: shippingCost, discount, total };

        const paymentSource = body.payment || body.pago || {};
        const pago = { metodo: paymentSource.metodo || paymentSource.method || 'efectivo', estado: paymentSource.estado || 'pagado', referencia: paymentSource.referencia || paymentSource.reference || '' };

        const entrega = { direccion: shippingSource.direccion || shippingSource.address || '', referencias: shippingSource.referencias || '', contacto: shippingSource.contacto || '' };

        const resumen = { cliente, productos: orderItems, totales, entrega, pago };

        const order = new Order({ userId: attachedUser._id, items: orderItems, resumen, estado: 'confirmado', fecha: new Date() });

        await order.save({ session });

        const userForUpdate = await User.findById(attachedUser._id).session(session);
        if (userForUpdate) {
          userForUpdate.orders = userForUpdate.orders || [];
          userForUpdate.orders.push({ orderId: order._id, codigo: order.id, fecha: order.fecha, resumen });
          userForUpdate.cart = [];
          await userForUpdate.save({ session });
        }
      });
    }

    const reportData = await buildReportData();

    if (shouldSave) {
      const r = new Report({ name: body.name || `snapshot-${Date.now()}`, type: 'snapshot', payload: reportData, language: 'en', createdBy: req.user?.email || '' });
      await r.save();
    }

    res.json({ success: true, report: reportData });
  } catch (err) {
    console.error('Error generating report:', err);
    res.status(err.status || 500).json({ error: err.message || 'Report generation failed' });
  } finally {
    if (session) { try { await session.endSession(); } catch (e) { console.warn('Could not end session:', e); } }
  }
});

// Create a custom report (accepts filters, name, type)
router.post('/custom', authMiddleware, async (req, res) => {
  try {
    const body = req.body || {};
    const name = body.name || `custom-${Date.now()}`;
    const type = body.type || 'custom';
    const start = body.periodStart ? new Date(body.periodStart) : startOfMonth();
    const end = body.periodEnd ? new Date(body.periodEnd) : new Date();
    const status = body.status ? String(body.status).trim() : '';
    const categoryFilter = normalizeCategory(body.category);
    const groupBy = ['day', 'week', 'month'].includes(body.groupBy) ? body.groupBy : 'month';
    const topN = Math.min(Math.max(toNumber(body.topN, 5), 1), 50);
    const includeTaxes = body.includeTaxes !== false && body.includeTaxes !== 'false';
    const includeShipping = body.includeShipping !== false && body.includeShipping !== 'false';
    const minTotal = body.minTotal !== undefined && body.minTotal !== '' ? toNumber(body.minTotal, 0) : null;
    const maxTotal = body.maxTotal !== undefined && body.maxTotal !== '' ? toNumber(body.maxTotal, 0) : null;
    const focus = body.focus || (type === 'users' ? 'most_active' : (type === 'products' ? 'top_sold' : 'top_revenue'));

    const dateMatch = { $gte: start, $lte: end };
    const query = { $and: [{ $or: [{ fecha: dateMatch }, { createdAt: dateMatch }] }] };
    if (status) query.$and.push({ estado: status });

    const orders = await Order.find(query).lean();
    const productMap = await buildProductMap();
    const userMap = await buildUserMap();

    let totalSales = 0;
    let orderCount = 0;
    let itemsSold = 0;

    const productSales = {};
    const categoryRevenue = {};
    const seriesMap = new Map();
    const customerStats = {};

    for (const order of orders) {
      const orderDate = new Date(order.fecha || order.createdAt || 0);
      const totals = order.resumen?.totales || order.resumen || order.totales || {};
      const subtotal = toNumber(totals.subtotal, 0);
      const taxes = toNumber(totals.iva ?? totals.tax, 0);
      const shipping = toNumber(totals.envio ?? totals.shipping, 0);
      const discount = toNumber(totals.discount ?? 0, 0);
      let computedTotal = roundMoney(Math.max(0, subtotal - discount + (includeTaxes ? taxes : 0) + (includeShipping ? shipping : 0)));

      const items = order.resumen?.productos || order.productos || order.items || [];
      let itemsSoldMatch = 0;
      let itemsSoldAll = 0;
      let itemsRevenue = 0;
      let matchedCategory = !categoryFilter;

      for (const item of items) {
        const pid = String(item.productId || item.id || item._id || 'unknown');
        const qty = toNumber(item.cantidad || item.quantity, 0);
        itemsSoldAll += qty;

        const productInfo = productMap.get(pid) || {};
        let unitPrice = toNumber(item.precio || item.unitPrice || item.price, 0);
        if (unitPrice === 0 && productInfo.price) unitPrice = toNumber(productInfo.price, 0);
        let lineRevenue = toNumber(item.subtotal || item.lineTotal, 0);
        if (lineRevenue === 0 && unitPrice > 0) lineRevenue = roundMoney(unitPrice * qty);

        const name = productInfo.name || item.nombre || item.productName || 'Unknown product';
        const productNumericId = productInfo.id || '';
        const category = productInfo.category || item.categoria || item.category || 'otros';
        const normalizedCategory = normalizeCategory(category);
        const matchesCategory = !categoryFilter || normalizedCategory === categoryFilter;

        if (!matchesCategory) continue;
        matchedCategory = true;
        itemsSoldMatch += qty;
        itemsRevenue += lineRevenue;

        if (!productSales[pid]) {
          productSales[pid] = { productId: pid, id: productNumericId, name, quantity: 0, revenue: 0, category };
        }
        productSales[pid].quantity += qty;
        productSales[pid].revenue += lineRevenue;

        categoryRevenue[category] = (categoryRevenue[category] || 0) + lineRevenue;
      }

      if (!matchedCategory) continue;

      if (computedTotal === 0 && items.length) {
        computedTotal = computeOrderTotalFromItems(items, productMap);
      }

      if (computedTotal === 0) {
        computedTotal = toNumber(
          order.resumen?.totales?.total ??
          order.resumen?.total ??
          order.totales?.total ??
          order.total ??
          order.totalAmount ??
          0,
          0
        );
      }

      const orderRevenue = categoryFilter ? itemsRevenue : computedTotal;
      if (minTotal !== null && orderRevenue < minTotal) continue;
      if (maxTotal !== null && orderRevenue > maxTotal) continue;

      totalSales += orderRevenue;
      orderCount += 1;
      itemsSold += categoryFilter ? itemsSoldMatch : itemsSoldAll;

      const userIdKey = order.userId ? String(order.userId) : '';
      const customerKey = order.resumen?.cliente?.email || order.resumen?.cliente?.id || userIdKey || String(order.user || '');
      if (customerKey) {
        if (!customerStats[customerKey]) {
          const userInfo = userIdKey ? userMap.get(userIdKey) : null;
          customerStats[customerKey] = {
            key: customerKey,
            name: order.resumen?.cliente?.nombre ? `${order.resumen?.cliente?.nombre} ${order.resumen?.cliente?.apellido || ''}`.trim() : (userInfo?.name || ''),
            email: order.resumen?.cliente?.email || userInfo?.email || '',
            orders: 0,
            spent: 0
          };
        }
        customerStats[customerKey].orders += 1;
        customerStats[customerKey].spent += orderRevenue;
      }

      const periodKey = getPeriodKey(orderDate, groupBy);
      const existing = seriesMap.get(periodKey) || { period: periodKey, sales: 0, orders: 0 };
      existing.sales += orderRevenue;
      existing.orders += 1;
      seriesMap.set(periodKey, existing);
    }

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, topN)
      .map((p) => ({
        productId: mongoose.Types.ObjectId.isValid(p.productId) ? p.productId : undefined,
        id: p.id || '',
        name: p.name,
        quantity: p.quantity,
        revenue: roundMoney(p.revenue),
        category: p.category
      }));

    const revenueByCategory = {};
    for (const cat of Object.keys(categoryRevenue)) revenueByCategory[cat] = roundMoney(categoryRevenue[cat]);

    const topCustomers = Object.values(customerStats)
      .sort((a, b) => b.spent - a.spent)
      .slice(0, topN)
      .map((c) => ({
        name: c.name,
        email: c.email,
        orders: c.orders,
        spent: roundMoney(c.spent)
      }));

    const timeSeries = Array.from(seriesMap.values())
      .sort((a, b) => a.period.localeCompare(b.period))
      .map((row) => ({ period: row.period, sales: roundMoney(row.sales), orders: row.orders }));

    const reportPayload = {
      type,
      generatedAt: new Date(),
      periodStart: start,
      periodEnd: end,
      filters: {
        status: status || 'all',
        category: categoryFilter || '',
        minTotal,
        maxTotal,
        groupBy,
        topN,
        includeTaxes,
        includeShipping,
        focus
      },
      totals: {
        sales: roundMoney(totalSales),
        orders: orderCount,
        itemsSold,
        averageOrderValue: orderCount ? roundMoney(totalSales / orderCount) : 0
      },
      timeSeries,
      topProducts,
      topCustomers,
      revenueByCategory
    };

    if (type === 'products') {
      reportPayload.totals = {
        itemsSold,
        sales: roundMoney(totalSales)
      };
      reportPayload.topCustomers = [];
      reportPayload.timeSeries = [];
    } else if (type === 'users') {
      reportPayload.totals = {
        orders: orderCount,
        sales: roundMoney(totalSales)
      };
      reportPayload.topProducts = [];
      reportPayload.revenueByCategory = {};
      reportPayload.timeSeries = [];
    } else if (type === 'sales') {
      reportPayload.topCustomers = [];
      reportPayload.revenueByCategory = {};
    }

    const save = body.save !== false && body.save !== 'false';
    let savedReport = null;
    if (save) {
      const r = new Report({ name, type, payload: reportPayload, language: 'en', createdBy: req.user?.email || '' });
      await r.save();
      savedReport = r;
    }

    res.json({ success: true, report: reportPayload, saved: savedReport });
  } catch (err) {
    console.error('Error creating custom report:', err);
    res.status(500).json({ error: err.message || 'Could not create custom report' });
  }
});

// List saved reports
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const list = await Report.find({}).sort({ createdAt: -1 }).lean();
    res.json({ success: true, reports: list });
  } catch (err) {
    console.error('Error listing reports:', err);
    res.status(500).json({ error: err.message || 'Could not list reports' });
  }
});

// Get a single report
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const r = await Report.findById(req.params.id).lean();
    if (!r) return res.status(404).json({ error: 'Report not found' });
    res.json({ success: true, report: r });
  } catch (err) {
    console.error('Error getting report:', err);
    res.status(500).json({ error: err.message || 'Could not get report' });
  }
});

// Delete a report
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const r = await Report.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ error: 'Report not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting report:', err);
    res.status(500).json({ error: err.message || 'Could not delete report' });
  }
});

module.exports = router;