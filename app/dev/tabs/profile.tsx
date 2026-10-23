import { AppContainer } from "~/components/layout";
import { FullScreenLoader } from "~/components/ui";

export default function DevProfileLoader() {
  return (
    <AppContainer edges={["top"]}>
      <FullScreenLoader label="Loading profile…" />
    </AppContainer>
  );
}
