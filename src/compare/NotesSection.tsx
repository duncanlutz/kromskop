import { X } from "@phosphor-icons/react";
import { useState } from "react";
import { isPoint, type AgentStatus, type Note, type Photo } from "../model/types";
import { useSession } from "../session/Session";
import { useCompare } from "./CompareState";
import styles from "./NotesSection.module.css";

/** Longest note. These are pointers for the agent, not messages. */
const MAX_LENGTH = 140;

/**
 * Says plainly how many notes the agent has not seen. The agent is never
 * pushed a note: it gets them when it next asks, which may be a while.
 */
function waitingLine(waiting: number, agent: AgentStatus): { headline: string; detail: string | null } {
  if (waiting === 0) return { headline: "None waiting", detail: null };
  const count = waiting === 1 ? "1 note" : `${waiting} notes`;
  if (agent.client === null) {
    return { headline: `${count} waiting for an agent`, detail: "No agent is connected. They stay here until one connects and asks." };
  }
  if (agent.state === "disconnected") {
    return {
      headline: `${count} waiting for ${agent.client}`,
      detail: `${agent.client} is disconnected, so nothing is reading them. It gets them when it reconnects and asks.`,
    };
  }
  return { headline: `${count} waiting for ${agent.client}`, detail: "It receives them when it next asks, not as you write." };
}

export function NotesSection() {
  const { status, notes, agent, agentPointer, photo, addNote, keepAgentPointer, dismissAgentPointer } = useSession();
  const compare = useCompare();
  const [text, setText] = useState("");
  if (status !== "ready" || !photo) return null;

  const waiting = notes.filter((note) => note.state.kind === "waiting").length;
  const { headline, detail } = waitingLine(waiting, agent);
  const draft = compare.draft;
  const draftVersion = draft ? photo.versions.find((v) => v.id === draft.versionId) : undefined;
  const nextNumber = notes.reduce((max, note) => Math.max(max, note.number), 0) + 1;

  const save = () => {
    const clean = text.trim();
    if (!draft || clean === "") return;
    addNote(draft.versionId, draft.region, clean);
    compare.setDraft(null);
    setText("");
  };
  const cancel = () => {
    compare.setDraft(null);
    compare.setNoteTool(false);
    setText("");
  };

  return (
    <section className={styles.notes} aria-label="Notes">
      <header className={styles.header}>
        <h2 className={styles.heading}>Notes</h2>
        {(notes.length > 0 || waiting > 0) && (
          <span className={styles.count} data-waiting={waiting > 0 || undefined}>
            {headline}
          </span>
        )}
      </header>
      {detail && <p className={styles.detail}>{detail}</p>}

      {agentPointer && (
        <div className={styles.pointer} key={agentPointer.id} style={{ animationDuration: `${agentPointer.lifetime}ms` }}>
          <p className={styles.pointerFrom}>
            {agent.client ?? "The agent"} is pointing at {photo.versions.find((v) => v.id === agentPointer.versionId)?.letter || "the original"}
          </p>
          <p className={styles.text}>{agentPointer.caption}</p>
          <p className={styles.pointerActions}>
            <button type="button" className={styles.addButton} onClick={keepAgentPointer}>
              Keep as note
            </button>
            <button type="button" className={styles.addButton} onClick={dismissAgentPointer}>
              Dismiss
            </button>
          </p>
        </div>
      )}

      {compare.noteTool && !draft && (
        <p className={styles.prompt}>
          Click a point or drag a rectangle on any tile. <kbd>Esc</kbd> cancels.
        </p>
      )}

      {draft && draftVersion && (
        <div className={styles.draft}>
          <span className={styles.number} data-tone="draft">
            {nextNumber}
          </span>
          <div className={styles.body}>
            <input
              className={styles.input}
              autoFocus
              value={text}
              maxLength={MAX_LENGTH}
              placeholder={`What should change ${isPoint(draft.region) ? "here" : "in this area"}?`}
              aria-label={`Note ${nextNumber} on version ${draftVersion.letter || "original"}`}
              onChange={(event) => setText(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") save();
                if (event.key === "Escape") cancel();
              }}
              spellCheck
            />
            <p className={styles.state}>
              On {draftVersion.letter || "the original"} · <kbd>Return</kbd> saves · <kbd>Esc</kbd> cancels
            </p>
          </div>
        </div>
      )}

      {notes.length > 0 && (
        <ol className={styles.list}>
          {notes.map((note) => (
            <NoteRow key={note.id} note={note} photo={photo} />
          ))}
        </ol>
      )}

      {notes.length === 0 && !draft && !compare.noteTool && (
        <p className={styles.empty}>
          No notes on this photo. Press <kbd>N</kbd>, then click a point or drag a rectangle on a tile to tell the agent
          what to look at.
        </p>
      )}

      {!draft && !compare.noteTool && (
        <div className={styles.add}>
          <button type="button" className={styles.addButton} onClick={() => compare.setNoteTool(true)}>
            Add a note <kbd>N</kbd>
          </button>
        </div>
      )}
    </section>
  );
}

function NoteRow({ note, photo }: { note: Note; photo: Photo }) {
  const { agent, removeNote } = useSession();
  const compare = useCompare();
  const version = photo.versions.find((v) => v.id === note.versionId);
  const answer = note.state.kind === "addressed" ? photo.versions.find((v) => v.id === (note.state as { versionId: string }).versionId) : undefined;
  const client = agent.client ?? "the agent";
  const tone = note.state.kind === "waiting" ? "waiting" : note.state.kind === "addressed" ? "addressed" : "agent";

  return (
    <li
      className={styles.row}
      data-highlight={compare.highlightedNoteId === note.id || undefined}
      onPointerEnter={() => compare.highlightNote(note.id)}
      onPointerLeave={() => compare.highlightNote(null)}
    >
      <button
        type="button"
        className={styles.rowMain}
        aria-label={`Note ${note.number}: show version ${version?.letter ?? ""}`}
        onClick={() => version && compare.focusVersion(version.id)}
      >
        <span className={styles.number} data-tone={tone}>
          {note.number}
        </span>
        <span className={styles.body}>
          <span className={styles.text}>{note.text}</span>
          <span className={styles.state} data-state={note.state.kind}>
            On {version?.letter || "the original"} ·{" "}
            {note.state.kind === "waiting" && "Waiting for the agent"}
            {note.state.kind === "read" && `Read by ${client}`}
            {note.state.kind === "kept" && `Pointed out by ${note.author.kind === "agent" ? note.author.client : client}`}
            {note.state.kind === "addressed" && (
              <>
                Addressed in <span className={styles.answer}>{answer?.letter ?? "a later version"}</span>
                {answer && ` ${answer.name}`}
              </>
            )}
          </span>
        </span>
      </button>
      {note.author.kind === "you" && note.state.kind !== "addressed" && (
        <button type="button" className={styles.remove} aria-label={`Delete note ${note.number}`} onClick={() => removeNote(note.id)}>
          <X size={16} />
        </button>
      )}
    </li>
  );
}
