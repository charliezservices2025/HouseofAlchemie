import type { MemoryCategory } from "@/generated/prisma/client";

/** Human labels for MemoryCategory, in the order the memory screen shows them. */
export const MEMORY_CATEGORIES: ReadonlyArray<{ value: MemoryCategory; label: string }> = [
  { value: "CLIENT", label: "Clients" },
  { value: "OFFER", label: "Offers" },
  { value: "LAUNCH", label: "Launches" },
  { value: "POSITIONING", label: "Positioning" },
  { value: "GOAL", label: "Goals" },
  { value: "BLOCKER", label: "Blockers" },
  { value: "PREFERENCE", label: "Preferences" },
  { value: "OTHER", label: "Other" },
];

export function categoryLabel(value: string): string {
  return MEMORY_CATEGORIES.find((c) => c.value === value)?.label ?? "Other";
}
