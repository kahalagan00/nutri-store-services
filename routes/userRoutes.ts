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

const router = express.Router();

router.post('/login', login);
router.post('/signup', signup);
router.get('/logout', logout);

router.post('/forgotPassword', forgotPassword);
router.patch('/resetPassword/:token', resetPassword);

// Protect all the routes that follows below
router.use(protect);

router.patch('/updateMyPassword', updateMyPassword);

router.route('/user').get(getUser);

router.use(restrictTo('admin'));
router.route('/').get(getAllUsers);
router.route('/:id').delete(deleteUser);

export default router;
