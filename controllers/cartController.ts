import { RequestHandler } from 'express';
import Cart from '../models/cartModel';
import Product from '../models/productModel';
import mongoose from 'mongoose';

const getAllCarts: RequestHandler = async (req, res) => {
  try {
    const doc = await Cart.find();
    if (!doc) {
      res.status(404).json({
        status: 'fail',
        message: 'No documents found!',
      });
      return;
    }

    console.log('Yay (getAllCarts) we got Requested 🥳');

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
          : 'An error occured when fetching all carts',
    });
    return;
  }
};

const getCart: RequestHandler = async (req, res) => {
  try {
    const doc = await Cart.findOne({ userId: req.user?._id });

    console.log('Yay (getCart) we got Requested 🥳');

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
          : 'An unknown error occurred when fetching cart',
    });
    return;
  }
};

const createCart: RequestHandler = async (req, res, next) => {
  try {
    // Check if there is a cart that already belongs to the current user
    // console.log(req.user);
    let doc: any = await Cart.find({ userId: req.user?._id });

    let statusCode = 200;
    // console.log(doc.length);

    if (doc.length > 0) {
      console.log('This user already has a cart. No modification done');
      statusCode = 200;
    } else {
      console.log('No cart detected from this user. Creating one now...');
      doc = await Cart.create({
        userId: req.user?._id,
        ...req.body,
      });
      statusCode = 201;
    }

    res.status(statusCode).json({
      status: 'success',
      data: doc,
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({
      status: 'error',
      message:
        err instanceof Error
          ? err.message
          : 'Please fill out all required fields for the cart',
    });
  }

  return;
};

const updateCart: RequestHandler = async (req, res, next) => {
  try {
    const doc = await Cart.findOne({ userId: req.user?._id });

    if (!doc) {
      throw new Error('Cart not found');
    }

    if (!mongoose.Types.ObjectId.isValid(req.body.productId)) {
      throw new Error('Invalid product ID');
    }

    // Never trust the client for product details (price, name, etc.);
    // read them from the stored product, which must still exist
    const productDoc = await Product.findById(req.body.productId);

    if (!productDoc) {
      res.status(404).json({
        status: 'error',
        message: 'Product not found',
      });
      return;
    }

    // Modify the document
    doc.totalPrice += productDoc.price * req.body.quantity;

    const isProductInCart = doc.cartItems.some((item) =>
      item.productId.equals(productDoc._id)
    );

    // If the item is already in the cart then just increase the quantity
    if (isProductInCart) {
      doc.cartItems = doc.cartItems.map((item) =>
        item.productId.equals(productDoc._id)
          ? { ...item, quantity: item.quantity + req.body.quantity }
          : item
      );
    } else {
      // console.log('It just pushes...');
      doc.cartItems.push({
        productId: productDoc._id,
        name: productDoc.name,
        price: productDoc.price,
        quantity: req.body.quantity,
        image: productDoc.image,
        purpose: productDoc.purpose,
      });
    }

    // Save the updated document
    await doc.save();

    console.log('Yay (updateCart) we got Requested 🥳');

    res.status(200).json({
      status: 'success',
      data: doc,
    });
  } catch (err) {
    res.status(400).json({
      status: 'error',
      message:
        err instanceof Error
          ? err.message
          : 'Please fill out all required fields for updating the cart',
    });
  }
};

const deleteCart: RequestHandler = async (req, res) => {
  try {
    const doc = await Cart.findByIdAndDelete(req.params.id);

    console.log('Warning (deleteCart) got Requested 🗑️');

    res.status(204).json({
      status: 'success',
      data: doc,
    });
    return;
  } catch (err: unknown) {
    res.status(404).json({
      status: 'error',
      message: err instanceof Error ? err.message : 'Resource not found',
    });
    return;
  }
};

const clearCart: RequestHandler = async (req, res) => {
  try {
    const doc = await Cart.findOne({ userId: req.user?._id });

    if (!doc) {
      throw new Error('Cart not found');
    }

    console.log('Warning (clearCart) got Requested 🛒❌');

    // Atomically decrement stock; the filter only matches if enough stock remains,
    // so concurrent checkouts can't oversell
    const decremented = [];
    for (const item of doc.cartItems) {
      const productDoc = await Product.findOneAndUpdate(
        { _id: item.productId, stockQuantity: { $gte: item.quantity } },
        { $inc: { stockQuantity: -item.quantity } },
        { new: true }
      );

      if (!productDoc) {
        // Roll back the items already decremented in this checkout
        await Promise.all(
          decremented.map(({ item }) =>
            Product.updateOne(
              { _id: item.productId },
              { $inc: { stockQuantity: item.quantity } }
            )
          )
        );

        const exists = await Product.exists({ _id: item.productId });
        res.status(exists ? 409 : 404).json({
          status: 'error',
          message: exists
            ? `Not enough stock for ${item.name}`
            : 'Product not found',
        });
        return;
      }

      decremented.push({ item, productDoc });
    }

    // Mark sold-out products as unavailable only once the whole cart succeeded
    await Promise.all(
      decremented
        .filter(({ productDoc }) => productDoc.stockQuantity <= 0)
        .map(({ productDoc }) =>
          Product.updateOne({ _id: productDoc._id }, { availability: false })
        )
    );

    doc.cartItems = [];
    doc.totalPrice = 0;

    // Save the updated document
    await doc.save();

    res.status(200).json({
      status: 'success',
      data: doc,
    });
    return;
  } catch (err: unknown) {
    res.status(404).json({
      status: 'error',
      message: err instanceof Error ? err.message : 'Resource not found',
    });
    return;
  }
};

const removeItemFromCart: RequestHandler = async (req, res) => {
  try {
    const doc = await Cart.findOne({ userId: req.user?._id });

    if (!doc) {
      throw new Error('Cart not found');
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw new Error('Invalid product ID');
    }

    const productDoc = await Product.findById(req.params.id);

    if (!productDoc) {
      throw new Error('Product not found');
    }

    const productInCart = doc.cartItems.find((item) =>
      item.productId.equals(new mongoose.Types.ObjectId(req.params.id))
    );

    // console.log('productInCart: ', productInCart);

    if (!productInCart) {
      throw new Error('Product is not inside the cart');
    }

    // # Product Operations
    // Re-update stockQuantity
    productDoc.stockQuantity += productInCart?.quantity;

    // Re-update availability based on updated stockQuantity
    if (!productDoc.availability && productDoc.stockQuantity > 0) {
      productDoc.availability = true;
    }

    // # Cart Operations
    const updatedCartItems = doc.cartItems.filter(
      (item) =>
        !item.productId.equals(new mongoose.Types.ObjectId(req.params.id))
    );

    // Update cartItems without the removed product
    // Update the totalPrice
    doc.cartItems = updatedCartItems;
    doc.totalPrice -= productInCart.quantity * productInCart.price;

    // Set to 0 just in case decimals occur from rounding and cart is empty
    if (doc.cartItems.length === 0 && doc.totalPrice != 0) {
      doc.totalPrice = 0;
    }

    await productDoc.save();
    await doc.save();

    console.log('Warning (removeItemFromCart) got Requested ↩ 🛒');

    res.status(200).json({
      status: 'success',
      data: doc,
    });
    return;
  } catch (err: unknown) {
    res.status(404).json({
      status: 'error',
      message: err instanceof Error ? err.message : 'Resource not found',
    });
    return;
  }
};

export {
  getAllCarts,
  getCart,
  createCart,
  updateCart,
  deleteCart,
  clearCart,
  removeItemFromCart,
};
