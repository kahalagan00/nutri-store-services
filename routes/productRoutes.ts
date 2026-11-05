import express from 'express';
import {
  getAllProducts,
  getProduct,
  createProduct,
  deleteProduct,
} from '../controllers/productController';
import { protect, restrictTo } from '../controllers/authController';

const router = express.Router();

router.route('/').get(getAllProducts);
router.route('/:id').get(getProduct);

// Protect all the routes that follows below
router.use(protect);

// Only admins can modify products
router.use(restrictTo('admin'));
router.route('/').post(createProduct);
router.route('/:id').delete(deleteProduct);

export default router;
