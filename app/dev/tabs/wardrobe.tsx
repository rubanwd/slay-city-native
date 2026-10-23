import { AppContainer } from "~/components/layout";
import { FullScreenLoader } from "~/components/ui";

export default function DevPlainLoader() {
  return (
    <AppContainer edges={["top"]}>
      <FullScreenLoader />
    </AppContainer>
  );
}
