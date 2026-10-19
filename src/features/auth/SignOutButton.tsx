import { useMutation } from "@tanstack/react-query";

import { signOut } from "@slay/data";

import { SlayButton } from "~/components/ui";
import { supabase } from "~/lib/supabase";

/** Signs out; the route guard then takes the user to login. */
export function SignOutButton() {
  const submit = useMutation({ mutationFn: () => signOut(supabase) });

  return (
    <SlayButton variant="ghost" loading={submit.isPending} onPress={() => submit.mutate()}>
      Log Out
    </SlayButton>
  );
}
