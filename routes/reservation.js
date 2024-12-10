const express = require('express');
const router = express.Router();
const Reservation = require('../models/Reservation');
const Ship = require('../models/Ship');
const ExcelJS = require('exceljs');

// 월별 예약 데이터 조회
router.get('/monthly', async (req, res) => {
    const { month } = req.query;
    const currentMonth = month || new Date().getMonth() + 1;
  
    try {
      const startDate = new Date(`2024-${currentMonth}-01`);
      const endDate = new Date(`2024-${currentMonth}-31`);
  
      const [reservations, ships] = await Promise.all([
        Reservation.find({ departureDate: { $gte: startDate, $lt: endDate } }).populate('ship'),
        Ship.find(),
      ]);
  
      res.render('monthly-reservations', { reservations, selectedMonth: currentMonth, ships });
    } catch (error) {
      console.error('Error fetching monthly reservations:', error);
      res.status(500).send('Error fetching reservations.');
    }
  });
  
  

// 새 예약 데이터 일괄 삽입
router.post('/add-bulk', async (req, res) => {
    try {
      const newReservations = req.body.map((reservation) => ({
        ...reservation,
        ship: reservation.ship || null,
        contractDate: reservation.contractDate || new Date(),
        departureDate: reservation.departureDate || new Date(),
        arrivalDate: reservation.arrivalDate || new Date(),
        reservedBy: reservation.reservedBy || 'Unknown',
        contact: reservation.contact || 'Unknown',
        listStatus: reservation.listStatus || '',
      }));
  
      const savedReservations = await Reservation.insertMany(newReservations, { ordered: false });
      res.json({ success: true, data: savedReservations }); // 저장된 데이터 반환
    } catch (error) {
      console.error('Error during bulk addition:', error);
      res.status(500).json({ success: false, message: 'Bulk addition failed.' });
    }
  });
  
  
  

  router.post('/bulk-update', async (req, res) => {
    try {
      for (const update of req.body) {
        if (update._id) {
          // 기존 데이터 업데이트
          await Reservation.findByIdAndUpdate(update._id, update, { new: true });
        } else {
          // 새 데이터 삽입
          const ship = await Ship.findOne({ name: update.ship });
          await Reservation.create({
            ...update,
            ship: ship ? ship._id : null,
          });
        }
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error during bulk update:', error);
      res.status(500).json({ success: false, message: 'Bulk update failed.' });
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
        contractDate: new Date(contractDate),
        departureDate: new Date(departureDate),
        arrivalDate: new Date(arrivalDate),
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
  
      const reservations = await Reservation.find({
        departureDate: { $gte: startDate, $lt: endDate },
      }).populate('ship');
  
      // 엑셀 워크북 생성
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Monthly Reservations');
  
      // 헤더 정의
      sheet.columns = [
        { header: '선박명', key: 'shipName', width: 15 },
        { header: '명단', key: 'listStatus', width: 20 }, // 명단 추가
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
          shipName: reservation.ship?.name || '', // 선박명
          listStatus: reservation.listStatus || '', // 명단
          contractDate: reservation.contractDate?.toISOString().split('T')[0] || '', // 계약일
          departureDate: reservation.departureDate?.toISOString().split('T')[0] || '', // 출항일
          arrivalDate: reservation.arrivalDate?.toISOString().split('T')[0] || '', // 입항일
          reservedBy: reservation.reservedBy || '', // 예약자명
          reservedBy2: reservation.reservedBy2 || '', // 예약자명2
          contact: reservation.contact || '', // 연락처
          product: reservation.product || '', // 상품
          totalSeats: reservation.totalSeats || 0, // 총 좌석
          economySeats: reservation.economySeats || 0, // 이코노미 좌석
          businessSeats: reservation.businessSeats || 0, // 비즈니스 좌석
          firstSeats: reservation.firstSeats || 0, // 퍼스트 좌석
          dokdoTourDate: reservation.dokdoTourDate?.toISOString().split('T')[0] || '', // 독도 관광 날짜
          dokdoTourPeople: reservation.dokdoTourPeople || 0, // 독도 관광 인원
          dokdoTourTime: reservation.dokdoTourTime || '', // 독도 관광 시간
          dokdoTourDetails: reservation.dokdoTourDetails || '', // 상품내용
          totalPrice: reservation.totalPrice || 0, // 총금액
          deposit: reservation.deposit || 0, // 계약금
          balance: reservation.balance || 0, // 잔금
          rentalCar: reservation.rentalCar || '', // 렌터카
          accommodation: reservation.accommodation || '', // 숙박
          others: reservation.others || '', // 기타
          departureFee: reservation.departureFee || 0, // 출항비
          arrivalFee: reservation.arrivalFee || 0, // 입항비
          dokdoFee: reservation.dokdoFee || 0, // 독도비
          restaurantFee: reservation.restaurantFee || 0, // 식당비
          eventFee: reservation.eventFee || 0, // 행사비
          otherFee: reservation.otherFee || 0, // 기타비
          refund: reservation.refund || 0, // 환불
          totalSettlement: reservation.totalSettlement || 0, // 총 정산비
          profit: reservation.profit || 0, // 수익
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
