import { JwtPayload } from 'jsonwebtoken';

declare global {
  namespace Express {
    export interface Request {
      // The user property will hold our decoded JWT payload
      user?: string | JwtPayload;
    }
  }
}
