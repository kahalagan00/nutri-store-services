const { promisify } = require('util');
const crypto = require('crypto');
import jwt from 'jsonwebtoken';
import User from '../models/userModel';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import Email from '../utils/email';

// NOTE: "return" statements are good practice for TypeScript

const INCHES_IN_METER = 39.3701;
const LBS_IN_KG = 2.2;

const signToken = (id: string) => {
  return jwt.sign(
    {
      id,
    },
    process.env.JWT_SECRET as string,
    {
      // 15 minutes common security measure
      expiresIn: process.env.JWT_EXPIRES_IN as string,
    }
  );
};

// Creates JWT token used for authentication
const createSendToken = (
  user: any,
  statusCode: number,
  req: Request,
  res: Response
) => {
  const token = signToken(user._id);

  // 15 minutes common security measure
  const cookieExpirationOffset: number =
    parseInt(process.env.JWT_COOKIE_EXPIRES_IN as string, 10) * 60 * 1000;

  res.cookie('jwt', token, {
    expires: new Date(Date.now() + cookieExpirationOffset),
    httpOnly: true,
    // # For development
    // secure: false,

    // # For production
    secure: true,
    sameSite: 'none', // REQURIED for cross-site cookies (very important to keep it here for authentication testing)
  });

  // console.log(
  //   "req.secure || req.headers['x-forwarded-proto'] === 'https' -> ",
  //   req.secure || req.headers['x-forwarded-proto'] === 'https'
  // );

  // console.log(res.getHeaders());

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
  return;
};

const signup: RequestHandler = async (req, res, next) => {
  try {
    const newUser = await User.create({
      ...req.body,
      height: {
        heightMetric: req.body.height,
        heightImperial: req.body.height * INCHES_IN_METER,
      },
      weight: {
        weightMetric: req.body.weight,
        weightImperial: req.body.weight * LBS_IN_KG,
      },
      symptoms: [req.body.symptoms],
    });

    createSendToken(newUser, 201, req, res);
  } catch (err) {
    res.status(400).json({
      status: 'error',
      message:
        err instanceof Error
          ? err.message
          : 'Please fill out all required fields to create the user',
    });
  }

  return;
};

// Login the user
const login: RequestHandler = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1) Check if email and password exists
    if (!email || !password) {
      throw new Error('Please provide an email and password');
    }

    // 2) Check if user exists && password is correct
    const user = await User.findOne({ email }).select('+password');

    // "await" here is very important to make sure the checking returns the correct value
    if (!user || !(await user.checkPassword(password, user.password))) {
      throw new Error('Incorrect email or password detected');
    }

    // 3) If everything is ok, send token (JWT) to the client
    createSendToken(user, 200, req, res);

    console.log('User logged in ✅');
  } catch (err) {
    res.status(401).json({
      status: 'error',
      message:
        err instanceof Error ? err.message : 'An error occured during login',
    });
  }
  return;
};

// Logout the user
const logout: RequestHandler = (req, res) => {
  // res.cookie('jwt', 'loggedout', {
  //   expires: new Date(Date.now() + 10 * 1000),
  //   httpOnly: true,
  // });
  res.cookie('jwt', 'loggedout', {
    expires: new Date(0), // Expire immediately
    httpOnly: true, // Match the original cookie
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    sameSite: 'none', // Match the original cookie (if using cross-origin)
    path: '/', // Match the original cookie (if set)
  });

  console.log('User logged out and cookie removed 🐼');

  res.status(200).json({
    status: 'success',
    message: 'Successfully logged out the current user',
  });
  return;
};

