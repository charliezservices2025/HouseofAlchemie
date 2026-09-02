import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { getUnlockedAdvisor } from "@/lib/entitlements";
import { getUsageSnapshot } from "@/lib/usage";
import { db } from "@/lib/db";
import { ChatScreen } from "@/components/chat/chat-screen";
import { loadConversation, toChatAdvisor, toChatUsage } from "@/components/chat/load-chat";

type Params = Promise<{ advisorSlug: string; conversationId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { advisorSlug } = await params;
  const advisor = await db.advisor.findUnique({ where: { slug: advisorSlug }, select: { name: true } });
  return { title: advisor ? `Talk to ${advisor.name}` : "Chat" };
}

/** An existing conversation, scoped to its owner. Anyone else's id lands on a fresh one. */
export default async function ConversationPage({ params }: { params: Params }) {
  const { advisorSlug, conversationId } = await params;
  const user = await requireUser(`/chat/${advisorSlug}/${conversationId}`);

  const access = await getUnlockedAdvisor(user.id, advisorSlug);
  if (!access) redirect(`/advisors#${advisorSlug}`);
  const { advisor, monthlyTokenCap } = access;

  const [usage, conversation] = await Promise.all([
    getUsageSnapshot(user.id, advisor.id, monthlyTokenCap),
    loadConversation(user.id, advisor.id, conversationId),
  ]);
  if (!conversation) redirect(`/chat/${advisorSlug}`);

  return (
    <ChatScreen
      key={conversation.id}
      advisor={toChatAdvisor(advisor)}
      initialMessages={conversation.messages}
      conversationId={conversation.id}
      usage={toChatUsage(usage)}
      aiConfigured={Boolean(process.env.ANTHROPIC_API_KEY)}
      firstMeeting={null}
    />
  );
}
