const mongoose = require('mongoose');

const projectionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, default: 'financial' },
  payload: { type: Object },
  createdBy: { type: String },
  language: { type: String, default: 'en' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Projection', projectionSchema);