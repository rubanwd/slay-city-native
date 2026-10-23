import { AppContainer } from "~/components/layout";
import { FullScreenLoader } from "~/components/ui";

export default function DevLoader() {
  return (
    <AppContainer edges={["top"]}>
      <FullScreenLoader label="Loading map…" />
    </AppContainer>
  );
}
