import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        _id: string;
        name: string;
        email: string;
        dateOfBirth: Date;
        passwordChangedAt?: Date;
        role: string;
        slug: string;
        symptoms?: string[];
      };
    }
  }
}
