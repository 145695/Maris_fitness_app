// Central configuration. Every environment variable is read, validated and
// given a default HERE, so the rest of the code never touches process.env.
const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
  quiet: true,
});
const { z } = require("zod");

// Treat "KEY=" (empty value) in .env the same as a missing key.
const raw = Object.fromEntries(
  Object.entries(process.env).filter(([, v]) => v !== ""),
);

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  MYSQL_HOST: z.string().default("localhost"),
  MYSQL_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  MYSQL_USER: z.string().default("root"),
  MYSQL_PASSWORD: z.string().default(""),
  MYSQL_DATABASE: z.string().default("fitness_app"),
  MYSQL_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(100).default(10),

  MONGO_URI: z.string().default("mongodb://localhost:27017"),
  MONGO_DB: z.string().default("fitness_app"),

  // Comma-separated list of allowed browser origins, or "*" for everything.
  // Native mobile requests send no Origin header and are always allowed.
  CORS_ORIGIN: z
    .string()
    .default("http://localhost:8081,http://localhost:19006"),

  // Used from task B3 (auth). Optional until then, required in production.
  JWT_ACCESS_SECRET: z.string().min(32).optional(),
  JWT_REFRESH_SECRET: z.string().min(32).optional(),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).default(30),
  // A workout day counts as "completed" once exercises_done / exercises_total
  // reaches this fraction. Used by the streak logic and by the workout
  // endpoints to tell the client "this day is done".
  WORKOUT_COMPLETION_THRESHOLD: z.coerce.number().gt(0).lte(1).default(0.5),
});

const parsed = schema.safeParse(raw);
if (!parsed.success) {
  console.error("Invalid environment configuration (check backend/.env):");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  }
  process.exit(1);
}
const env = parsed.data;

if (
  env.NODE_ENV === "production" &&
  (!env.JWT_ACCESS_SECRET || !env.JWT_REFRESH_SECRET)
) {
  console.error(
    "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET (32+ characters) are required in production.",
  );
  process.exit(1);
}

module.exports = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === "production",
  port: env.PORT,
  mysql: {
    host: env.MYSQL_HOST,
    port: env.MYSQL_PORT,
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE,
    connectionLimit: env.MYSQL_CONNECTION_LIMIT,
  },
  mongo: { uri: env.MONGO_URI, dbName: env.MONGO_DB },
  cors: {
    origins: env.CORS_ORIGIN.split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  },
  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessTtl: env.ACCESS_TOKEN_TTL,
    refreshTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
  },
  workout: {
    completionThreshold: env.WORKOUT_COMPLETION_THRESHOLD,
  },
};
