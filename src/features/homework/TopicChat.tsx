import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { deleteTopicMessage, getTopicMessages, markTopicRead, postTopicMessage, type TopicMessage } from "@slay/data";
import { alpha, colors, fontFamilyByWeight, radii, typeScale, withAlpha } from "@slay/tokens";

import { SlayButton, SlayPressable, SlayText } from "~/components/ui";
import { useAppActive } from "~/hooks/useAppStateAwareInterval";
import { supabase } from "~/lib/supabase";

/** Longest a single message may be — upstream's `MAX_BODY_LENGTH`, which the database re-checks. */
const MAX_BODY_LENGTH = 2000;
/** How many of the latest messages show; "Show earlier" adds this many more. */
const THREAD_PAGE = 50;

export interface TopicChatProps {
  topicId: string;
  /** The signed-in user — their messages sit on the right and can be deleted. */
  currentUserId: string;
  /** The thread as loaded with the topic, kept fresh afterwards. */
  initialMessages: TopicMessage[];
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Port of upstream's `qa/TopicChat.tsx`: a topic's shared Q&A thread between a
 * group's students and their teacher. Opening it marks it read, clearing the
 * topic's unread badge; a Supabase Realtime subscription refetches the thread
 * on any change, through `get_topic_messages` (the only source of authors'
 * usernames). Posts and deletes go through the `post_topic_message` and
 * `delete_topic_message` RPCs.
 *
 * On a phone: the web's hover-only delete × becomes a long-press on your own
 * message, with a confirmation; Return makes a new line and Send sends; and
 * coming back to the app refetches, in case a message arrived while the
 * socket slept.
 */
export function TopicChat({ topicId, currentUserId, initialMessages }: TopicChatProps) {
  const [messages, setMessages] = useState<TopicMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const list = useRef<ScrollView>(null);
  // Only the latest messages render: the thread sits in a scrolling screen, where
  // a virtualised list can't, so a long thread is paged instead (WP-6.5).
  const [shown, setShown] = useState(THREAD_PAGE);
  const hidden = Math.max(0, messages.length - shown);
  const active = useAppActive();

  const refetch = useCallback(async () => {
    setMessages(await getTopicMessages(supabase, topicId));
  }, [topicId]);

  // Opening the thread counts as reading it.
  useEffect(() => {
    void markTopicRead(supabase, topicId);
  }, [topicId]);

  useEffect(() => {
    const channel = supabase
      .channel(`topic-qa-${topicId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "homework_topic_messages", filter: `topic_id=eq.${topicId}` },
        () => {
          void refetch();
          void markTopicRead(supabase, topicId);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [topicId, refetch]);

  // Back from the background: anything posted meanwhile, and it has now been read.
  const wasActive = useRef(active);
  useEffect(() => {
    if (active && !wasActive.current) {
      void refetch();
      void markTopicRead(supabase, topicId);
    }
    wasActive.current = active;
  }, [active, refetch, topicId]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    if (body.length > MAX_BODY_LENGTH) {
      setError(`Message must be ${MAX_BODY_LENGTH} characters or fewer.`);
      return;
    }
    setError(null);
    setSending(true);
    const result = await postTopicMessage(supabase, topicId, body);
    setSending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDraft("");
    await refetch();
  };

  const remove = (message: TopicMessage) => {
    Alert.alert("Delete this message?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const result = await deleteTopicMessage(supabase, message.id);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          await refetch();
        },
      },
    ]);
  };

  return (
    <View style={styles.box}>
      <ScrollView
        ref={list}
        style={styles.thread}
        contentContainerStyle={styles.threadContent}
        nestedScrollEnabled
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
      >
        {messages.length === 0 ? (
          <SlayText variant="small" color={alpha.white50} style={styles.center}>
            No messages yet. Ask a question or leave a note — everyone in the group will see it.
          </SlayText>
        ) : (
          <>
            {hidden > 0 ? (
              <SlayPressable
                accessibilityRole="button"
                onPress={() => setShown((count) => count + THREAD_PAGE)}
                style={styles.earlier}
              >
                <SlayText variant="label" weight="700" color={colors.cyan}>
                  {`Show earlier messages (${hidden})`}
                </SlayText>
              </SlayPressable>
            ) : null}
            {messages.slice(hidden).map((m) => {
              const mine = m.authorId === currentUserId;
              const author = mine ? "You" : m.authorUsername;
              return (
                <View key={m.id} style={[styles.message, mine ? styles.mine : styles.theirs]}>
                  <View style={styles.meta}>
                    <SlayText variant="label" weight="700" color={alpha.white50} style={styles.metaText}>
                      {author}
                    </SlayText>
                    {m.authorIsTeacher ? (
                      <View style={styles.teacher}>
                        <SlayText variant="label" weight="700" color={colors.neonPink} style={styles.teacherText}>
                          Teacher
                        </SlayText>
                      </View>
                    ) : null}
                    <SlayText variant="label" color={alpha.white50} style={styles.metaText}>
                      {formatTime(m.createdAt)}
                    </SlayText>
                  </View>
                  <SlayPressable
                    accessibilityRole={mine ? "button" : undefined}
                    accessibilityLabel={`${author}: ${m.body}`}
                    accessibilityHint={mine ? "Long-press to delete" : undefined}
                    disabled={!mine}
                    onLongPress={mine ? () => remove(m) : undefined}
                    style={[styles.bubble, mine ? styles.bubbleMine : m.authorIsTeacher ? styles.bubbleTeacher : styles.bubbleTheirs]}
                  >
                    <SlayText variant="small" color={mine || m.authorIsTeacher ? colors.white : alpha.white80}>
                      {m.body}
                    </SlayText>
                  </SlayPressable>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      {error ? (
        <SlayText variant="small" color={colors.neonPink} accessibilityRole="alert">
          {error}
        </SlayText>
      ) : null}

      <View style={styles.composer}>
        <TextInput
          maxFontSizeMultiplier={1.5}
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a message…"
          placeholderTextColor={alpha.white50}
          selectionColor={colors.neonPink}
          accessibilityLabel="Message"
          multiline
          maxLength={MAX_BODY_LENGTH}
          style={styles.input}
        />
        <SlayButton variant="green" size="sm" loading={sending} disabled={!draft.trim()} onPress={send}>
          Send
        </SlayButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  earlier: { alignSelf: "center", paddingVertical: 8, paddingHorizontal: 12 },
  box: {
    gap: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: alpha.white10,
    backgroundColor: colors.surface,
    padding: 12,
  },
  thread: { maxHeight: 288, minHeight: 96 },
  threadContent: { flexGrow: 1, justifyContent: "flex-end", gap: 8, padding: 4 },
  center: { textAlign: "center" },
  message: { maxWidth: "85%", gap: 2 },
  mine: { alignSelf: "flex-end", alignItems: "flex-end" },
  theirs: { alignSelf: "flex-start", alignItems: "flex-start" },
  meta: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 4 },
  metaText: { textTransform: "none", letterSpacing: 0 },
  teacher: { borderRadius: 999, backgroundColor: withAlpha(colors.neonPink, 0.2), paddingHorizontal: 6, paddingVertical: 1 },
  teacherText: { fontSize: 9 },
  bubble: { borderRadius: radii.lg, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMine: { backgroundColor: withAlpha(colors.cyan, 0.15) },
  bubbleTeacher: { backgroundColor: withAlpha(colors.neonPink, 0.1) },
  bubbleTheirs: { backgroundColor: alpha.white5 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 128,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: alpha.white20,
    backgroundColor: alpha.white10,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    color: colors.white,
    fontFamily: fontFamilyByWeight["400"],
    fontSize: typeScale.small.max,
  },
});
