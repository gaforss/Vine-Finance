// models/resetToken.js
const mongoose = require('mongoose');

const resetTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  token: {
    type: String,
    required: true,
  },
  expirationDate: {
    type: Date,
    default: () => Date.now() + 3600000, // Token expires in 1 hour
  },
});

resetTokenSchema.statics.clearExpiredTokens = async function() {
  try {
    await this.deleteMany({ expirationDate: { $lt: new Date() } });
  } catch (error) {
    throw new Error(error);
  }
};

const ResetToken = mongoose.model('ResetToken', resetTokenSchema);

module.exports = ResetToken;