// 선박 관리: 선박 이름만 등록
router.post('/add', async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Name is required' });
  }

  try {
    // 중복 확인
    const existingShip = await Ship.findOne({ name });
    if (existingShip) {
      return res.status(400).json({ success: false, message: 'Ship name already exists' });
    }

    const ship = new Ship({ name });
    await ship.save();
    res.json({ success: true, message: 'Ship added successfully' });
  } catch (error) {
    console.error('Error adding ship:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// 선박 목록 조회
router.get('/list', async (req, res) => {
  try {
    const ships = await Ship.find().sort('name');
    res.json({ success: true, data: ships });
  } catch (error) {
    console.error('Error fetching ships:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


