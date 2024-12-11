const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema(
  {
    // 기본정보
    ship: { type: mongoose.Schema.Types.ObjectId, ref: 'Ship', required: true },
    listStatus: { 
        type: String, 
        default: '', 
        trim: true 
    },
    contractDate: { type: Date, required: true, default: Date.now },
    departureDate: {
      type: Date,
      required: [true, 'departureDate is required'],
    },
    
    arrivalDate: { type: Date, required: true, default: Date.now },
    reservedBy: { type: String, required: true, default: 'Unknown' },
    reservedBy2: { type: String, default: '' },
    contact: { type: String, required: true, default: 'Unknown' },
    product: { type: String, default: '' },

    // 포항-울릉 좌석 정보
    totalSeats: { type: Number, default: 0 },
    economySeats: { type: Number, default: 0 },
    businessSeats: { type: Number, default: 0 },
    firstSeats: { type: Number, default: 0 },

    // 독도관광
    dokdoTourDate: { type: Date },
    dokdoTourPeople: { type: Number, default: 0 },
    dokdoTourTime: { type: String, default: '' },
    dokdoTourDetails: { type: String, default: '' },

    // 금액관리
    totalPrice: { type: Number, required: true, default: 0 },
    deposit: { type: Number, required: true, default: 0 },
    balance: {
      type: Number,
      default: function () {
        return this.totalPrice - this.deposit;
      },
    },

    // 예약관리
    rentalCar: { type: String, default: '' },
    accommodation: { type: String, default: '' },
    others: { type: String, default: '' },

    // 정산관리
    departureFee: { type: Number, default: 0 },
    arrivalFee: { type: Number, default: 0 },
    dokdoFee: { type: Number, default: 0 },
    restaurantFee: { type: Number, default: 0 },
    eventFee: { type: Number, default: 0 },
    otherFee: { type: Number, default: 0 },
    refund: { type: Number, default: 0 },
    totalSettlement: {
      type: Number,
      default: function () {
        return (
          this.departureFee +
          this.arrivalFee +
          this.dokdoFee +
          this.restaurantFee +
          this.eventFee +
          this.otherFee -
          this.refund
        );
      },
    },
    profit: {
      type: Number,
      default: function () {
        return this.totalPrice - this.totalSettlement;
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Reservation', reservationSchema);
