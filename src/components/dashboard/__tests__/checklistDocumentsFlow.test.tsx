import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within, act } from "@testing-library/react";

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
/** Set to an error to make the next checklist upsert/update fail. */
let failChecklistWrite: Error | null = null;
/** When set, storage uploads hang until `resolve()` so in-flight state is observable. */
let holdUpload: { promise: Promise<void>; resolve: () => void } | null = null;

vi.mock("@/integrations/supabase/client", () => {
  const makeQuery = (table: string) => {
    const filters: Array<(row: any) => boolean> = [];
    let orderBy: { col: string; ascending: boolean } | null = null;
    const chain: any = {
      select: () => chain,
      eq: (col: string, val: any) => {
        filters.push((r) => r[col] === val);
        return chain;
      },
      not: (col: string, op: string) => {
        if (op === "is") filters.push((r) => r[col] !== null && r[col] !== undefined);
        return chain;
      },
      is: (col: string, val: any) => {
        filters.push((r) => (r[col] ?? null) === val);
        return chain;
      },
      // Implemented for real: the tracker relies on newest-first ordering to
      // pick a replacement upload over the original, so a no-op `order` would
      // make that behaviour untestable.
      order: (col: string, opts?: { ascending?: boolean }) => {
        orderBy = { col, ascending: opts?.ascending ?? true };
        return chain;
      },
      limit: () => chain,
      // Writes persist into TABLES so a following read sees them — a test that
      // only records calls can pass while the refreshed UI still renders the
      // old state.
      then: (resolve: any) => {
        let rows = (TABLES[table] ?? []).filter((r) => filters.every((f) => f(r)));
        if (orderBy) {
          const { col, ascending } = orderBy;
          rows = [...rows].sort((a, b) => {
            const av = a[col] ?? "";
            const bv = b[col] ?? "";
            if (av === bv) return 0;
            return (av > bv ? 1 : -1) * (ascending ? 1 : -1);
          });
        }
        return Promise.resolve({ data: rows, error: null }).then(resolve);
      },
    };
    return chain;
  };

  const client = {
    from: (table: string) => ({
      ...makeQuery(table),
      insert: (row: any) => {
        (inserts[table] ||= []).push(row);
        const stored = { ...row, id: `doc-${inserts[table].length}` };
        (TABLES[table] ||= []).push(stored);
        const result = { data: stored, error: null };
        return {
          select: () => ({ single: () => Promise.resolve(result) }),
          then: (resolve: any) => Promise.resolve(result).then(resolve),
        };
      },
      upsert: (row: any) => {
        (upserts[table] ||= []).push(row);
        if (table === "student_checklist" && failChecklistWrite) {
          return Promise.resolve({ data: null, error: failChecklistWrite });
        }
        const list = (TABLES[table] ||= []);
        const idx = list.findIndex(
          (r) => r.student_id === row.student_id && r.checklist_item_id === row.checklist_item_id,
        );
        if (idx >= 0) list[idx] = { ...list[idx], ...row };
        else list.push({ id: `sc-${list.length + 1}`, ...row });
        return Promise.resolve({ data: row, error: null });
      },
      update: (patch: any) => ({
        eq: (col: string, val: any) => {
          if (table === "student_checklist" && failChecklistWrite) {
            return Promise.resolve({ data: null, error: failChecklistWrite });
          }
          const list = (TABLES[table] ||= []);
          list.forEach((r, i) => {
            if (r[col] === val) list[i] = { ...r, ...patch };
          });
          return Promise.resolve({ data: patch, error: null });
        },
      }),
      delete: () => ({
        eq: (col: string, val: any) => {
          TABLES[table] = (TABLES[table] ?? []).filter((r) => r[col] !== val);
          return Promise.resolve({ error: null });
        },
      }),
    }),
    storage: {
      from: (bucket: string) => ({
        upload: (path: string, file: any) => {
          uploads.push({ bucket, path, file });
          const done = { data: { path }, error: null };
          return holdUpload ? holdUpload.promise.then(() => done) : Promise.resolve(done);
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
import ChecklistItemUploadDialog from "../ChecklistItemUploadDialog";

const STUDENT_ID = "student-1";

/**
 * The row checkbox belonging to a checklist item. The Checkbox primitive takes
 * no accessible name (its label is a sibling paragraph), so resolve it through
 * the row that contains the item's text. Scoped to the match whose row actually
 * holds a checkbox, so the open dialog's own title text cannot be mistaken for
 * the list row.
 */
const rowFor = (itemName: string): HTMLElement => {
  for (const node of screen.getAllByText(itemName)) {
    const row = node.closest('[class*="rounded"]') as HTMLElement | null;
    if (row?.querySelector('[role="checkbox"]')) return row;
  }
  throw new Error(`no checklist row found for item "${itemName}"`);
};

const checkboxFor = (itemName: string): HTMLElement =>
  rowFor(itemName).querySelector('[role="checkbox"]') as HTMLElement;

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
    failChecklistWrite = null;
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

    // (c) the item is marked complete in the persisted table...
    await waitFor(() => expect(upserts.student_checklist).toHaveLength(1));
    expect(upserts.student_checklist[0]).toMatchObject({
      student_id: STUDENT_ID,
      checklist_item_id: "item-passport",
      is_completed: true,
    });

    // ...and the refreshed UI actually renders that resulting state: the item's
    // own checkbox is checked and its attached-file line shows the upload.
    await waitFor(() => expect(checkboxFor("Passport")).toHaveAttribute("data-state", "checked"));
    const itemRow = rowFor("Passport");
    expect(within(itemRow).getAllByText("Passport")).toHaveLength(2);
    expect(itemRow.querySelector("svg.lucide-paperclip")).toBeTruthy();
  });

  it("rolls the upload back when the completion write fails", async () => {
    render(<ChecklistTracker userId={STUDENT_ID} />);
    await waitFor(() => expect(screen.getByText("Passport")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Passport"));
    await waitFor(() => expect(screen.getByText("Confirm & mark as done")).toBeInTheDocument());

    failChecklistWrite = new Error("completion write rejected");
    chooseFile("passport.pdf");
    await waitFor(() =>
      expect(screen.getByText("Confirm & mark as done").closest("button")).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByText("Confirm & mark as done"));

    // The uploaded file must not survive a failed completion: otherwise the
    // student sees it on the Documents page with the item still incomplete, and
    // retrying would upload a second copy.
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("completion write rejected"));
    await waitFor(() => expect(TABLES.documents).toHaveLength(0));
  });

  it("sends an already-uploaded item down the uncheck path, not the upload path", async () => {
    TABLES.student_checklist = [
      { id: "sc-1", student_id: STUDENT_ID, checklist_item_id: "item-passport", is_completed: true, completed_at: "2026-09-01T00:00:00Z" },
    ];
    TABLES.documents = [
      { id: "doc-9", file_name: "Passport Scan", checklist_item_id: "item-passport", student_id: STUDENT_ID, created_at: "2026-09-01T00:00:00Z" },
    ];

    render(<ChecklistTracker userId={STUDENT_ID} />);
    await waitFor(() => expect(screen.getByText("Passport")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Passport"));

    await waitFor(() => expect(screen.getByText("Uncheck item")).toBeInTheDocument());
    expect(screen.queryByText("Confirm & mark as done")).toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();

    // Clicking it actually unchecks, and the row renders unchecked afterwards.
    fireEvent.click(screen.getByText("Uncheck item"));
    await waitFor(() =>
      expect(TABLES.student_checklist[0]).toMatchObject({ is_completed: false, completed_at: null }),
    );
    await waitFor(() => expect(checkboxFor("Passport")).toHaveAttribute("data-state", "unchecked"));

    // The uploaded file is untouched by an uncheck.
    expect(TABLES.documents).toHaveLength(1);
  });

  it("fires one upload when Confirm is double-tapped", async () => {
    render(<ChecklistTracker userId={STUDENT_ID} />);
    await waitFor(() => expect(screen.getByText("Passport")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Passport"));
    await waitFor(() => expect(screen.getByText("Confirm & mark as done")).toBeInTheDocument());

    chooseFile("passport.pdf");
    await waitFor(() =>
      expect(screen.getByText("Confirm & mark as done").closest("button")).not.toBeDisabled(),
    );

    const confirm = screen.getByText("Confirm & mark as done").closest("button")!;

    // Both taps are dispatched inside ONE act() scope. That matters: a plain
    // fireEvent pair flushes between clicks, React commits `isSaving`, and the
    // second click hits a *disabled* button — so the test would pass without the
    // ref guard and prove nothing. Dispatching both in a single batch is the
    // same-tick case the guard exists for: `isSaving` is still uncommitted, so
    // only the synchronous ref stops the second upload.
    act(() => {
      confirm.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      confirm.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(inserts.documents).toHaveLength(1));
    expect(uploads).toHaveLength(1);
  });

  it("shows the attached document name on the item row", async () => {
    TABLES.documents = [
      { id: "doc-9", file_name: "My Passport Scan", checklist_item_id: "item-passport", student_id: STUDENT_ID, created_at: "2026-09-01T00:00:00Z" },
    ];

    render(<ChecklistTracker userId={STUDENT_ID} />);

    await waitFor(() => expect(screen.getByText("My Passport Scan")).toBeInTheDocument());
  });

  it("does not show a file that staff soft-deleted", async () => {
    TABLES.documents = [
      { id: "doc-9", file_name: "Removed Scan", checklist_item_id: "item-passport", student_id: STUDENT_ID, created_at: "2026-09-01T00:00:00Z", deleted_at: "2026-09-20T00:00:00Z" },
    ];

    render(<ChecklistTracker userId={STUDENT_ID} />);

    await waitFor(() => expect(screen.getByText("Passport")).toBeInTheDocument());
    expect(screen.queryByText("Removed Scan")).toBeNull();
  });

  it("names the newest upload when an item has a replacement file", async () => {
    TABLES.documents = [
      { id: "doc-old", file_name: "Old Scan", checklist_item_id: "item-passport", student_id: STUDENT_ID, created_at: "2026-09-01T00:00:00Z" },
      { id: "doc-new", file_name: "New Scan", checklist_item_id: "item-passport", student_id: STUDENT_ID, created_at: "2026-09-20T00:00:00Z" },
    ];

    render(<ChecklistTracker userId={STUDENT_ID} />);

    await waitFor(() => expect(screen.getByText("New Scan")).toBeInTheDocument());
    expect(screen.queryByText("Old Scan")).toBeNull();
  });
});

/**
 * The popup's close contract, asserted directly.
 *
 * Radix keeps dialog content mounted in jsdom (it waits for an `animationend`
 * that never fires without real CSS), so asserting that a failed action "left
 * the dialog open" via DOM presence passes even when `onClose` was called.
 * Spying on `onClose` is the only assertion that actually distinguishes the two.
 */
describe("checklist upload dialog close contract", () => {
  const TARGET = { id: "item-passport", name: "Passport", completed: true, existingDocument: null };

  beforeEach(() => {
    failChecklistWrite = null;
    holdUpload = null;
  });

  it("does not close when the uncheck write fails", async () => {
    const onClose = vi.fn();
    const onUncheck = vi.fn().mockResolvedValue(false);
    render(
      <ChecklistItemUploadDialog
        studentId={STUDENT_ID}
        target={TARGET}
        onClose={onClose}
        onChanged={vi.fn()}
        onUncheck={onUncheck}
      />,
    );

    fireEvent.click(screen.getByText("Uncheck item"));

    await waitFor(() => expect(onUncheck).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes when the uncheck write succeeds", async () => {
    const onClose = vi.fn();
    const onUncheck = vi.fn().mockResolvedValue(true);
    render(
      <ChecklistItemUploadDialog
        studentId={STUDENT_ID}
        target={TARGET}
        onClose={onClose}
        onChanged={vi.fn()}
        onUncheck={onUncheck}
      />,
    );

    fireEvent.click(screen.getByText("Uncheck item"));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("does not close while an upload is still in flight", async () => {
    let release!: () => void;
    holdUpload = { promise: new Promise<void>((r) => (release = r)), resolve: () => {} };

    const onClose = vi.fn();
    render(
      <ChecklistItemUploadDialog
        studentId={STUDENT_ID}
        target={{ ...TARGET, completed: false }}
        onClose={onClose}
        onChanged={vi.fn()}
        onUncheck={vi.fn().mockResolvedValue(true)}
      />,
    );

    // Radix portals the dialog outside the render container, so query the document.
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "p.pdf", { type: "application/pdf" })] } });
    fireEvent.click(screen.getByText("Confirm & mark as done"));

    // Dismissing mid-upload must not drop the student out of the flow.
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      release();
      await holdUpload!.promise;
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
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
