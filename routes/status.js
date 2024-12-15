const express = require('express');
const router = express.Router();
const Reservation = require('../models/Reservation');
const ExcelJS = require('exceljs');
const Ship = require('../models/Ship');

// 월별 현황
router.get('/monthly', async (req, res) => {
    const { month } = req.query; // reservedBy 제거
    const currentMonth = parseInt(month, 10) || new Date().getMonth() + 1;
  
    try {
      const startDate = new Date(`2024-${currentMonth}-01`);
      const endDate = new Date(`2024-${currentMonth}-31`);
  
      const filter = {
        $or: [
          { departureDate: { $gte: startDate, $lt: endDate } },
          { arrivalDate: { $gte: startDate, $lt: endDate } },
        ],
      };
  
      // 예약 데이터 가져오기
      const reservations = await Reservation.find(filter).populate('ship');
  
      // 데이터 처리
      const data = [];
      const dateMap = new Map();
  
      reservations.forEach((reservation) => {
        const departureDate = reservation.departureDate?.toISOString().split('T')[0];
        const arrivalDate = reservation.arrivalDate?.toISOString().split('T')[0];
  
        if (departureDate) {
          if (!dateMap.has(departureDate)) {
            dateMap.set(departureDate, { date: departureDate, departure: {}, arrival: {} });
          }
          const record = dateMap.get(departureDate);
          record.departure = {
            economy: (record.departure.economy || 0) + reservation.economySeats,
            business: (record.departure.business || 0) + reservation.businessSeats,
            first: (record.departure.first || 0) + reservation.firstSeats,
            ecoBlock: reservation.ship?.eco || 0,
            bizBlock: reservation.ship?.biz || 0,
            firstBlock: reservation.ship?.first || 0,
          };
        }
  
        if (arrivalDate) {
          if (!dateMap.has(arrivalDate)) {
            dateMap.set(arrivalDate, { date: arrivalDate, departure: {}, arrival: {} });
          }
          const record = dateMap.get(arrivalDate);
          record.arrival = {
            economy: (record.arrival.economy || 0) + reservation.economySeats,
            business: (record.arrival.business || 0) + reservation.businessSeats,
            first: (record.arrival.first || 0) + reservation.firstSeats,
            ecoBlock: reservation.ship?.eco || 0,
            bizBlock: reservation.ship?.biz || 0,
            firstBlock: reservation.ship?.first || 0,
          };
        }
      });
  
      data.push(...Array.from(dateMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date)));

  
      res.render('monthly-status', {
        data,
        currentMonth, // reservedBy 제거
      });
    } catch (error) {
      console.error('Error fetching monthly status:', error.message);
      res.status(400).send(error.message);
    }
  });
  
router.post('/update-block', async (req, res) => {
    const { date, type, key, value } = req.body;
  
    try {
      const updateField = `${type}.${key}`;
      await Reservation.updateMany(
        { $or: [{ departureDate: date }, { arrivalDate: date }] },
        { $set: { [updateField]: value } }
      );
  
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating block value:', error);
      res.status(500).json({ success: false, message: 'Update failed' });
    }
});


// 블럭 수 업데이트
router.post('/monthly/update-block', async (req, res) => {
  const { updates } = req.body;

  try {
    for (const update of updates) {
      const reservation = await Reservation.findById(update._id);
      if (reservation) {
        Object.assign(reservation, update); // 업데이트 데이터 병합
        await reservation.save();
      }
    }
    res.json({ success: true, message: 'Block data updated successfully' });
  } catch (error) {
    console.error('Error updating block data:', error);
    res.status(500).json({ success: false, message: 'Error updating block data' });
  }
});

  
// 엑셀 다운로드
router.get('/monthly/export', async (req, res) => {
  const { month } = req.query;
  const currentMonth = parseInt(month, 10) || new Date().getMonth() + 1;

  try {
    const startDate = new Date(`2024-${currentMonth}-01`);
    const endDate = new Date(`2024-${currentMonth + 1}-01`);

    const reservations = await Reservation.find({
      $or: [
        { departureDate: { $gte: startDate, $lt: endDate } },
        { arrivalDate: { $gte: startDate, $lt: endDate } },
      ],
    }).populate('ship');

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Monthly Status');

    sheet.columns = [
      { header: '날짜', key: 'date', width: 15 },
      { header: '예약 이코', key: 'economySeats', width: 10 },
      { header: '예약 비즈', key: 'businessSeats', width: 10 },
      { header: '예약 퍼스', key: 'firstSeats', width: 10 },
      { header: '블럭 이코', key: 'ecoBlock', width: 10 },
      { header: '블럭 비즈', key: 'bizBlock', width: 10 },
      { header: '블럭 퍼스', key: 'firstBlock', width: 10 },
      { header: '잔여 이코', key: 'remainingEconomySeats', width: 10 },
      { header: '잔여 비즈', key: 'remainingBusinessSeats', width: 10 },
      { header: '잔여 퍼스', key: 'remainingFirstSeats', width: 10 },
    ];

    reservations.forEach((reservation) => {
      const departureDate = reservation.departureDate?.toISOString().split('T')[0];
      if (departureDate) {
        rows.push({
          date: departureDate,
          economySeats: reservation.economySeats || 0,
          businessSeats: reservation.businessSeats || 0,
          firstSeats: reservation.firstSeats || 0,
          ecoBlock: reservation.ship?.eco || 0,
          bizBlock: reservation.ship?.biz || 0,
          firstBlock: reservation.ship?.first || 0,
          remainingEconomySeats: (reservation.ship?.eco || 0) - (reservation.economySeats || 0),
          remainingBusinessSeats: (reservation.ship?.biz || 0) - (reservation.businessSeats || 0),
          remainingFirstSeats: (reservation.ship?.first || 0) - (reservation.firstSeats || 0),
        });
      }
    });
    rows.sort((a, b) => new Date(a.date) - new Date(b.date)); // 추가된 정렬

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="monthly_status.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting monthly status:', error);
    res.status(500).send('Error exporting monthly status.');
  }
});

module.exports = router;
