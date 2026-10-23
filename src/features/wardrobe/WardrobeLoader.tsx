import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StyleSheet, View } from "react-native";

import { equipWardrobeItem, loadWardrobe, purchaseWardrobeItem, unequipWardrobeItem, type WardrobeItem } from "@slay/data";
import { alpha } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { FullScreenLoader, SlayButton, SlayText } from "~/components/ui";
import { MAP_QUERY_KEY } from "~/features/map";
import { supabase } from "~/lib/supabase";

import { WardrobeScreen, type WardrobeAction } from "./WardrobeScreen";

export const WARDROBE_QUERY_KEY = "wardrobe";

const ACTIONS = {
  buy: purchaseWardrobeItem,
  equip: equipWardrobeItem,
  unequip: unequipWardrobeItem,
} as const;

/**
 * `/wardrobe`: loads the catalog (`loadWardrobe`) and runs the shop. After a
 * change the wardrobe and the map both refetch — the map's mascot marker
 * wears whatever was just put on, so the look matches everywhere it shows.
 */
export function WardrobeLoader() {
  const queryClient = useQueryClient();
  const wardrobe = useQuery({ queryKey: [WARDROBE_QUERY_KEY], queryFn: () => loadWardrobe(supabase) });

  const act = useMutation({
    mutationFn: ({ item, action }: { item: WardrobeItem; action: WardrobeAction }) => ACTIONS[action](supabase, item.id),
    onSuccess: async (result) => {
      if (!result.ok) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [WARDROBE_QUERY_KEY] }),
        queryClient.invalidateQueries({ queryKey: [MAP_QUERY_KEY] }),
      ]);
    },
  });
  const error = act.data && !act.data.ok ? act.data.error : (act.error?.message ?? null);

  if (wardrobe.isPending) {
    return (
      <AppContainer>
        <FullScreenLoader label="Loading wardrobe…" />
      </AppContainer>
    );
  }

  if (wardrobe.isError) {
    return (
      <AppContainer style={styles.center}>
        <View style={styles.message}>
          <SlayText variant="body" color={alpha.white60} style={styles.centerText}>
            Could not load the wardrobe. Check your connection and try again.
          </SlayText>
          <SlayButton loading={wardrobe.isFetching} onPress={() => wardrobe.refetch()}>
            Try again
          </SlayButton>
        </View>
      </AppContainer>
    );
  }

  return (
    <WardrobeScreen
      {...wardrobe.data}
      // Busy until the refetch lands, so a bought item never flickers back to its price.
      pending={act.isPending || (act.isSuccess && wardrobe.isFetching)}
      busyId={act.variables?.item.id ?? null}
      error={error}
      onAction={(item, action) => act.mutate({ item, action })}
      refreshing={wardrobe.isRefetching && !act.isSuccess}
      onRefresh={() => wardrobe.refetch()}
    />
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  message: { width: "100%", gap: 16 },
  centerText: { textAlign: "center" },
});
