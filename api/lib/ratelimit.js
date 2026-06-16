import { Redis } from '@upstash/redis';

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Returns true if the request is within the allowed window, false if rate-limited.
export async function checkRateLimit(userId, endpoint, limit = 30, windowSecs = 60) {
  const bucket = Math.floor(Date.now() / (windowSecs * 1000));
  const key    = `rl:${endpoint}:${userId}:${bucket}`;
  const count  = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSecs + 5);
  return count <= limit;
}

// Returns the current daily token usage for a user (0 if none).
export async function getTokenBudget(userId) {
  const key = dailyBudgetKey(userId);
  const used = await redis.get(key);
  return Number(used) || 0;
}

// Increments the daily token counter; self-cleans after 48h.
export async function incrementTokenBudget(userId, tokens) {
  const key = dailyBudgetKey(userId);
  await redis.incrby(key, tokens);
  await redis.expire(key, 172800); // 48h TTL
}

function dailyBudgetKey(userId) {
  return `groq:budget:${userId}:${new Date().toISOString().slice(0, 10)}`;
}

export { redis };
