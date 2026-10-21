export const PLANS = {
  free: { name: "Free", price: 0, docsPerMonth: 20 },
  starter: { name: "Starter", price: 9, docsPerMonth: 300 },
  pro: { name: "Pro", price: 19, docsPerMonth: Infinity },
} as const;
export type PlanKey = keyof typeof PLANS;
export const STARTER = "Starter";
export const PRO = "Pro";

export function planFromSubscriptions(subs: { name: string }[]): PlanKey {
  if (subs.some((s) => s.name === PRO)) return "pro";
  if (subs.some((s) => s.name === STARTER)) return "starter";
  return "free";
}
export function monthStart(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
