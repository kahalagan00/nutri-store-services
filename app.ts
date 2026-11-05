import express, { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
const rateLimit = require('express-rate-limit');
// import rateLimit from 'express-rate-limit'; // Does not work even though ES modules are supported. Why?
import ExpressMongoSanitize from 'express-mongo-sanitize';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import cors from 'cors';
const xss = require('xss-clean');

// Routers
import productRouter from './routes/productRoutes';
import userRouter from './routes/userRoutes';
import cartRouter from './routes/cartRoutes';
import paymentRouter from './routes/paymentRoutes';

// Start express app
const app = express();

// <------------------------------------------------------------------------------------------>
// Middlewares -->
const allowedOrigins = [
  'https://jhuvnutrition.com', // For production
  // 'http://localhost:5173', // For development
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.options('*', cors());
app.use(((req: Request, res: Response, next: NextFunction): void => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS'
    );
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  if (req.method === 'OPTIONS') {
    res.status(200).end(); // Respond to preflight requests
    return; // Explicitly end the middleware chain
  }

  next();
}) as express.RequestHandler); // Explicitly type as RequestHandler

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev')); // Morgan logs HTTP request details
}

// Limits the number of requests a user can make to the API
// Uncomment during production mode so that there is a limit to the requests
const limiter = rateLimit({
  max: 200,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour!',
});
// Max of 200 requests within one hour
app.use('/api', limiter);

// Limit the amount of data that can be inside the "req.body"?
// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' }));
app.use(
  express.urlencoded({
    extended: true,
    limit: '10kb',
  })
);

app.use(cookieParser());

// Data sanitization against NoSQL query injection
app.use(ExpressMongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Compresses the overall code or just the app.js
app.use(compression());

// Routes -->
app.use('/api/v1/products', productRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/carts', cartRouter);
app.use('/api/v1/payment', paymentRouter);

// Handling unhandled routes (NEEDS TO BE AT THE BOTTOM, ORDER MATTERS!)
app.all('*', (req, res, next) => {
  // const err = new Error(`Can't find ${req.originalUrl} on this server!`);
  // err.status = 'fail';
  // err.statusCode = 404;
  // next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
  next(new Error("Can't find given url on this server! 🛑"));
});

export default app;
