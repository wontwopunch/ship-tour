const express = require('express');
const router = express.Router();
require('dotenv').config();

// 초기 관리자 계정
const ADMIN_CREDENTIALS = {
  username: process.env.ADMIN_USERNAME,
  password: process.env.ADMIN_PASSWORD,
};

// 로그인 페이지 렌더링
router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/ship');
  }
  res.render('login', { error: null });
});

// 로그인 요청 처리
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (
    username === ADMIN_CREDENTIALS.username &&
    password === ADMIN_CREDENTIALS.password
  ) {
    req.session.user = { username };
    return res.redirect('/ship');
  }

  res.render('login', { error: '아이디 또는 비밀번호가 잘못되었습니다.' });
});

// 로그아웃 요청 처리
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
});

module.exports = router;
