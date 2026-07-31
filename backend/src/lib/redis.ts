import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

// BullMQ requires maxRetriesPerRequest: null on its connection.
export const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});