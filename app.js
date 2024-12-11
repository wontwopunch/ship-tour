require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const path = require('path');
const connectDB = require('./config/db');

// 라우터 임포트
const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth');
const shipRouter = require('./routes/ship');
const reservationRouter = require('./routes/reservation');
const statusRouter = require('./routes/status');

// Express 앱 생성
const app = express();

// 데이터베이스 연결
connectDB();



// 뷰 엔진 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 정적 파일 설정
app.use(express.static(path.join(__dirname, 'public')));

// 미들웨어 설정
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(
  session({
    secret: 'your-secret-key', // 세션 암호화 키
    resave: false, // 세션을 강제로 저장하지 않음
    saveUninitialized: false, // 초기화되지 않은 세션을 저장하지 않음
  })
);

// 사용자 인증 미들웨어
app.use((req, res, next) => {
  const isLoginPage = req.path === '/auth/login';
  const isAuthRoute = req.path.startsWith('/auth');
  if (!req.session.user && !isLoginPage && !isAuthRoute) {
    return res.redirect('/auth/login'); // 로그인되지 않은 사용자는 로그인 페이지로 리다이렉트
  }
  next();
});

// 라우터 설정
app.use('/', indexRouter);
app.use('/auth', authRouter);
app.use('/ship', shipRouter);
app.use('/reservation', reservationRouter);
app.use('/status', statusRouter);

// 404 에러 핸들링
app.use((req, res) => {
    res.status(404).render('404', { error: '페이지를 찾을 수 없습니다.' });
  });

  
// 서버 시작
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
