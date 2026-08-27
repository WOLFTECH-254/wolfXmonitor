import { z } from "zod";

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "Slug: lowercase letters, numbers and dashes only");

// -1 (unlimited) or a positive integer.
const limit = z.number().int().refine((n: number) => n === -1 || n > 0, "Must be a positive number or -1 for unlimited");
const positive = z.number().int().positive();
const money = z.number().nonnegative().max(1_000_000);

export const planCreateSchema = z.object({
  slug,
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(400).default(""),
  priceUsd: money.default(0),
  currency: z.string().trim().length(3).default("USD"),
  billingInterval: z.enum(["monthly", "yearly", "weekly", "quarterly", "biannual"]).default("monthly"),
  durationDays: positive.default(30),
  monitorLimit: limit.default(-1),
  checkIntervalSeconds: positive.max(86_400).default(300),
  retentionDays: positive.max(3650).default(7),
  statusPageLimit: z.number().int().min(-1).default(0),
  teamMemberLimit: z.number().int().min(-1).default(1),
  emailAlerts: z.boolean().default(true),
  webhookAlerts: z.boolean().default(false),
  telegramAlerts: z.boolean().default(false),
  sslMonitoring: z.boolean().default(false),
  isActive: z.boolean().default(true),
  isFree: z.boolean().default(false),
  isUnlimited: z.boolean().default(false),
  isPopular: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

export const planUpdateSchema = planCreateSchema.partial().extend({
  // slug is immutable after creation (it maps to payment products / user rows)
  slug: z.undefined().optional(),
});

export const planStatusSchema = z.object({ isActive: z.boolean() });

export type PlanCreateInput = z.infer<typeof planCreateSchema>;
