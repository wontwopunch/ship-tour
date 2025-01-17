const express = require('express');
const router = express.Router(); // Router를 초기화합니다.
const Ship = require('../models/Ship'); // Ship 모델을 가져옵니다.


router.get('/', async (req, res) => {
  try {
    const ships = await Ship.find();
    res.render('ship-management', { ships });
  } catch (error) {
    console.error('Error fetching ships:', error.message);
    res.status(500).send('Internal Server Error');
  }
});

// 선박 관리: 선박 이름만 등록
router.post('/add', async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Name is required' });
  }

  try {
    const ship = new Ship({ name });
    await ship.save();

    // 성공적으로 저장된 선박 데이터를 반환
    res.json({ success: true, ship, message: 'Ship added successfully' });
  } catch (error) {
    console.error('Error adding ship:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// 선박 목록 조회
router.get('/list', async (req, res) => {
  try {
    const ships = await Ship.find().sort('name');
    res.json(ships);
  } catch (error) {
    console.error('Error fetching ships:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 선박 삭제
router.delete('/delete/:id', async (req, res) => {
  try {
    await Ship.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Ship deleted successfully' });
  } catch (error) {
    console.error('Error deleting ship:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router; // router를 내보냅니다.
