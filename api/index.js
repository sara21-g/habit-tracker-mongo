require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Habit = require('./models/Habit');
const State = require('./models/State');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// MongoDB Connection
if (!process.env.MONGODB_URI) {
  console.warn('WARNING: MONGODB_URI is not defined in environment variables.');
}

mongoose.connect(process.env.MONGODB_URI || '')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('CRITICAL: Could not connect to MongoDB.');
    console.error('Error Details:', err.message);
  });

// Getting composite state (Habits + App State)
app.get('/api/state', async (req, res) => {
  try {
    const habits = await Habit.find().sort('order');
    let state = await State.findOne();
    if (!state) {
      state = await State.create({ currentStreak: 0, bestStreak: 0, lastDay: new Date().toISOString().split('T')[0] });
    }
    res.json({ habits, state });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update streaks and lastDay
app.post('/api/state', async (req, res) => {
  try {
    const { currentStreak, bestStreak, lastDay } = req.body;
    let state = await State.findOne();
    if (!state) {
      state = new State();
    }
    if (currentStreak !== undefined) state.currentStreak = currentStreak;
    if (bestStreak !== undefined) state.bestStreak = bestStreak;
    if (lastDay !== undefined) state.lastDay = lastDay;
    await state.save();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Habit
app.post('/api/habits', async (req, res) => {
    try {
        const habit = new Habit(req.body);
        await habit.save();
        res.status(201).json(habit);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Update Habit (toggle complete, history, etc)
app.put('/api/habits/:id', async (req, res) => {
    try {
        const habit = await Habit.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
        if (!habit) return res.status(404).json({ error: 'Habit not found' });
        res.json(habit);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Delete Habit
app.delete('/api/habits/:id', async (req, res) => {
    try {
        const habit = await Habit.findOneAndDelete({ id: req.params.id });
        if (!habit) return res.status(404).json({ error: 'Habit not found' });
        res.json({ message: 'Habit deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reorder Habits
app.put('/api/habits/reorder', async (req, res) => {
    try {
        const { habitIds } = req.body; // Array of IDs in the new order
        const bulkOps = habitIds.map((id, index) => ({
            updateOne: {
                filter: { id: id },
                update: { order: index },
            }
        }));
        await Habit.bulkWrite(bulkOps);
        res.json({ message: 'Reordered successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
