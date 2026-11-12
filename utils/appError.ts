import { Response } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

// An expected failure whose message is safe to show to the client
export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Maps an error to a status code and a client-safe message.
// Anything unexpected is logged and answered with the generic fallback,
// so raw library/database messages never reach the client.
export const sendError = (res: Response, err: unknown, fallback: string) => {
  let statusCode = 500;
  let message = fallback;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof mongoose.Error.ValidationError) {
    // Send only the schema's own messages, not Mongoose's cast error text
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) =>
        e instanceof mongoose.Error.CastError
          ? `Invalid value for ${e.path}`
          : e.message
      )
      .join('. ');
  } else if (err instanceof jwt.TokenExpiredError) {
    statusCode = 401;
    message = 'Your session has expired! Please log in again.';
  } else if (err instanceof jwt.JsonWebTokenError) {
    statusCode = 401;
    message = 'Invalid token! Please log in again.';
  } else {
    console.error(err);
  }

  res.status(statusCode).json({
    status: 'error',
    message,
  });
};
