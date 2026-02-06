const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  name: { type: String, default: 'report' },
  type: { type: String },
  payload: { type: Object },
  createdBy: { type: String },
  language: { type: String, default: 'en' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Report', reportSchema);