// Authenticate user
const protect: RequestHandler = async (req, res, next) => {
  try {
    // 1) Getting token and check if it's there
    // console.log('Cookies: ', req.cookies);
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      throw new Error(
        'You are not logged in! Please log in to get access to this service'
      );
    }

    // 2) Verification token
    const decoded = await promisify(jwt.verify)(
      token,
      process.env.JWT_SECRET as string
    );

    // 3) Check if user still exists
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      throw new Error('The user holding this token no longer exists');
    }

    //4) Check if user changed password after the JWT token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      throw new Error('User recently changed password! Please log in again.');
    }

    // GRANT ACCESS TO PROTECTED ROUTE (All security tests passed!)
    req.user = {
      ...currentUser.toObject(),
      _id: currentUser._id.toString(), // Converts ObjectId to string
    };

    res.locals.user = currentUser;
    next();
  } catch (err) {
    res.status(401).json({
      status: 'error',
      message:
        err instanceof Error
          ? err.message
          : 'An error occurred when trying to authorize user',
    });
  }
};

//  Only for rendered pages (SSR), no errors
// exports.isLoggedIn = async (req, res, next) => {
//   // 1) Getting token and check if it's there
//   if (req.cookies.jwt) {
//     try {
//       // 1) Verifies token
//       const decoded = await promisify(jwt.verify)(
//         req.cookies.jwt,
//         process.env.JWT_SECRET
//       );

//       // 2) Check if user still exists
//       const currentUser = await User.findById(decoded.id);
//       if (!currentUser) {
//         return next();
//       }

//       // 3) Check if user changed password after the JWT token was issued
//       if (currentUser.changedPasswordAfter(decoded.iat)) {
//         return next();
//       }

//       // THERE IS A LOGGED IN USER
//       res.locals.user = currentUser;
//       return next();
//     } catch (error) {
//       return next();
//     }
//   }
//   next();
// };

// Authorization: Granting permission to user
const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // roles ['admin', 'lead-guide']. role='user'
      if (req.user?.role && !roles.includes(req.user.role)) {
        throw new Error('You do not have permission to perform this action');
      }
      next(); // Only go to next function if the check passes
    } catch (err) {
      res.status(403).json({
        status: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'An error occurred when trying to restrict user access',
      });
    }
  };
};

const forgotPassword: RequestHandler = async (req, res, next) => {
  // 1) Get user based on the email provided in the POST request body
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    res.status(404).json({
      status: 'error',
      message: 'There is no user with that email address',
    });
    return;
  }

  // 2) Generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  try {
    // 3) Send it to user's email
    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/users/resetPassword/${resetToken}`;

    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    res.status(500).json({
      status: 'error',
      message: 'There was an error sending the email. Try again later!',
    });
  }
  return;
};

const resetPassword: RequestHandler = async (req, res, next) => {
  try {
    // 1) Get user based on the token
    const hashedToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    // 2) If token has not expired, and there is user, set the new password
    if (!user) {
      throw new Error('Token is invalid or has expired');
    }
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Do not log in the user
    res.status(200).json({
      status: 'success',
      data: {
        user,
      },
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message:
        err instanceof Error
          ? err.message
          : 'An unknown error occurred when trying to reset the password',
    });
  }

  return;
};

/* Update password of current user that is logged in*/
const updateMyPassword: RequestHandler = async (req, res) => {
  try {
    // 1) Get user from collection
    const user = await User.findById(req.user?._id).select('+password');

    // 2) Check if POSTed req.body password is correct
    if (!(await user?.checkPassword(req.body.passwordCurrent, user.password))) {
      throw new Error('Provided current password is wrong');
    }

    // 3) If password is correct --> update password
    if (user) {
      user.password = req.body.password;
      user.passwordConfirm = req.body.passwordConfirm;
      await user.save();
    }

    // 4) Log user in, send JWT token
    createSendToken(user, 200, req, res);
  } catch (err) {
    res.status(401).json({
      status: 'error',
      message:
        err instanceof Error
          ? err.message
          : 'An unknown error occurred when trying to update current user password',
    });
  }
};

export {
  login,
  protect,
  restrictTo,
  signup,
  logout,
  forgotPassword,
  resetPassword,
  updateMyPassword,
};
