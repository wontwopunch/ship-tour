const express = require('express');
const router = express.Router();

// 기본 경로 처리
router.get('/', (req, res) => {
  // 사용자가 로그인하지 않은 경우 로그인 페이지로 리다이렉트
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }

  // 로그인된 경우 선박 관리 페이지로 리다이렉트
  res.redirect('/ship');
});

module.exports = router;
