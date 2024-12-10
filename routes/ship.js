const express = require('express');
const router = express.Router();
const Ship = require('../models/Ship');

// 선박 관리 페이지 렌더링
router.get('/', async (req, res) => {
  try {
    const ships = await Ship.find(); // 모든 선박 데이터 조회
    res.render('ship-management', { ships }); // 선박 관리 페이지 렌더링
  } catch (error) {
    console.error('Error fetching ships:', error);
    res.status(500).send('Error fetching ship data.');
  }
});

// 선박 추가 요청 처리
router.post('/add', async (req, res) => {
  const { name, eco, biz, first } = req.body;

  try {
    // 새 선박 데이터 생성
    const total = parseInt(eco || 0) + parseInt(biz || 0) + parseInt(first || 0);
    const newShip = new Ship({ name, eco, biz, first, total });
    await newShip.save();

    res.redirect('/ship'); // 추가 후 선박 관리 페이지로 리다이렉트
  } catch (error) {
    console.error('Error adding ship:', error);
    res.status(500).send('Error adding ship.');
  }
});

// 선박 좌석 수정 요청 처리
router.post('/update/:id', async (req, res) => {
    const { id } = req.params;
    const { name, eco, biz, first } = req.body;
  
    try {
      const ship = await Ship.findById(id);
      if (!ship) return res.status(404).json({ success: false, message: 'Ship not found.' });
  
      // 수정된 데이터 업데이트
      if (name !== undefined) ship.name = name.trim();
      if (eco !== undefined) ship.eco = parseInt(eco) || 0;
      if (biz !== undefined) ship.biz = parseInt(biz) || 0;
      if (first !== undefined) ship.first = parseInt(first) || 0;
  
      ship.total = ship.eco + ship.biz + ship.first; // 총 좌석 재계산
  
      await ship.save();
  
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating ship:', error);
      res.status(500).json({ success: false, message: 'Error updating ship.' });
    }
  });
  

// 선박 삭제 요청 처리
router.delete('/delete/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const ship = await Ship.findByIdAndDelete(id);
    if (!ship) return res.status(404).json({ success: false, message: 'Ship not found.' });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting ship:', error);
    res.status(500).json({ success: false, message: 'Error deleting ship.' });
  }
});

module.exports = router;
