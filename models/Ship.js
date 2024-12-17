const mongoose = require('mongoose');


const ShipSchema = new mongoose.Schema({
  name: { type: String, required: false, unique: true },
});

module.exports = mongoose.model('Ship', ShipSchema);