import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

/**
 * The checklist → documents contract.
 *
 * Tapping a checklist item must open a popup that collects the requested
 * document; confirming it must (a) upload the file, (b) write a `documents`
 * row, and (c) mark the item done. The `documents` row is what makes the file
 * appear on the Documents page, so these assertions are about the single shared
 * write path (`uploadStudentDocument`) rather than about the popup's markup.
 *
 * The Documents-page half of the same contract is asserted at the bottom: it
 * reads the identical table, so a row written here is what it renders.
 */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) =>
      typeof fallback === "string" ? fallback : key,
    i18n: { language: "en" },
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const CHECKLIST_ITEMS = [
  { id: "item-passport", item_name: "Passport", description: "Valid passport copy", sort_order: 1 },
  { id: "item-insurance", item_name: "Health insurance", description: null, sort_order: 2 },
];

// Mutable tables so each test can set the starting state.
const TABLES: Record<string, any[]> = {
  checklist_items: [],
  student_checklist: [],
  documents: [],
};

const inserts: Record<string, any[]> = { documents: [], student_checklist: [] };
const upserts: Record<string, any[]> = { student_checklist: [] };
const uploads: Array<{ bucket: string; path: string; file: any }> = [];

vi.mock("@/integrations/supabase/client", () => {
  const makeQuery = (table: string) => {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      not: () => chain,
      order: () => chain,
      limit: () => chain,
      then: (resolve: any) =>
        Promise.resolve({ data: TABLES[table] ?? [], error: null }).then(resolve),
    };
    return chain;
  };

  const client = {
    from: (table: string) => ({
      ...makeQuery(table),
      insert: (row: any) => {
        (inserts[table] ||= []).push(row);
        const result = { data: { ...row, id: `doc-${inserts[table].length}` }, error: null };
        return {
          select: () => ({ single: () => Promise.resolve(result) }),
          then: (resolve: any) => Promise.resolve(result).then(resolve),
        };
      },
      upsert: (row: any) => {
        (upserts[table] ||= []).push(row);
        return Promise.resolve({ data: row, error: null });
      },
      update: (patch: any) => ({
        eq: () => Promise.resolve({ data: patch, error: null }),
      }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
    storage: {
      from: (bucket: string) => ({
        upload: (path: string, file: any) => {
          uploads.push({ bucket, path, file });
          return Promise.resolve({ data: { path }, error: null });
        },
        remove: () => Promise.resolve({ error: null }),
        createSignedUrl: () => Promise.resolve({ data: { signedUrl: "https://x/y" }, error: null }),
      }),
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
  };
  return { supabase: client };
});

import ChecklistTracker from "../ChecklistTracker";
import DocumentsManager from "../DocumentsManager";

const STUDENT_ID = "student-1";

const chooseFile = (name = "passport.pdf") => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(["scan"], name, { type: "application/pdf" });
  fireEvent.change(input, { target: { files: [file] } });
};

describe("checklist item upload popup", () => {
  beforeEach(() => {
    TABLES.checklist_items = CHECKLIST_ITEMS.map((i) => ({ ...i }));
    TABLES.student_checklist = [];
    TABLES.documents = [];
    inserts.documents = [];
    inserts.student_checklist = [];
    upserts.student_checklist = [];
    uploads.length = 0;
  });

  it("opens a popup with an upload field when an item is tapped", async () => {
    render(<ChecklistTracker userId={STUDENT_ID} />);
    await waitFor(() => expect(screen.getByText("Passport")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Passport"));

    await waitFor(() => expect(screen.getByText("Confirm & mark as done")).toBeInTheDocument());
    expect(document.querySelector('input[type="file"]')).toBeTruthy();
  });

  it("cannot confirm without choosing a file", async () => {
    render(<ChecklistTracker userId={STUDENT_ID} />);
    await waitFor(() => expect(screen.getByText("Passport")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Passport"));
    await waitFor(() => expect(screen.getByText("Confirm & mark as done")).toBeInTheDocument());

    const confirm = screen.getByText("Confirm & mark as done").closest("button")!;
    expect(confirm).toBeDisabled();
    expect(uploads).toHaveLength(0);
  });

  it("uploads the file, writes a documents row, and marks the item done on confirm", async () => {
    render(<ChecklistTracker userId={STUDENT_ID} />);
    await waitFor(() => expect(screen.getByText("Passport")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Passport"));
    await waitFor(() => expect(screen.getByText("Confirm & mark as done")).toBeInTheDocument());

    chooseFile("passport.pdf");
    await waitFor(() =>
      expect(screen.getByText("Confirm & mark as done").closest("button")).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByText("Confirm & mark as done"));

    // (a) the file reached the private bucket, under the student's own folder
    await waitFor(() => expect(uploads).toHaveLength(1));
    expect(uploads[0].bucket).toBe("student-documents");
    expect(uploads[0].path.startsWith(`${STUDENT_ID}/`)).toBe(true);

    // (b) a documents row was written, linked to the checklist item — this is
    // what makes the file render on the Documents page
    await waitFor(() => expect(inserts.documents).toHaveLength(1));
    const row = inserts.documents[0];
    expect(row.student_id).toBe(STUDENT_ID);
    expect(row.checklist_item_id).toBe("item-passport");
    expect(row.file_url.startsWith(`${STUDENT_ID}/`)).toBe(true);

    // (c) the item is marked complete
    await waitFor(() => expect(upserts.student_checklist).toHaveLength(1));
    expect(upserts.student_checklist[0]).toMatchObject({
      student_id: STUDENT_ID,
      checklist_item_id: "item-passport",
      is_completed: true,
    });
  });

  it("sends an already-uploaded item down the uncheck path, not the upload path", async () => {
    TABLES.student_checklist = [
      { id: "sc-1", student_id: STUDENT_ID, checklist_item_id: "item-passport", is_completed: true, completed_at: "2026-09-01T00:00:00Z" },
    ];
    TABLES.documents = [
      { id: "doc-9", file_name: "Passport Scan", checklist_item_id: "item-passport", student_id: STUDENT_ID },
    ];

    render(<ChecklistTracker userId={STUDENT_ID} />);
    await waitFor(() => expect(screen.getByText("Passport")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Passport"));

    await waitFor(() => expect(screen.getByText("Uncheck item")).toBeInTheDocument());
    expect(screen.queryByText("Confirm & mark as done")).toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("shows the attached document name on the item row", async () => {
    TABLES.documents = [
      { id: "doc-9", file_name: "My Passport Scan", checklist_item_id: "item-passport", student_id: STUDENT_ID },
    ];

    render(<ChecklistTracker userId={STUDENT_ID} />);

    await waitFor(() => expect(screen.getByText("My Passport Scan")).toBeInTheDocument());
  });
});

describe("documents page renders a checklist upload", () => {
  beforeEach(() => {
    TABLES.documents = [
      {
        id: "doc-1",
        student_id: STUDENT_ID,
        file_name: "Passport",
        file_url: `${STUDENT_ID}/123.pdf`,
        file_size: 2048,
        file_type: "application/pdf",
        category: "other",
        notes: null,
        created_at: "2026-09-30T10:00:00Z",
        checklist_item_id: "item-passport",
      },
    ];
  });

  it("renders a document that was uploaded from the checklist", async () => {
    render(<DocumentsManager userId={STUDENT_ID} />);

    // The Documents page reads the same `documents` table the popup writes, so
    // a checklist upload appears here with no extra wiring.
    await waitFor(() => expect(screen.getByText("Passport")).toBeInTheDocument());
  });
});
