import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { getUnlockedAdvisor } from "@/lib/entitlements";
import { getUsageSnapshot } from "@/lib/usage";
import { db } from "@/lib/db";
import { ChatScreen } from "@/components/chat/chat-screen";
import { loadFirstMeeting, toChatAdvisor, toChatUsage } from "@/components/chat/load-chat";

type Params = Promise<{ advisorSlug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { advisorSlug } = await params;
  const advisor = await db.advisor.findUnique({ where: { slug: advisorSlug }, select: { name: true } });
  return { title: advisor ? `Talk to ${advisor.name}` : "Chat" };
}

/** A brand new conversation. The route creates the row on the first message. */
export default async function NewConversationPage({ params }: { params: Params }) {
  const { advisorSlug } = await params;
  const user = await requireUser(`/chat/${advisorSlug}`);

  const access = await getUnlockedAdvisor(user.id, advisorSlug);
  if (!access) redirect(`/advisors#${advisorSlug}`);
  const { advisor, monthlyTokenCap } = access;

  const [usage, firstMeeting] = await Promise.all([
    getUsageSnapshot(user.id, advisor.id, monthlyTokenCap),
    loadFirstMeeting(user.id, advisor),
  ]);

  return (
    <ChatScreen
      key={advisor.slug}
      advisor={toChatAdvisor(advisor)}
      initialMessages={[]}
      conversationId={null}
      usage={toChatUsage(usage)}
      aiConfigured={Boolean(process.env.ANTHROPIC_API_KEY)}
      firstMeeting={firstMeeting}
    />
  );
}
