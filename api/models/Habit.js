import mongoose from 'mongoose';

const habitSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // Keeping the frontend generated ID
  name: { type: String, required: true },
  completed: { type: Boolean, default: false },
  category: { type: String, required: true },
  priority: { type: String, required: true },
  createdAt: { type: String, required: true },
  history: [{ type: String }], // Array of date strings "YYYY-MM-DD"
  order: { type: Number, default: 0 }
});

export default mongoose.model('Habit', habitSchema);
