import { Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { cn } from "@/lib/utils";
import type { WhatsAppMessage } from "@/services/WhatsAppService";
import { deliveryMark, fmt, fmtDay } from "./format";
import { KNOWN_TYPES } from "./constants";
import { MediaBubble } from "./MediaBubble";

/**
 * Read-only message history for the open conversation. The scroll container
 * (ai-elements `Conversation`) owns the "land on newest" behaviour; this
 * component only renders rows and the day dividers between them.
 */
export function MessageList({
  messages,
  hasOlder,
  loadingOlder,
  onLoadOlder,
}: {
  messages: WhatsAppMessage[];
  hasOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
}) {
  const { t, i18n } = useTranslation("whatsapp");
  const lang = i18n.language;
  return (
    <Conversation className="wa-wallpaper min-h-0 min-w-0 flex-1">
      <ConversationContent className="min-w-0 gap-1 px-3 py-3 sm:px-8">
        {hasOlder && (
          <div className="flex justify-center">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[11px] text-muted-foreground"
              disabled={loadingOlder}
              onClick={onLoadOlder}
            >
              {loadingOlder
                ? t("conversation.loadingOlder", "Loading…")
                : t("conversation.loadOlder", "Load older messages")}
            </Button>
          </div>
        )}
        {messages.length ? (
          messages.map((m, index) => {
            const previous = index > 0 ? messages[index - 1] : null;
            const newDay =
              !previous ||
              new Date(previous.created_at).toDateString() !==
                new Date(m.created_at).toDateString();
            const body = m.body?.trim();
            const typeLabel = KNOWN_TYPES.includes(m.message_type)
              ? t(`messageType.${m.message_type}`)
              : t("messageType.unknown");
            return (
              <div key={m.id} className="space-y-2">
                {newDay && (
                  <div className="flex justify-center pt-1">
                    <span className="rounded-lg bg-card/90 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">
                      {fmtDay(m.created_at, lang)}
                    </span>
                  </div>
                )}
                <Message
                  from={m.direction === "outbound" ? "user" : "assistant"}
                  className={m.direction === "outbound" ? "ms-auto" : "me-auto"}
                >
                  <MessageContent
                    className={cn(
                      "max-w-[82%] rounded-lg px-2.5 py-1.5 text-[14.5px] leading-snug text-foreground shadow-sm sm:max-w-[65%]",
                      m.direction === "inbound"
                        ? "rounded-ss-none bg-[var(--wa-incoming)]"
                        : "rounded-se-none bg-[var(--wa-outgoing)]",
                    )}
                  >
                    {m.media_url ? (
                      <MediaBubble
                        path={m.media_url}
                        mime={m.media_mime_type}
                        filename={m.media_filename}
                        openLabel={t("conversation.openFile", "Open file")}
                      />
                    ) : (
                      m.message_type !== "text" && (
                        <p className="mb-1 text-xs font-medium opacity-80">
                          {typeLabel}
                        </p>
                      )
                    )}
                    {body ? (
                      <p className="whitespace-pre-wrap">{body}</p>
                    ) : (
                      m.message_type === "text" && (
                        <p className="text-xs italic opacity-70">
                          {t("messageType.unknown")}
                        </p>
                      )
                    )}
                    <span
                      className={cn(
                        "mt-0.5 block text-end text-[10.5px] text-muted-foreground",
                      )}
                    >
                      {fmt(m.created_at, lang)}
                      {m.direction === "outbound" &&
                        (m.is_echo ? (
                          <>
                            {" "}
                            · {t("delivery.fromPhone", "sent from the phone")}
                          </>
                        ) : (
                          <span
                            title={t(
                              `delivery.${m.delivery_status}`,
                              m.delivery_status,
                            )}
                          >
                            {" "}
                            {deliveryMark(m.delivery_status)}
                          </span>
                        ))}
                    </span>
                  </MessageContent>
                </Message>
              </div>
            );
          })
        ) : (
          <ConversationEmptyState
            title={t("conversation.noMessages")}
            description={t("empty.description")}
            icon={<Inbox className="h-8 w-8" />}
          />
        )}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
