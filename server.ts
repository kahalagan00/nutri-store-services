import mongoose from 'mongoose';
import dotenv from 'dotenv';
import app from './app';

// Catch all possible uncaught exceptions anywhere in the codebase
process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shuting down...');
  console.log(err.name);
  console.log(err.message);
  // console.log(err); // Shows stack trace.
  process.exit(1);
});

dotenv.config({ path: './config.env' });

const database: any = process.env.DATABASE?.replace(
  '<db_password>',
  process.env.DATABASE_PASSWORD as string
);
if (!database) {
  throw new Error('DATABASE environment variable does not exist');
}

// Without these every login and signup fails, so refuse to start instead
['JWT_SECRET', 'JWT_EXPIRES_IN', 'JWT_COOKIE_EXPIRES_IN'].forEach((name) => {
  if (!process.env[name]) {
    throw new Error(`${name} environment variable does not exist`);
  }
});
if (Number.isNaN(parseInt(process.env.JWT_COOKIE_EXPIRES_IN as string, 10))) {
  throw new Error('JWT_COOKIE_EXPIRES_IN must be a number of minutes');
}

mongoose
  .connect(database)
  .then(() => console.log('Database connected successfully 👍'))
  .catch((err) => console.error('Database connection error:', err));

const port: number = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const server = app.listen(port, () => {
  console.log(`Application running on port ${port}...`);
});

process.on('unhandledRejection', (err: any) => {
  console.log('Unhandled Rejection Detected! 💥 Shuting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Processes the SIGTERM signal which is a signal used for program termination
// process.on('SIGTERM', () => {
//   console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
//   server.close(() => {
//     console.log('🛑 Process terminated');
//   });
// });
