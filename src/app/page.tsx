import { ProfileBuilderApp } from "@/components/ProfileBuilderApp";
import { listMessages } from "@/lib/db/messageRepo";
import { loadProfile } from "@/lib/db/profileRepo";
import { buildOpening } from "@/lib/opening";
import { getCompleteness } from "@/lib/profile/completeness";

export const dynamic = "force-dynamic";

export default function Home() {
  const profile = loadProfile();
  const completeness = getCompleteness(profile);
  const messages = listMessages();
  const opening = buildOpening(completeness, messages.length > 0);

  return (
    <ProfileBuilderApp
      initialProfile={profile}
      initialCompleteness={completeness}
      initialMessages={messages}
      opening={opening}
    />
  );
}
