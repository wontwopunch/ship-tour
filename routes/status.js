const express = require('express');
const router = express.Router();
const Reservation = require('../models/Reservation');
const Ship = require('../models/Ship');
const ExcelJS = require('exceljs');

// Helper function to validate dates
const isValidDate = (date) => date instanceof Date && !isNaN(date.getTime());

// 월별 좌석 현황
router.get('/monthly', async (req, res) => {
  const { month } = req.query;
  const currentMonth = parseInt(month, 10) || new Date().getMonth() + 1;

  try {
    const startDate = new Date(`2024-${String(currentMonth).padStart(2, '0')}-01`);
    const endDate = new Date(`2024-${String(currentMonth).padStart(2, '0')}-01`);
    endDate.setMonth(endDate.getMonth() + 1); // 다음 달 첫날로 설정

    const reservations = await Reservation.find({
      $or: [
        { departureDate: { $gte: startDate, $lt: endDate } },
        { arrivalDate: { $gte: startDate, $lt: endDate } },
      ],
    }).populate('ship');

    const dateMap = reservations.reduce((map, reservation) => {
      const addToMap = (key, type, seats) => {
        if (!map[key]) {
          map[key] = {
            date: key,
            shipName: reservation.ship?.name || '미지정',
            departure: {},
            arrival: {},
          };
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

// 블록 데이터 업데이트
router.post('/monthly/update-block', async (req, res) => {
  const { updates } = req.body;

  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ success: false, message: 'Invalid input data' });
  }

  try {
    const updatedBlocks = [];

    for (const update of updates) {
      const { reservationId, date, departure = {}, arrival = {}, ship } = update;

      if (!date || !ship) {
        console.warn('Skipping update due to missing date or ship:', update);
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

      if (reservationId) {
        const reservation = await Reservation.findById(reservationId);
        if (!reservation) {
          console.warn(`Reservation not found for ID: ${reservationId}`);
          continue;
        }

        const blockIndex = reservation.dailyBlocks.findIndex(
          (block) => block.date.toISOString().split('T')[0] === new Date(date).toISOString().split('T')[0]
        );

        if (blockIndex > -1) {
          reservation.dailyBlocks[blockIndex].departure = sanitizedDeparture;
          reservation.dailyBlocks[blockIndex].arrival = sanitizedArrival;
        } else {
          reservation.dailyBlocks.push({
            date: new Date(date),
            departure: sanitizedDeparture,
            arrival: sanitizedArrival,
          });
        }

        await reservation.save();
        updatedBlocks.push({ reservationId, date, departure: sanitizedDeparture, arrival: sanitizedArrival });
      } else {
        const newReservation = new Reservation({
          ship,
          dailyBlocks: [
            {
              date: new Date(date),
              departure: sanitizedDeparture,
              arrival: sanitizedArrival,
            },
          ],
        });

        await newReservation.save();
        updatedBlocks.push({
          reservationId: newReservation._id,
          date,
          departure: sanitizedDeparture,
          arrival: sanitizedArrival,
        });
      }
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
    const startDate = new Date(`2024-${String(currentMonth).padStart(2, '0')}-01`);
    const endDate = new Date(`2024-${String(currentMonth).padStart(2, '0')}-01`);
    endDate.setMonth(endDate.getMonth() + 1); // 다음 달 첫날

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
      { header: '선박명', key: 'shipName', width: 15 },
      { header: '예약 이코', key: 'economySeats', width: 10 },
      { header: '예약 비즈', key: 'businessSeats', width: 10 },
      { header: '예약 퍼스', key: 'firstSeats', width: 10 },
      { header: '블럭 이코', key: 'ecoBlock', width: 10 },
      { header: '블럭 비즈', key: 'bizBlock', width: 10 },
      { header: '블럭 퍼스', key: 'firstBlock', width: 10 },
      { header: '잔여 이코', key: 'remainingEco', width: 10 },
      { header: '잔여 비즈', key: 'remainingBiz', width: 10 },
      { header: '잔여 퍼스', key: 'remainingFirst', width: 10 },
    ];

    reservations.forEach((reservation) => {
      const departureDate = reservation.departureDate?.toISOString().split('T')[0];
      const shipName = reservation.ship?.name || '미지정';
      if (departureDate) {
        sheet.addRow({
          date: departureDate,
          shipName,
          economySeats: reservation.economySeats || 0,
          businessSeats: reservation.businessSeats || 0,
          firstSeats: reservation.firstSeats || 0,
          ecoBlock: reservation.ecoBlock || 0,
          bizBlock: reservation.bizBlock || 0,
          firstBlock: reservation.firstBlock || 0,
          remainingEco: (reservation.ecoBlock || 0) - (reservation.economySeats || 0),
          remainingBiz: (reservation.bizBlock || 0) - (reservation.businessSeats || 0),
          remainingFirst: (reservation.firstBlock || 0) - (reservation.firstSeats || 0),
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
