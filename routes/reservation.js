const express = require('express');
const router = express.Router();
const Reservation = require('../models/Reservation');
const Ship = require('../models/Ship');
const ExcelJS = require('exceljs');

// Helper function to validate dates
function isValidDate(d) {
  return d instanceof Date && !isNaN(d);
}


// 월별 예약 데이터 조회
router.get('/monthly', async (req, res) => {
  const { month } = req.query;
  const currentMonth = parseInt(month, 10) || new Date().getMonth() + 1;

  try {
    const startDate = new Date(`2024-${currentMonth}-01`);
    const endDate = new Date(`2024-${currentMonth}-31`);

    const [reservations, ships] = await Promise.all([
      Reservation.find({ departureDate: { $gte: startDate, $lt: endDate } })
        .populate({
          path: 'ship',
          select: '_id name', // 필요한 필드만 가져오기
        })
        .sort({ departureDate: 1, arrivalDate: 1 }),
      Ship.find(),
    ]);

    console.log('Reservations fetched:', reservations);
    console.log('Ships fetched:', ships);

    // reservations와 ships가 비어있는 경우를 대비
    res.render('monthly-reservations', {
      reservations: reservations.length > 0
        ? reservations.map((reservation) => ({
            ...reservation.toObject(),
            ship: reservation.ship || null,
          }))
        : [], // reservations가 없으면 빈 배열 전달
      selectedMonth: currentMonth,
      ships: ships || [], // ships가 없으면 빈 배열 전달
    });
  } catch (error) {
    console.error('Error fetching monthly reservations:', error);
    res.status(500).send('Error fetching reservations.');
  }
});




// 새 예약 데이터 일괄 삽입
router.post('/add-bulk', async (req, res) => {
  try {
    const newReservations = req.body.map((reservation) => {
      const departureDate = new Date(reservation.departureDate);
      const contractDate = new Date(reservation.contractDate);
      const arrivalDate = new Date(reservation.arrivalDate);

      return {
        ...reservation,
        ship: reservation.ship || null,
        contractDate: isValidDate(contractDate) ? contractDate : new Date(),
        departureDate: isValidDate(departureDate) ? departureDate : new Date(),
        arrivalDate: isValidDate(arrivalDate) ? arrivalDate : new Date(),
        reservedBy: reservation.reservedBy || 'Unknown',
        contact: reservation.contact || 'Unknown',
        listStatus: reservation.listStatus || '',
      };
    });

    const savedReservations = await Reservation.insertMany(newReservations, { ordered: false });
    res.json({ success: true, data: savedReservations });
  } catch (error) {
    console.error('Error during bulk addition:', error);
    res.status(500).json({ success: false, message: 'Bulk addition failed.' });
  }
});

// 예약 데이터 일괄 업데이트
router.post('/bulk-update', async (req, res) => {
  try {
    const updates = req.body.map((reservation) => {
      const departureFee = reservation.departureFee || 0;
      const arrivalFee = reservation.arrivalFee || 0;
      const dokdoFee = reservation.dokdoFee || 0;
      const restaurantFee = reservation.restaurantFee || 0;
      const eventFee = reservation.eventFee || 0;
      const otherFee = reservation.otherFee || 0;
      const refund = reservation.refund || 0;

      return {
        ...reservation,
        totalSettlement: departureFee + arrivalFee + dokdoFee + restaurantFee + eventFee + otherFee - refund, // 수정된 계산식
      };
    });

    for (const update of updates) {
      if (update._id) {
        await Reservation.findByIdAndUpdate(update._id, update, { new: true });
      } else {
        await Reservation.create(update);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ success: false });
  }
});

// 예약 데이터 추가
router.post('/add', async (req, res) => {
  const { shipName, contractDate, departureDate, arrivalDate, ...rest } = req.body;

  try {
    const ship = await Ship.findOne({ name: shipName });
    if (!ship) return res.status(404).json({ success: false, message: 'Ship not found' });

    const newReservation = new Reservation({
      ship: ship._id,
      contractDate: isValidDate(new Date(contractDate)) ? new Date(contractDate) : new Date(),
      departureDate: isValidDate(new Date(departureDate)) ? new Date(departureDate) : new Date(),
      arrivalDate: isValidDate(new Date(arrivalDate)) ? new Date(arrivalDate) : new Date(),
      ...rest,
    });

    await newReservation.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding reservation:', error);
    res.status(500).json({ success: false, message: 'Error adding reservation' });
  }
});


// 예약 데이터 수정
router.post('/update/:id', async (req, res) => {
  const { id } = req.params;
  const updatedData = req.body;

  try {
    const reservation = await Reservation.findById(id);
    if (!reservation) return res.status(404).json({ success: false, message: 'Reservation not found' });

    Object.assign(reservation, updatedData); // 데이터 업데이트
    await reservation.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating reservation:', error);
    res.status(500).json({ success: false, message: 'Error updating reservation' });
  }
});

// 예약 데이터 삭제
router.delete('/delete/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const reservation = await Reservation.findByIdAndDelete(id);
    if (!reservation) return res.status(404).json({ success: false, message: 'Reservation not found' });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting reservation:', error);
    res.status(500).json({ success: false, message: 'Error deleting reservation' });
  }
});

