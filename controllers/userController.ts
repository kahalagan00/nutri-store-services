import { RequestHandler } from 'express';
import mongoose from 'mongoose';
import User from '../models/userModel';
import Cart from '../models/cartModel';

const getAllUsers: RequestHandler = async (req, res) => {
  try {
    // Optional pagination: ?page=2&limit=20
    // Defaults to page 1 with 100 users, invalid values fall back to defaults
    const page = Math.min(
      Math.max(parseInt(String(req.query.page), 10) || 1, 1),
      10000
    );
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit), 10) || 100, 1),
      100
    );

    // Only send what a user list needs, never health or payment data
    // Sorted so pages are stable, lean because the docs are only serialized
    const doc = await User.find()
      .select('name email role image slug')
      .sort('_id')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    console.log('Yay (getAllUsers) we got Requested 🥳');

    res.status(200).json({
      status: 'success',
      results: doc.length,
      data: doc,
    });
  } catch (err: unknown) {
    // Log the details server-side, never send raw error messages to the client
    console.error(err);
    res.status(500).json({
      status: 'error',
      message: 'An error occured when fetching all users',
    });
  }
  return;
};

const getUser: RequestHandler = (req, res) => {
  console.log('Yay (getUser) we got Requested 🥳');

  // "protect" already loaded the current user, no need to query it again
  res.status(200).json({
    status: 'success',
    data: res.locals.user,
  });
  return;
};

const deleteUser: RequestHandler = async (req, res) => {
  try {
    const doc = await User.findById(req.params.id);

    console.log('Warning (deleteUser) got Requested 🗑️');

    if (!doc) {
      res.status(404).json({
        status: 'fail',
        message: 'No user found with that ID',
      });
      return;
    }

    // Only admins get here, so blocking self-deletion also guarantees
    // that at least one admin always remains
    if (doc._id.equals(req.user?._id)) {
      res.status(403).json({
        status: 'fail',
        message: 'You cannot delete your own account',
      });
      return;
    }

    // Delete the user's cart BEFORE the user, so a failure here leaves
    // the user in place and the request can be retried
    await Cart.deleteMany({ userId: doc._id });
    await doc.deleteOne();

    // 204 responses never carry a body
    res.status(204).end();
  } catch (err) {
    // Malformed id is a client error, anything else is a server error
    const isBadId = err instanceof mongoose.Error.CastError;
    if (!isBadId) console.error(err);
    res.status(isBadId ? 400 : 500).json({
      status: 'error',
      message: isBadId
        ? 'Invalid user ID'
        : 'An error occurred when deleting the user',
    });
  }
  return;
};

export { getAllUsers, getUser, deleteUser };
