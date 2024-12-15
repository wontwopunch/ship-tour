const express = require('express');
const router = express.Router();
const Reservation = require('../models/Reservation');
const ExcelJS = require('exceljs');

const validDate = (date) => {
  return date instanceof Date && !isNaN(date.getTime());
};


// 월별 현황
router.get('/monthly', async (req, res) => {
  const { month } = req.query;
  const currentMonth = parseInt(month, 10) || new Date().getMonth() + 1;

  try {
    const startDate = new Date(`2024-${currentMonth}-01`);
    const endDate = new Date(`2024-${currentMonth + 1}-01`);

    if (!validDate(startDate) || !validDate(endDate)) {
      throw new Error('Invalid date range');
    }

    const reservations = await Reservation.find({
      $or: [
        { departureDate: { $gte: startDate, $lt: endDate } },
        { arrivalDate: { $gte: startDate, $lt: endDate } },
      ],
    }).populate('ship');

    const dateMap = new Map();
    reservations.forEach((reservation) => {
      const addData = (date, type) => {
        if (!date) return;
        if (!dateMap.has(date)) dateMap.set(date, { date, departure: {}, arrival: {} });
        const record = dateMap.get(date);
        record[type] = {
          economy: (record[type]?.economy || 0) + (reservation.economySeats || 0),
          business: (record[type]?.business || 0) + (reservation.businessSeats || 0),
          first: (record[type]?.first || 0) + (reservation.firstSeats || 0),
          ecoBlock: reservation.ship?.eco || 0,
          bizBlock: reservation.ship?.biz || 0,
          firstBlock: reservation.ship?.first || 0,
        };
      };

      addData(validDate(reservation.departureDate) ? reservation.departureDate.toISOString().split('T')[0] : null, 'departure');
      addData(validDate(reservation.arrivalDate) ? reservation.arrivalDate.toISOString().split('T')[0] : null, 'arrival');
    });

    const data = Array.from(dateMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date));

    res.render('monthly-status', { data, currentMonth });
  } catch (error) {
    console.error('Error fetching monthly status:', error.message);
    res.status(400).send('Error fetching data: ' + error.message);
  }
});


// 블록 업데이트
router.post('/monthly/update-block', async (req, res) => {
  const { updates } = req.body;

  if (!Array.isArray(updates)) {
    return res.status(400).json({ success: false, message: 'Invalid input data' });
  }

  try {
    for (const update of updates) {
      const { date, departure, arrival } = update;

      if (!date) {
        console.warn('Skipping update due to missing date:', update);
        continue;
      }

      const reservation = await Reservation.findOne({
        $or: [{ departureDate: date }, { arrivalDate: date }],
      });

      if (!reservation) {
        console.warn(`No reservation found for date: ${date}`);
        continue;
      }

      if (!reservation.dailyBlocks) {
        reservation.dailyBlocks = [];
      }

      const existingBlock = reservation.dailyBlocks.find(
        (block) => block.date.toISOString().split('T')[0] === date
      );

      if (existingBlock) {
        if (departure) {
          existingBlock.departure.ecoBlock = departure.ecoBlock || 0;
          existingBlock.departure.bizBlock = departure.bizBlock || 0;
          existingBlock.departure.firstBlock = departure.firstBlock || 0;
        }
        if (arrival) {
          existingBlock.arrival.ecoBlock = arrival.ecoBlock || 0;
          existingBlock.arrival.bizBlock = arrival.bizBlock || 0;
          existingBlock.arrival.firstBlock = arrival.firstBlock || 0;
        }
      } else {
        reservation.dailyBlocks.push({
          date,
          departure: {
            ecoBlock: departure?.ecoBlock || 0,
            bizBlock: departure?.bizBlock || 0,
            firstBlock: departure?.firstBlock || 0,
          },
          arrival: {
            ecoBlock: arrival?.ecoBlock || 0,
            bizBlock: arrival?.bizBlock || 0,
            firstBlock: arrival?.firstBlock || 0,
          },
        });
      }

      await reservation.save();
    }

    res.json({ success: true, message: 'Block data updated successfully' });
  } catch (error) {
    console.error('Error updating block data:', error.message);
    res.status(500).json({ success: false, message: 'Error updating data: ' + error.message });
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
        sheet.addRow({
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

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="monthly_status.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting monthly status:', error.message);
    res.status(500).send('Error exporting data: ' + error.message);
  }
});

module.exports = router;
