"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Trash2, ThumbsUp, ThumbsDown, Lightbulb, ExternalLink } from "lucide-react";
import { C, F, inputStyle } from "./theme";
import { Card, SectionLabel, EmptyState, SkeletonCards } from "./ui";
import { uid, isValidUrl, loadShared, saveShared } from "./utils";
import type { Session, Idea } from "./types";


export function Ideas({ code, session }: { code: string; session: Session }) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState(""); const [note, setNote] = useState("");
  const key = `ideas:${code}`;
  useEffect(() => { loadShared<Idea[]>(key, []).then(it => { setIdeas(it); setLoading(false); }); }, [key]);
  const persist = useCallback(async (next: Idea[]) => { setIdeas(next); await saveShared(key, next); }, [key]);

  function addIdea() {
    if (!text.trim()) return;
    persist([...ideas, { id: uid(), text: text.trim(), author: session.name, note: note.trim(), votes: {}, addedAt: Date.now() }]);
    setText(""); setNote("");
  }

  function vote(id: string, val: 1 | -1) {
    persist(ideas.map(idea => {
      if (idea.id !== id) return idea;
      const current = idea.votes[session.name];
      const newVotes = { ...idea.votes };
      if (current === val) delete newVotes[session.name];
      else newVotes[session.name] = val;
      return { ...idea, votes: newVotes };
    }));
  }

  const sorted = useMemo(() => [...ideas].sort((a, b) => {
    const scoreA = Object.values(a.votes).reduce((s, v) => s + v, 0);
    const scoreB = Object.values(b.votes).reduce((s, v) => s + v, 0);
    return scoreB - scoreA;
  }), [ideas]);

  if (loading) return <SkeletonCards />;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <SectionLabel>Proponer idea</SectionLabel>
        <p style={{ color: C.inkSoft, fontSize: 12, marginTop: 4 }}>Actividades, restaurantes, planes… El grupo vota.</p>
        <div className="flex flex-col gap-2 mt-3">
          <input placeholder="Ej. Visitar el cabo de Gata al atardecer" value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addIdea()} style={inputStyle} />
          <input placeholder="Nota o enlace (opcional)" value={note} onChange={e => setNote(e.target.value)} style={inputStyle} />
          <button onClick={addIdea} style={{ background: C.navy, color: C.paper, borderRadius: 5, padding: "11px 16px", fontFamily: F.mono, fontSize: 12 }}>PROPONER</button>
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        {sorted.map(idea => {
          const score = Object.values(idea.votes).reduce((s, v) => s + v, 0);
          const myVote = idea.votes[session.name];
          const upCount = Object.values(idea.votes).filter(v => v === 1).length;
          const downCount = Object.values(idea.votes).filter(v => v === -1).length;
          return (
            <Card key={idea.id} className="card-lift" style={{ padding: "14px 16px" }}>
              <div className="flex items-start gap-3">
                {/* Vote column */}
                <div className="flex flex-col items-center gap-1 shrink-0" style={{ minWidth: 40 }}>
                  <button className="vote-btn" onClick={() => vote(idea.id, 1)}
                    style={{ color: myVote === 1 ? C.green : C.line, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <ThumbsUp size={18} fill={myVote === 1 ? C.green : "none"} />
                    <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft }}>{upCount}</span>
                  </button>
                  <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 700, color: score > 0 ? C.green : score < 0 ? C.red : C.inkSoft }}>{score > 0 ? "+" : ""}{score}</div>
                  <button className="vote-btn" onClick={() => vote(idea.id, -1)}
                    style={{ color: myVote === -1 ? C.red : C.line, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <ThumbsDown size={18} fill={myVote === -1 ? C.red : "none"} />
                    <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft }}>{downCount}</span>
                  </button>
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p style={{ fontWeight: 600, fontSize: 15, color: C.ink }}>{idea.text}</p>
                  {idea.note && (
                    isValidUrl(idea.note)
                      ? <a href={idea.note} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1" style={{ color: C.sky, fontSize: 12, marginTop: 3 }}><ExternalLink size={11} />{idea.note.length > 50 ? `${idea.note.slice(0, 50)}…` : idea.note}</a>
                      : <p style={{ color: C.inkSoft, fontSize: 13, marginTop: 3 }}>{idea.note}</p>
                  )}
                  <p style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft, marginTop: 4 }}>Por {idea.author}</p>
                </div>
                <button onClick={() => persist(ideas.filter(x => x.id !== idea.id))} style={{ color: C.inkSoft, padding: 4, flexShrink: 0 }}><Trash2 size={14} /></button>
              </div>
            </Card>
          );
        })}
        {ideas.length === 0 && <EmptyState icon={<Lightbulb size={28} color={C.line} />} text="Sin ideas todavía. ¡Propón la primera actividad!" />}
      </div>
    </div>
  );
}

