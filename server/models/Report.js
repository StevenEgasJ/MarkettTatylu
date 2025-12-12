const mongoose = require('mongoose');
const Sequence = require('./Sequence');

const topProductSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  nombre: { type: String },
  cantidadVendida: { type: Number, default: 0 },
  ingresos: { type: Number, default: 0 }
}, { _id: false });

const reportSchema = new mongoose.Schema({
  // Sequential human-friendly id
  id: { type: String, trim: true, unique: true, sparse: true },
  // Period type: 'daily', 'weekly', 'monthly', 'yearly' or 'snapshot'
  tipo: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly', 'snapshot'], default: 'snapshot' },
  // Period start/end for aggregated reports
  periodoInicio: { type: Date },
  periodoFin: { type: Date },
  // When this report was generated
  generadoEn: { type: Date, default: Date.now },
  // Totals
  totalVentas: { type: Number, default: 0 },          // total revenue
  totalOrdenes: { type: Number, default: 0 },         // order count
  totalProductosVendidos: { type: Number, default: 0 }, // units sold
  // Breakdowns
  ventasHoy: { type: Number, default: 0 },
  ventasSemana: { type: Number, default: 0 },
  ventasMes: { type: Number, default: 0 },
  ordenesHoy: { type: Number, default: 0 },
  ordenesSemana: { type: Number, default: 0 },
  ordenesMes: { type: Number, default: 0 },
  // Top products
  topProductos: { type: [topProductSchema], default: [] },
  // Optional: category breakdown
  ventasPorCategoria: { type: Object, default: {} },
  // Metadata
  notas: { type: String, default: '' }
});

async function getNextReportId() {
  const updated = await Sequence.findOneAndUpdate(
    { name: 'report-id' },
    { $inc: { value: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return updated.value;
}

reportSchema.pre('save', async function(next) {
  if (!this.isNew || this.id) return next();
  try {
    const nextId = await getNextReportId();
    this.id = String(nextId);
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Report', reportSchema);
