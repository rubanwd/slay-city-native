import { AppContainer } from "~/components/layout";
import { FullScreenLoader } from "~/components/ui";

export default function DevConsoleLoader() {
  return (
    <AppContainer edges={["top"]}>
      <FullScreenLoader label="Loading dashboard…" mascot={false} />
    </AppContainer>
  );
}
