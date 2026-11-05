import { RequestHandler } from 'express';
import Product from '../models/productModel';
import Cart from '../models/cartModel';

const getAllProducts: RequestHandler = async (req, res) => {
  try {
    // console.log(req.cookies);
    const doc = await Product.find();
    if (!doc) {
      res.status(404).json({
        status: 'fail',
        message: 'No documents found!',
      });
      return;
    }

    console.log('Yay (getAllProducts) we got Requested 🥳');

    res.status(200).json({
      status: 'success',
      results: doc.length,
      data: doc,
    });
    return;
  } catch (err: unknown) {
    res.status(500).json({
      status: 'error',
      message:
        err instanceof Error
          ? err.message
          : 'An error occured when fetching all products',
    });
    return;
  }
};

const getProduct: RequestHandler = async (req, res) => {
  try {
    const doc = await Product.findById(req.params.id);

    console.log('Yay (getProduct) we got Requested 🥳');

    res.status(200).json({
      status: 'success',
      data: doc,
    });
    return;
  } catch (err: unknown) {
    res.status(500).json({
      status: 'error',
      message:
        err instanceof Error
          ? err.message
          : 'An unknown error occurred when fetching product',
    });
    return;
  }
};

const createProduct: RequestHandler = async (req, res, next) => {
  try {
    const doc = await Product.create(req.body);

    console.log('Yay (createProduct) we got Requested 🥳');

    res.status(201).json({
      status: 'success',
      data: doc,
    });
  } catch (err) {
    res.status(400).json({
      status: 'error',
      message:
        err instanceof Error
          ? err.message
          : 'Please fill out all required fields for the product',
    });
  }
};

const deleteProduct: RequestHandler = async (req, res, next) => {
  try {
    const doc = await Product.findByIdAndDelete(req.params.id);

    // Remove the deleted product from every cart that contains it
    if (doc) {
      const carts = await Cart.find({ 'cartItems.productId': doc._id });
      for (const cart of carts) {
        const removedItems = cart.cartItems.filter((item) =>
          item.productId.equals(doc._id)
        );
        cart.cartItems = cart.cartItems.filter(
          (item) => !item.productId.equals(doc._id)
        );
        for (const item of removedItems) {
          cart.totalPrice -= item.quantity * item.price;
        }

        // Set to 0 just in case decimals occur from rounding and cart is empty
        if (cart.cartItems.length === 0) {
          cart.totalPrice = 0;
        }

        await cart.save();
      }
    }

    console.log('Warning (deleteProduct) got Requested 🗑️');

    res.status(204).json({
      status: 'success',
      data: doc,
      message: 'Resource deleted successfully',
    });
  } catch (err) {
    res.status(404).json({
      status: 'error',
      message: err instanceof Error ? err.message : 'Resource not found',
    });
  }
};

export { getAllProducts, getProduct, createProduct, deleteProduct };
