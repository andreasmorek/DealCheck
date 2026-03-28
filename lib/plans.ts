export type PlanName = "free" | "pro";

export const PLAN_LIMITS: Record<PlanName, number> = {
  free: 3,
  pro: 50,
};

export function normalizePlan(plan?: string | null): PlanName {
  if (plan === "pro") return "pro";
  return "free";
}

export function getPlanLimit(plan?: string | null) {
  return PLAN_LIMITS[normalizePlan(plan)];
}