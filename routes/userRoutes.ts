import express from 'express';
import {
  deleteUser,
  getAllUsers,
  getUser,
} from '../controllers/userController';
import {
  forgotPassword,
  login,
  logout,
  protect,
  resetPassword,
  restrictTo,
  signup,
  updateMyPassword,
} from '../controllers/authController';

const rateLimit = require('express-rate-limit'); // Same import style as app.ts

const router = express.Router();

// Slows down password guessing: 10 failed logins per 15 minutes per IP
const loginLimiter = rateLimit({
  max: 10,
  windowMs: 15 * 60 * 1000,
  skipSuccessfulRequests: true,
  message: {
    status: 'error',
    message: 'Too many failed login attempts, please try again in 15 minutes!',
  },
});

// Stops reset emails being used to spam someone: 5 requests per hour per IP
const forgotPasswordLimiter = rateLimit({
  max: 5,
  windowMs: 60 * 60 * 1000,
  message: {
    status: 'error',
    message: 'Too many password reset requests, please try again in an hour!',
  },
});

router.post('/login', loginLimiter, login);
router.post('/signup', signup);
router.get('/logout', logout);

router.post('/forgotPassword', forgotPasswordLimiter, forgotPassword);
router.patch('/resetPassword/:token', resetPassword);

// Protect all the routes that follows below
router.use(protect);

router.patch('/updateMyPassword', updateMyPassword);

router.route('/user').get(getUser);

router.use(restrictTo('admin'));
router.route('/').get(getAllUsers);
router.route('/:id').delete(deleteUser);

export default router;
