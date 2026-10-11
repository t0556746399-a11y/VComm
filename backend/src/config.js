const { z } = require('zod');
require('dotenv').config();

const envSchema = z.object({
  POSTGRES_HOST: z.string(),

  POSTGRES_PORT: z.coerce.number(),

  POSTGRES_DB: z.string(),

  POSTGRES_USER: z.string(),

  POSTGRES_PASSWORD: z.string(),

  CORS_ORIGINS: z.string().default('http://localhost:3000'),

 JWT_SECRET: z.string(),

  JWT_ALGORITHM: z.string().default('HS256'),

  JWT_EXPIRE_MINUTES: z.coerce.number().default(480),

  PORT: z.coerce.number().default(8000),

  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
});

const parsedEnv = envSchema.parse(process.env);

module.exports = Object.freeze(parsedEnv);
