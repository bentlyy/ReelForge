import type { Request, Response, NextFunction } from "express";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(opts: { windowMs: number; max: number }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || "local";
    const now = Date.now();
    const b = buckets.get(key);
    if (!b || now > b.resetAt) { buckets.set(key, { count: 1, resetAt: now + opts.windowMs }); return next(); }
    b.count++;
    if (b.count > opts.max) return res.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many requests" } });
    next();
  };
}
export function _resetRateLimitForTests() { buckets.clear(); }
