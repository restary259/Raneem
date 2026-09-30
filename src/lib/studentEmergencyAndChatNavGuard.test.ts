import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.resolve(SRC, rel), "utf8");

const EMERGENCY = read("components/student/EmergencyCallCard.tsx");
const OVERVIEW = read("components/student/StudentOverviewSection.tsx");
const MESSAGES = read("pages/messages/StudentMessagesPage.tsx");

/** Numbers the card must offer as direct dial links. */
const EMERGENCY_NUMBERS = ["110", "112"];

describe("Emergency call card dials directly instead of opening a chat", () => {
  it("links police/ambulance/fire with tel: hrefs", () => {
    for (const number of EMERGENCY_NUMBERS) {
      expect(EMERGENCY).toContain(`number: "${number}"`);
    }
    expect(EMERGENCY).toContain("href={`tel:${number}`}");
  });

  it("uses fixed national numbers, not the Darb contact config", () => {
    // A crisis number must never be sourced from `important_contacts` / the
    // business contact config — those hold Darb's own details.
    expect(EMERGENCY).not.toContain('from "@/lib/contactConfig"');
    expect(EMERGENCY).not.toContain("get_student_important_contacts");
  });

  it("never routes an emergency entry to the chat/messages page", () => {
    expect(EMERGENCY).not.toContain("/student/messages");
    expect(EMERGENCY).not.toContain("navigate(");
  });

  it("is rendered full-width on the dashboard, not as a 1/3 grid tile", () => {
    expect(OVERVIEW).toContain("<EmergencyCallCard />");
    // it must NOT be part of the quickActions array
    const quickActions = OVERVIEW.slice(
      OVERVIEW.indexOf("const quickActions = ["),
      OVERVIEW.indexOf("];", OVERVIEW.indexOf("const quickActions = [")),
    );
    expect(quickActions).not.toContain("EmergencyCallCard");
  });
});

describe("Student dashboard quick actions", () => {
  it("routes a tile to Messages and no longer duplicates Contacts", () => {
    expect(OVERVIEW).toContain('href: "/student/messages"');
    expect(OVERVIEW).not.toContain('href: "/student/contacts"');
  });

  it("keeps the important-contacts card as the single Contacts surface", () => {
    expect(OVERVIEW).toContain("get_student_important_contacts");
    expect(OVERVIEW).toContain('navigate("/student/contacts")');
  });
});

describe("Student chat box has a back arrow to the conversation list", () => {
  it("renders a back button whose handler leaves the open chat", () => {
    expect(MESSAGES).toContain('aria-label={t("chat.backToChats"');
    expect(MESSAGES).toContain("onClick={backToList}");
    expect(MESSAGES).toMatch(/const backToList = \(\) => setOpen\(null\)/);
  });

  it("keeps the emergency dial buttons reachable inside the chat box", () => {
    expect(MESSAGES).toContain('from "@/components/student/EmergencyCallCard"');
    expect(MESSAGES).toContain("<EmergencyNumberButtons />");
  });

  it("flips the arrow direction in RTL instead of hardcoding a side", () => {
    expect(MESSAGES).toContain(
      "const BackIcon = isRtl ? ArrowRight : ArrowLeft",
    );
    expect(MESSAGES).not.toMatch(/className="[^"]*\b(left|right)-\d/);
  });

  it("still opens a conversation from the list into the chat box", () => {
    expect(MESSAGES).toContain("<ThreadList");
    expect(MESSAGES).toContain("onSelect={openFromItem}");
    expect(MESSAGES).toContain("setOpen({ tab, id, title: item.title })");
  });
});
