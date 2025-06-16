const mongoose = require('mongoose');
const { Schema } = mongoose;

const itemSchema = new Schema({
  accessToken: { type: String, required: true },
  itemId: { type: String, required: true },
  institutionName: { type: String, required: true },
});

const plaidTokenSchema = new Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items: [itemSchema],
});

const PlaidToken = mongoose.model('PlaidToken', plaidTokenSchema);

module.exports = PlaidToken;
