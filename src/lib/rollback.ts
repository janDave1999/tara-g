import { supabaseAdmin } from "./supabase";

const ROLLBACK_TABLES = {
  trips: "trip_id",
  trip_pickups: "pickup_id",
  trip_budget: "budget_id",
} as const;

export async function rollBack(table: keyof typeof ROLLBACK_TABLES, id: string) {
  const primaryKey = ROLLBACK_TABLES[table];

  const { error } = await supabaseAdmin
    .from(table)
    .delete()
    .eq(primaryKey, id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
