import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Get the authorization header
  const authHeader = req.header("Authorization");

  // Extract the token (format: 'Bearer <jwt>')
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // attach the decoded payload onto the request
    req.user = decoded;

    // pass control to the next middleware or route handler
    next();
  } catch (error) {
    res.status(403).json({ error: "Invalid or expired token." });
  }
};
