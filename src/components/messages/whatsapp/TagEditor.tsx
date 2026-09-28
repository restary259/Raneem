import { Tag, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Editable lead tags: add on Enter or button, remove via the chip's ×. */
export function TagEditor({ label, tags, onChange, addLabel }: { label: string; tags: string[]; onChange: (tags: string[]) => void; addLabel: string }) {
  const [draft, setDraft] = useState("");
  const add = () => { const tag = draft.trim(); if (!tag || tags.includes(tag)) return; onChange([...tags, tag]); setDraft(""); };
  return <div><Label className="text-xs">{label}</Label><div className="mt-1 flex gap-2"><Input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} placeholder={addLabel} /><Button type="button" size="icon" variant="outline" onClick={add} aria-label={addLabel}><Tag className="h-4 w-4" /></Button></div>{tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{tags.map((tag) => <Badge key={tag} variant="secondary" className="gap-1">{tag}<button type="button" onClick={() => onChange(tags.filter((item) => item !== tag))} aria-label={`${addLabel}: ${tag}`}><X className="h-3 w-3" /></button></Badge>)}</div>}</div>;
}
