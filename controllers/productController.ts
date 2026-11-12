import { RequestHandler } from 'express';
import mongoose from 'mongoose';
import Product from '../models/productModel';
import Cart from '../models/cartModel';

const getAllProducts: RequestHandler = async (req, res) => {
  try {
    // console.log(req.cookies);
    // Optional pagination: ?page=2&limit=20
    // Defaults to page 1 with 100 products, invalid values fall back to defaults
    const page = Math.min(
      Math.max(parseInt(String(req.query.page), 10) || 1, 1),
      10000
    );
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit), 10) || 100, 1),
      100
    );

    // Sorted so pages are stable, lean because the docs are only serialized
    const doc = await Product.find()
      .sort('_id')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    console.log('Yay (getAllProducts) we got Requested 🥳');

    res.status(200).json({
      status: 'success',
      results: doc.length,
      data: doc,
    });
    return;
  } catch (err: unknown) {
    // Log the details server-side, never send raw error messages to the client
    console.error(err);
    res.status(500).json({
      status: 'error',
      message: 'An error occured when fetching all products',
    });
    return;
  }
};

const getProduct: RequestHandler = async (req, res) => {
  try {
    const doc = await Product.findById(req.params.id);

    console.log('Yay (getProduct) we got Requested 🥳');

    if (!doc) {
      res.status(404).json({
        status: 'fail',
        message: 'No product found with that ID',
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: doc,
    });
    return;
  } catch (err: unknown) {
    // Malformed id is a client error, anything else is a server error
    const isBadId = err instanceof mongoose.Error.CastError;
    if (!isBadId) console.error(err);
    res.status(isBadId ? 400 : 500).json({
      status: 'error',
      message: isBadId
        ? 'Invalid product ID'
        : 'An unknown error occurred when fetching product',
    });
    return;
  }
};

const createProduct: RequestHandler = async (req, res, next) => {
  try {
    // An array body would make Product.create() insert several products
    if (Array.isArray(req.body)) {
      res.status(400).json({
        status: 'fail',
        message: 'Request body must be a single product object',
      });
      return;
    }

    // Allowlist product fields; never trust _id, __v, slug, etc. from the client
    const {
      name,
      purpose,
      image,
      grams,
      matterType,
      price,
      availability,
      stockQuantity,
      warnings,
      ingredients,
      nutritionalFacts,
    } = req.body;
    const doc = await Product.create({
      name,
      purpose,
      image,
      grams,
      matterType,
      price,
      availability,
      stockQuantity,
      warnings,
      ingredients,
      nutritionalFacts,
    });

    console.log('Yay (createProduct) we got Requested 🥳');

    res.status(201).json({
      status: 'success',
      data: doc,
    });
  } catch (err) {
    // Duplicate key (unique name), hide the raw MongoDB error message
    if (
      err instanceof mongoose.mongo.MongoServerError &&
      err.code === 11000
    ) {
      res.status(409).json({
        status: 'fail',
        message: 'A product with that name already exists',
      });
      return;
    }

    // Validation problems are client errors, anything else is a server error
    if (err instanceof mongoose.Error.ValidationError) {
      // Send only the schema's own messages, not Mongoose's cast error text
      const message = Object.values(err.errors)
        .map((e) =>
          e instanceof mongoose.Error.CastError
            ? `Invalid value for ${e.path}`
            : e.message
        )
        .join('. ');
      res.status(400).json({
        status: 'error',
        message,
      });
      return;
    }

    console.error(err);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred when creating the product',
    });
  }
};

const deleteProduct: RequestHandler = async (req, res, next) => {
  try {
    const id = req.params.id;

    // Remove the product from every cart that contains it BEFORE deleting it,
    // so a failure here leaves the product in place and the request can be retried
    const carts = await Cart.find({ 'cartItems.productId': id });
    for (const cart of carts) {
      // Items without a productId are kept, not crashed on
      cart.cartItems = cart.cartItems.filter(
        (item) => !item.productId?.equals(id)
      );

      // Recompute from the remaining items (rounded to cents) instead of
      // subtracting, so float rounding errors do not accumulate
      const total = cart.cartItems.reduce(
        (sum, item) => sum + (item.quantity ?? 0) * (item.price ?? 0),
        0
      );
      cart.totalPrice = Math.round(total * 100) / 100;

      await cart.save();
    }

    const doc = await Product.findByIdAndDelete(id);

    console.log('Warning (deleteProduct) got Requested 🗑️');

    if (!doc) {
      res.status(404).json({
        status: 'fail',
        message: 'No product found with that ID',
      });
      return;
    }

    // 204 responses never carry a body
    res.status(204).end();
  } catch (err) {
    // Malformed id is a client error, anything else is a server error
    const isBadId = err instanceof mongoose.Error.CastError;
    if (!isBadId) console.error(err);
    res.status(isBadId ? 400 : 500).json({
      status: 'error',
      message: isBadId
        ? 'Invalid product ID'
        : 'An error occurred when deleting the product',
    });
  }
};

export { getAllProducts, getProduct, createProduct, deleteProduct };
