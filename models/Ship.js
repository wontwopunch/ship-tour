const ShipSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
});
