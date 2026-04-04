const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    index: true
  },
  smsId: {
    type: String,
    required: true
  },
  amount: {
    type: String,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  merchant: {
    type: String,
    required: true
  },
  date: {
    type: String
  },
  type: {
    type: String,
    enum: ['credit', 'debit'],
    required: true
  },
  account: {
    type: String // We will store the redacted account string (e.g. ****1234)
  },
  bank: {
    type: String
  },
  rawMsgLength: {
    type: Number // Storing the length instead of full text for PII preservation
  }
}, { timestamps: true });

// Prevent duplicate processing of the same SMS on the same device
transactionSchema.index({ deviceId: 1, smsId: 1 }, { unique: true });

module.exports = mongoose.model('Transaction', transactionSchema);
