import mongoose from 'mongoose';

const stateSchema = new mongoose.Schema({
  currentStreak: { type: Number, default: 0 },
  bestStreak: { type: Number, default: 0 },
  lastDay: { type: String, default: "" }
});

export default mongoose.model('State', stateSchema);
