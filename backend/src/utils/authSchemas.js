// Zod schemas for the auth endpoints, used via middleware/validate:
//
//   router.post("/login", validate({ body: loginSchema }), handler);
//
// Passwords: max 72 chars (bcrypt's input limit), min 8, must contain at
// least one letter and one number. Usernames: letters, digits, _ . - only.
const { z } = require("zod");

const username = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(50, "Username must be at most 50 characters")
  .regex(
    /^[a-zA-Z0-9_.-]+$/,
    "Username may only contain letters, digits, _ . -",
  );

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters")
  .regex(/[a-zA-Z]/, "Password must contain a letter")
  .regex(/[0-9]/, "Password must contain a digit");

const registerSchema = z.object({
  username,
  password,
  fullName: z.string().trim().min(1, "Full name is required").max(100),
  timezone: z.string().trim().max(64).default("UTC"),
});

const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required").max(50),
  password: z.string().min(1, "Password is required").max(72),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

module.exports = { registerSchema, loginSchema, refreshSchema, logoutSchema };
