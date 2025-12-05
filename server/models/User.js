const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  publicId: { type: String, trim: true, unique: true, sparse: true },
  isAdmin: { type: Boolean, default: false },
  apellido: { type: String },
  email: { type: String, required: true, unique: true },
  // Email verification fields
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  emailVerificationExpires: { type: Date },
  passwordHash: { type: String, required: true },
  cedula: { type: String },
  telefono: { type: String },
  photo: { type: String },
  fechaRegistro: { type: Date, default: Date.now },
  cart: { type: Array, default: [] },
  orders: { type: Array, default: [] }
});

userSchema.virtual('id').get(function() {
  return this.publicId || (this._id ? this._id.toString() : undefined);
});

userSchema.set('toJSON', {
  virtuals: true,
  versionKey: false
});

userSchema.set('toObject', {
  virtuals: true
});

module.exports = mongoose.model('User', userSchema);