// 엑셀 다운로드
router.get('/export', async (req, res) => {
  const { month } = req.query;
  const currentMonth = month || new Date().getMonth() + 1;

  try {
    const startDate = new Date(`2024-${currentMonth}-01`);
    const endDate = new Date(`2024-${currentMonth}-31`);

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      console.error('Invalid date range:', { startDate, endDate });
      return res.status(400).send('Invalid date range');
    }

    const reservations = await Reservation.find({ departureDate: { $gte: startDate, $lt: endDate } })
    .populate('ship') // Ship 정보를 채워줌
    .sort({ departureDate: 1, arrivalDate: 1 });

    // 엑셀 워크북 생성
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Monthly Reservations');

    // 헤더 정의
    sheet.columns = [
      { header: '선박명', key: 'shipName', width: 15 },
      { header: '명단', key: 'listStatus', width: 20 },
      { header: '계약일', key: 'contractDate', width: 15 },
      { header: '출항일', key: 'departureDate', width: 15 },
      { header: '입항일', key: 'arrivalDate', width: 15 },
      { header: '예약자명', key: 'reservedBy', width: 15 },
      { header: '예약자명2', key: 'reservedBy2', width: 15 },
      { header: '연락처', key: 'contact', width: 15 },
      { header: '상품', key: 'product', width: 15 },
      { header: '총 좌석', key: 'totalSeats', width: 10 },
      { header: '이코노미 좌석', key: 'economySeats', width: 10 },
      { header: '비즈니스 좌석', key: 'businessSeats', width: 10 },
      { header: '퍼스트 좌석', key: 'firstSeats', width: 10 },
      { header: '독도 관광 날짜', key: 'dokdoTourDate', width: 15 },
      { header: '독도 관광 인원', key: 'dokdoTourPeople', width: 10 },
      { header: '독도 관광 시간', key: 'dokdoTourTime', width: 10 },
      { header: '상품내용', key: 'dokdoTourDetails', width: 15 },
      { header: '총금액', key: 'totalPrice', width: 10 },
      { header: '계약금', key: 'deposit', width: 10 },
      { header: '잔금', key: 'balance', width: 10 },
      { header: '렌터카', key: 'rentalCar', width: 10 },
      { header: '숙박', key: 'accommodation', width: 10 },
      { header: '기타', key: 'others', width: 10 },
      { header: '출항비', key: 'departureFee', width: 10 },
      { header: '입항비', key: 'arrivalFee', width: 10 },
      { header: '독도비', key: 'dokdoFee', width: 10 },
      { header: '식당비', key: 'restaurantFee', width: 10 },
      { header: '행사비', key: 'eventFee', width: 10 },
      { header: '기타비', key: 'otherFee', width: 10 },
      { header: '환불', key: 'refund', width: 10 },
      { header: '총 정산비', key: 'totalSettlement', width: 10 },
      { header: '수익', key: 'profit', width: 10 },
    ];

    // 데이터 추가
    reservations.forEach((reservation) => {
      sheet.addRow({
        shipName: reservation.ship?.name || 'N/A',
        listStatus: reservation.listStatus || '',
        contractDate: reservation.contractDate?.toISOString().split('T')[0] || '',
        departureDate: reservation.departureDate?.toISOString().split('T')[0] || '',
        arrivalDate: reservation.arrivalDate?.toISOString().split('T')[0] || '',
        reservedBy: reservation.reservedBy || '',
        reservedBy2: reservation.reservedBy2 || '',
        contact: reservation.contact || '',
        product: reservation.product || '',
        totalSeats: reservation.totalSeats || 0,
        economySeats: reservation.economySeats || 0,
        businessSeats: reservation.businessSeats || 0,
        firstSeats: reservation.firstSeats || 0,
        dokdoTourDate: reservation.dokdoTourDate?.toISOString().split('T')[0] || '',
        dokdoTourPeople: reservation.dokdoTourPeople || 0,
        dokdoTourTime: reservation.dokdoTourTime || '',
        dokdoTourDetails: reservation.dokdoTourDetails || '',
        totalPrice: reservation.totalPrice || 0,
        deposit: reservation.deposit || 0,
        balance: reservation.balance || 0,
        rentalCar: reservation.rentalCar || '',
        accommodation: reservation.accommodation || '',
        others: reservation.others || '',
        departureFee: reservation.departureFee || 0,
        arrivalFee: reservation.arrivalFee || 0,
        dokdoFee: reservation.dokdoFee || 0,
        restaurantFee: reservation.restaurantFee || 0,
        eventFee: reservation.eventFee || 0,
        otherFee: reservation.otherFee || 0,
        refund: reservation.refund || 0,
        totalSettlement: reservation.totalSettlement || 0,
        profit: reservation.profit || 0,
      });
    });

    // 엑셀 파일 반환
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="monthly_reservations.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting reservations to Excel:', error);
    res.status(500).send('Error exporting reservations.');
  }
});

module.exports = router;
