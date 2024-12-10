const mongoose = require('mongoose');

const ShipSchema = new mongoose.Schema({
  name: String,
  eco: Number,
  biz: Number,
  first: Number,
  total: Number,
});

module.exports = mongoose.model('Ship', ShipSchema);
