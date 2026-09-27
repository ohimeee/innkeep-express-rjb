import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { pool } from "./db";
import { validateResource } from "./validate";
import { Router, Request, Response, NextFunction } from "express";
import { authRequestSchema } from "./schemas";
import { authenticateToken } from "./authMiddleware";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

// Register is open for the very first account only. After that, a new staff
// login has to be made by someone already signed in — otherwise anyone who
// found the endpoint could give themselves the front desk.
const firstAccountOrStaff = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const existing = await pool.query(`SELECT 1 FROM "User" LIMIT 1`);
    if (existing.rows.length === 0) return next();
    return authenticateToken(req, res, next);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

// POST Create a new staff account /api/auth/register
router.post(
  "/register",
  firstAccountOrStaff,
  validateResource(authRequestSchema),
  async (req: Request, res: Response) => {
    const { username, password } = req.body;

    try {
      // check if user already exists
      const userCheck = await pool.query(
        `SELECT "username" FROM "User" WHERE "username" = $1`,
        [username]
      );
      if (userCheck.rows.length > 0) {
        return res.status(409).json({ error: "Username already exists." });
      }

      // hash the password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // insert
      const result = await pool.query(
        `INSERT INTO "User" ("username", "passwordHash") VALUES ($1, $2)
         RETURNING "id", "username"`,
        [username, passwordHash]
      );

      res.status(201).json({
        message: "User registered successfully!",
        user: result.rows[0],
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

// POST Log-in /api/auth/login
router.post(
  "/login",
  validateResource(authRequestSchema),
  async (req: Request, res: Response) => {
    const { username, password } = req.body;

    try {
      // find the user
      const result = await pool.query(
        `SELECT * FROM "User" WHERE "username" = $1`,
        [username]
      );
      const user = result.rows[0];

      if (!user) {
        return res.status(401).json({ error: "Invalid username or password." });
      }

      // compare or check whether the login password is correct
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (isValidPassword) {
        const token = jwt.sign(
          { userId: user.id, username: user.username },
          JWT_SECRET,
          { expiresIn: "1h" }
        );

        return res.json({ message: "Login successful", token });
      }

      res.status(401).json({ error: "Invalid username or password." });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

// POST Logout /api/auth/logout
router.post("/logout", async (req: Request, res: Response) => {
  // Since standard JWTs are stateless, and stored on the client side,
  // The server doesn't destroy the token. We simply instruct the client to delete it.
  res.json({ message: "Logged out successfully. Please remove the token from your client." });
});

export default router;
