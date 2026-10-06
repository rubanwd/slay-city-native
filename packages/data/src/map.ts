import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@slay/core/types";

/**
 * Moves a location's label to a new spot on the city map.
 *
 * Coordinates are percentages of the map frame — the same space the admin
 * position picker and both maps use — so wherever the teacher taps is exactly
 * where students will see the label.
 *
 * Who may do this is decided in the database (`set_location_map_position`
 * accepts teachers and admins only); this wrapper just carries the tap
 * across.
 */
export async function moveLocationOnMap(
  db: SupabaseClient<Database>,
  locationId: string,
  mapX: number,
  mapY: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Number.isFinite(mapX) || !Number.isFinite(mapY)) {
    return { ok: false, error: "That spot is off the map." };
  }

  const { error } = await db.rpc("set_location_map_position", {
    p_location_id: locationId,
    p_map_x: mapX,
    p_map_y: mapY,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
