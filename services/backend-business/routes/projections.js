const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authMiddleware } = require('../middleware/auth');

const Order = require('../models/Order');
const Projection = require('../models/Projection');

function toNumber(v, fallback = 0) {
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^0-9,.-]/g, '').replace(',', '.');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : fallback;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function roundMoney(v) { return Math.round(v * 100) / 100; }

function computeOrderTotalFromItems(items = []) {
  let total = 0;
  for (const item of items) {
    const qty = toNumber(item.cantidad || item.quantity || item.qty || item.unidades, 0);
    let unitPrice = toNumber(item.precio || item.unitPrice || item.price || item.precioUnitario || item.precio_unitario || item.unit_price || item.priceUnit, 0);
    let lineRevenue = toNumber(item.subtotal || item.lineTotal || item.total || item.totalPrice || item.precioTotal || item.precio_total, 0);
    if (lineRevenue === 0 && unitPrice > 0) lineRevenue = roundMoney(unitPrice * qty);
    total += lineRevenue;
  }
  return roundMoney(total);
}

// Naive financial projection based on recent sales trend
async function buildFinancialProjection({ months = 6, forecastMonths = 6, model = 'linear' } = {}) {
  const now = new Date();
  const orders = await Order.find({}).lean();
  let start = new Date(now);

  if (orders.length) {
    let earliest = null;
    for (const order of orders) {
      const orderDate = new Date(order.fecha || order.createdAt || 0);
      if (!orderDate || Number.isNaN(orderDate.getTime())) continue;
      if (!earliest || orderDate < earliest) earliest = orderDate;
    }
    if (earliest) {
      start = new Date(earliest);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    } else {
      start.setMonth(now.getMonth() - months);
    }
  } else {
    start.setMonth(now.getMonth() - months);
  }
  const monthMap = new Map();

  for (const order of orders) {
    const orderDate = new Date(order.fecha || order.createdAt || 0);
    if (!orderDate || Number.isNaN(orderDate.getTime())) continue;
    if (orderDate < start) continue;

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
      orderTotal = computeOrderTotalFromItems(items);
    }

    const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
    const existing = monthMap.get(monthKey) || { month: monthKey, total: 0, orders: 0 };
    existing.total += orderTotal;
    existing.orders += 1;
    monthMap.set(monthKey, existing);
  }

  const series = Array.from(monthMap.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(r => ({
      month: r.month,
      total: roundMoney(r.total),
      orders: r.orders,
      avgOrderValue: r.orders ? roundMoney(r.total / r.orders) : 0
    }));

  if (series.length === 0) {
    return { generatedAt: now, months, forecastMonths, model, series: [], projectionSales: [], projectionOrders: [] };
  }

  const totalChanges = [];
  const orderChanges = [];
  for (let i = 1; i < series.length; i++) {
    totalChanges.push((series[i].total || 0) - (series[i - 1].total || 0));
    orderChanges.push((series[i].orders || 0) - (series[i - 1].orders || 0));
  }

  const avgChange = totalChanges.length ? (totalChanges.reduce((s, v) => s + v, 0) / totalChanges.length) : 0;
  const avgOrderChange = orderChanges.length ? (orderChanges.reduce((s, v) => s + v, 0) / orderChanges.length) : 0;
  const positiveChange = Math.max(0, avgChange);
  const positiveOrderChange = Math.max(0, avgOrderChange);
  const avgTotal = series.reduce((s, v) => s + (v.total || 0), 0) / series.length;
  const avgOrders = series.reduce((s, v) => s + (v.orders || 0), 0) / series.length;

  const projectionSales = [];
  const projectionOrders = [];
  const projectionAvgOrderValue = [];

  const lastTotal = series[series.length - 1].total || 0;
  const lastOrders = series[series.length - 1].orders || 0;

  for (let i = 1; i <= forecastMonths; i++) {
    const month = new Date(now);
    month.setMonth(now.getMonth() + i);
    const monthStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;

    const projectedTotal = model === 'average'
      ? Math.max(0, roundMoney(avgTotal))
      : Math.max(0, roundMoney(lastTotal + positiveChange * i));
    const projectedOrders = model === 'average'
      ? Math.max(0, Math.round(avgOrders))
      : Math.max(0, Math.round(lastOrders + positiveOrderChange * i));

    projectionSales.push({ month: monthStr, projectedTotal });
    projectionOrders.push({ month: monthStr, projectedOrders });
    projectionAvgOrderValue.push({ month: monthStr, projectedAvgOrderValue: projectedOrders ? roundMoney(projectedTotal / projectedOrders) : 0 });
  }

  return {
    generatedAt: now,
    months,
    forecastMonths,
    model,
    series,
    projectionSales,
    projectionOrders,
    projectionAvgOrderValue,
    avgChange: roundMoney(avgChange),
    avgOrderChange: roundMoney(avgOrderChange),
    lastMonth: {
      total: roundMoney(lastTotal),
      orders: lastOrders,
      avgOrderValue: lastOrders ? roundMoney(lastTotal / lastOrders) : 0
    }
  };
}

// Create a projection
router.post('/', authMiddleware, async (req, res) => {
  try {
    const body = req.body || {};
    const months = toNumber(body.months, 6);
    const forecastMonths = toNumber(body.forecastMonths, 6);
    const model = body.model || 'linear';
    const name = String(body.name || `projection-${Date.now()}`);

    const data = await buildFinancialProjection({ months, forecastMonths, model });

    const save = body.save !== false && body.save !== 'false';
    const p = new Projection({ name, type: 'financial', payload: data, createdBy: req.user?.email || '', language: 'en' });
    if (save) await p.save();

    res.json({ success: true, projection: data, saved: save ? p : null });
  } catch (err) {
    console.error('Error building projection:', err);
    res.status(500).json({ error: err.message || 'Projection generation failed' });
  }
});

// List saved projections
router.get('/', authMiddleware, async (req, res) => {
  try {
    const list = await Projection.find({}).sort({ createdAt: -1 }).lean();
    res.json({ success: true, projections: list });
  } catch (err) {
    console.error('Error listing projections:', err);
    res.status(500).json({ error: err.message || 'Could not list projections' });
  }
});

// Get single projection
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const p = await Projection.findById(req.params.id).lean();
    if (!p) return res.status(404).json({ error: 'Projection not found' });
    res.json({ success: true, projection: p });
  } catch (err) {
    console.error('Error getting projection:', err);
    res.status(500).json({ error: err.message || 'Could not get projection' });
  }
});

// Delete projection
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const p = await Projection.findByIdAndDelete(req.params.id);
    if (!p) return res.status(404).json({ error: 'Projection not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting projection:', err);
    res.status(500).json({ error: err.message || 'Could not delete projection' });
  }
});

module.exports = router;