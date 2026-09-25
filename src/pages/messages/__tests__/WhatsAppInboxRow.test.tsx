import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { ConversationRow } from "../WhatsAppInboxPage";
import type { WhatsAppThread } from "@/services/WhatsAppService";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: unknown) =>
      typeof fallback === "string" ? fallback : _k,
  }),
}));

const baseThread = (over: Partial<WhatsAppThread> = {}): WhatsAppThread =>
  ({
    id: "c1",
    last_message_preview: "Hello there",
    last_inbound_at: new Date().toISOString(),
    last_outbound_at: null,
    unread_count: 0,
    priority: "normal",
    lead: {
      id: "l1",
      whatsapp_number: "972529402168",
      student_name: "Raneem",
      lead_stage: "contacted",
    },
    ...over,
  }) as unknown as WhatsAppThread;

describe("ConversationRow (rebuilt inbox)", () => {
  it("renders name, preview, time and pipeline stage label", () => {
    render(
      <ConversationRow
        thread={baseThread()}
        active={false}
        simplified={false}
        now={Date.now()}
        lang="en"
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("Raneem")).toBeInTheDocument();
    expect(screen.getByText("Hello there")).toBeInTheDocument();
    // Pipeline stage label (Contacted) comes from the shared stage source
    expect(screen.getByText("Contacted")).toBeInTheDocument();
  });

  it("shows unread count and marks the row active with the brand edge", () => {
    const { container } = render(
      <ConversationRow
        thread={baseThread({ unread_count: 3 })}
        active
        simplified={false}
        now={Date.now()}
        lang="en"
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(container.querySelector(".bg-brand")).toBeTruthy();
  });

  it("falls back to the phone number and 'No name yet' when unnamed", () => {
    render(
      <ConversationRow
        thread={baseThread({
          lead: {
            id: "l2",
            whatsapp_number: "972500000000",
            student_name: null,
            lead_stage: "new",
          },
        } as unknown as Partial<WhatsAppThread>)}
        active={false}
        simplified={false}
        now={Date.now()}
        lang="en"
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("972500000000")).toBeInTheDocument();
    expect(screen.getByText("No name yet")).toBeInTheDocument();
  });

  it("fires onSelect when clicked", async () => {
    const onSelect = vi.fn();
    render(
      <ConversationRow
        thread={baseThread()}
        active={false}
        simplified
        now={Date.now()}
        lang="ar"
        onSelect={onSelect}
      />,
    );
    screen.getByRole("button").click();
    expect(onSelect).toHaveBeenCalledOnce();
  });
});
