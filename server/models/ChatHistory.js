const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'model'],
    required: true
  },
  text: {
    type: String,
    required: true
  }
});

const chatHistorySchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    index: true,
    unique: true
  },
  messages: [messageSchema]
}, { timestamps: true });

module.exports = mongoose.model('ChatHistory', chatHistorySchema);
