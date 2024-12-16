const express = require('express');
const router = express.Router();
const Reservation = require('../models/Reservation');
const ExcelJS = require('exceljs');

const validDate = (date) => date instanceof Date && !isNaN(date.getTime());


// 월별 현황
router.get('/monthly', async (req, res) => {
  const currentMonth = parseInt(req.query.month, 10) || new Date().getMonth() + 1;

  if (isNaN(currentMonth) || currentMonth < 1 || currentMonth > 12) {
    return res.status(400).send('Invalid month parameter');
  }

  try {
    const startDate = new Date(Date.UTC(2024, currentMonth - 1, 1));
    const endDate = new Date(Date.UTC(2024, currentMonth, 1));

    const reservations = await Reservation.find({
      $or: [
        { departureDate: { $gte: startDate, $lt: endDate } },
        { arrivalDate: { $gte: startDate, $lt: endDate } },
      ],
    }).populate('ship');

    const dateMap = reservations.reduce((map, reservation) => {
      const addToMap = (key, type, seats) => {
        if (!map[key]) {
          map[key] = { date: key, departure: {}, arrival: {} };
        }
        map[key][type] = {
          economy: (map[key][type]?.economy || 0) + (seats.economySeats || 0),
          business: (map[key][type]?.business || 0) + (seats.businessSeats || 0),
          first: (map[key][type]?.first || 0) + (seats.firstSeats || 0),
        };
      };

      if (reservation.departureDate) {
        const date = reservation.departureDate.toISOString().split('T')[0];
        addToMap(date, 'departure', reservation);
      }

      if (reservation.arrivalDate) {
        const date = reservation.arrivalDate.toISOString().split('T')[0];
        addToMap(date, 'arrival', reservation);
      }

      return map;
    }, {});

    const data = Object.values(dateMap).sort((a, b) => new Date(a.date) - new Date(b.date));

    res.render('monthly-status', { data, currentMonth });
  } catch (error) {
    console.error('Error fetching monthly status:', error.message);
    res.status(500).send('Error fetching data: ' + error.message);
  }
});

const { ObjectId } = require('mongoose').Types;

router.post('/monthly/update-block', async (req, res) => {
  const { updates } = req.body;

  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ success: false, message: 'Invalid or empty updates array.' });
  }

  try {
    const updatedBlocks = [];

    for (const update of updates) {
      const { reservationId, date, departure = {}, arrival = {} } = update;

      // 유효성 검증
      if (!reservationId || !date) {
        console.warn('Skipping update due to missing reservationId or date:', update);
        continue;
      }

      const sanitizedDeparture = {
        ecoBlock: Number(departure.ecoBlock) || 0,
        bizBlock: Number(departure.bizBlock) || 0,
        firstBlock: Number(departure.firstBlock) || 0,
      };

      const sanitizedArrival = {
        ecoBlock: Number(arrival.ecoBlock) || 0,
        bizBlock: Number(arrival.bizBlock) || 0,
        firstBlock: Number(arrival.firstBlock) || 0,
      };

      console.log(`Processing update for Reservation ID: ${reservationId}, Date: ${date}`);

      // 먼저 dailyBlock이 존재하는지 확인
      const reservation = await Reservation.findById(reservationId);
      if (!reservation) {
        console.warn(`Reservation not found for ID: ${reservationId}`);
        continue;
      }

      const blockIndex = reservation.dailyBlocks.findIndex(
        (block) => block.date.toISOString().split('T')[0] === new Date(date).toISOString().split('T')[0]
      );

      if (blockIndex > -1) {
        // 기존 블록 업데이트
        reservation.dailyBlocks[blockIndex].departure = sanitizedDeparture;
        reservation.dailyBlocks[blockIndex].arrival = sanitizedArrival;
        console.log(`Updated existing block for date: ${date}`);
      } else {
        // 새로운 블록 추가
        reservation.dailyBlocks.push({
          date: new Date(date),
          departure: sanitizedDeparture,
          arrival: sanitizedArrival,
        });
        console.log(`Added new block for date: ${date}`);
      }

      await reservation.save();
      updatedBlocks.push({ reservationId, date, departure: sanitizedDeparture, arrival: sanitizedArrival });
    }

    res.json({ success: true, message: 'Block data updated successfully', updatedBlocks });
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
    const startDate = new Date(Date.UTC(2025, currentMonth - 1, 1));
    const endDate = new Date(Date.UTC(2025, currentMonth, 1));

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
          remainingEconomySeats: reservation.totalSeats - reservation.economySeats,
          remainingBusinessSeats: reservation.totalSeats - reservation.businessSeats,
          remainingFirstSeats: reservation.totalSeats - reservation.firstSeats,
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
