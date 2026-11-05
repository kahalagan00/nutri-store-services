import express from 'express';
import { protect } from '../controllers/authController';
import {
  createCheckoutSession,
  paymentStatus,
} from '../controllers/paymentController';

const router = express.Router();

router.use(protect);
router.post('/create-checkout-session', createCheckoutSession);
router.get('/payment-status/:sessionId', paymentStatus);

export default router;
