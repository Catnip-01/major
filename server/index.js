require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Internal Modules
const routes = require('./routes');
require('./worker'); // Start the BullMQ worker


const app = express();
const PORT = process.env.PORT || 3000;

// 1. Request Logger (MOVE TO TOP)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} (Origin: ${req.get('Origin') || 'No Origin'})`);
  if (req.method === 'OPTIONS') {
    console.log(`[${new Date().toISOString()}] Preflight OPTIONS detected for ${req.url}`);
  }
  next();
});

// 2. Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/palfin', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// Routes
app.use('/api', routes);

// Basic Route
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Palfin Backend running' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
