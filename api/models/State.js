const mongoose = require('mongoose');

const stateSchema = new mongoose.Schema({
  currentStreak: { type: Number, default: 0 },
  bestStreak: { type: Number, default: 0 },
  lastDay: { type: String, default: "" }
});

module.exports = mongoose.model('State', stateSchema);
