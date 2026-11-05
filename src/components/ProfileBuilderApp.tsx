"use client";

import { useCallback } from "react";
import { AppHeader, EssentialsProgress } from "@/components/AppHeader";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ProfilePanel } from "@/components/profile/ProfilePanel";
import { StartOverButton } from "@/components/StartOverButton";
import { Toast } from "@/components/ui/feedback";
import { useChat } from "@/hooks/useChat";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/useToast";
import type { ChatMessage } from "@/lib/chat/types";
import type { Completeness } from "@/lib/profile/completeness";
import type { UserProfile } from "@/lib/profile/schema";

interface Props {
  initialProfile: UserProfile;
  initialCompleteness: Completeness;
  initialMessages: ChatMessage[];
  opening: string;
}

export function ProfileBuilderApp({ initialProfile, initialCompleteness, initialMessages, opening }: Props) {
  const { toast, show, dismiss } = useToast();

  const onRejectFailed = useCallback(
    (label: string, retry: () => void) =>
      show(`Couldn't remove “${label}”. Your profile wasn't changed.`, { label: "Try again", onClick: retry }),
    [show],
  );

  const profile = useProfile({ profile: initialProfile, completeness: initialCompleteness }, onRejectFailed);
  const chat = useChat({ initialMessages, opening, onProfile: profile.applyServerSnapshot });

  const startOver = useCallback(async () => {
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        show(`Couldn't start over. Try again.${body.detail ? ` (${body.detail})` : ""}`);
        return;
      }
      // Reload so the server renders the fresh, blank state with the opening greeting.
      window.location.reload();
    } catch {
      show("Couldn't start over. Check that the server is running, then try again.");
    }
  }, [show]);

  return (
    <div className="flex h-screen flex-col">
      <AppHeader
        progress={<EssentialsProgress done={profile.completeness.done} total={profile.completeness.total} />}
        actions={<StartOverButton disabled={chat.status === "streaming"} onConfirm={startOver} />}
      />
      <div className="relative flex min-h-0 flex-1">
        <Toast toast={toast} onDismiss={dismiss} />
        <ChatPanel
          messages={chat.messages}
          status={chat.status}
          onSend={chat.send}
          onStop={chat.stop}
          onRetry={chat.retry}
        />
        <ProfilePanel
          profile={profile.profile}
          completeness={profile.completeness}
          highlighted={profile.highlighted}
          onReject={profile.reject}
        />
      </div>
    </div>
  );
}
