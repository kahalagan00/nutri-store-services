import { RequestHandler } from 'express';
import User from '../models/userModel';

const getAllUsers: RequestHandler = async (req, res) => {
  try {
    const doc = await User.find();

    if (!doc) {
      res.status(404).json({
        status: 'fail',
        message: 'No documents found!',
      });
      return;
    }

    console.log('Yay (getAllUsers) we got Requested 🥳');

    res.status(200).json({
      status: 'success',
      results: doc.length,
      data: doc,
    });
  } catch (err: unknown) {
    res.status(500).json({
      status: 'error',
      message:
        err instanceof Error
          ? err.message
          : 'An error occured when fetching all users',
    });
  }
  return;
};

const getUser: RequestHandler = async (req, res) => {
  try {
    const doc = await User.findById(req.user?._id);

    console.log('Yay (getUser) we got Requested 🥳');

    res.status(200).json({
      status: 'success',
      data: doc,
    });
  } catch (err: unknown) {
    res.status(500).json({
      status: 'error',
      message:
        err instanceof Error
          ? err.message
          : 'An unknown error occurred when fetching user',
    });
  }
  return;
};

const deleteUser: RequestHandler = async (req, res) => {
  try {
    const doc = await User.findByIdAndDelete(req.params.id);

    console.log('Warning (deleteUser) got Requested 🗑️');

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
  return;
};

export { getAllUsers, getUser, deleteUser };
