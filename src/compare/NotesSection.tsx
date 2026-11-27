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
  const { status, notes, agent, agentPointer, photo, keepAgentPointer, dismissAgentPointer } = useSession();
  const compare = useCompare();
  if (status !== "ready" || !photo) return null;

  const waiting = notes.filter((note) => note.state.kind === "waiting").length;
  const { headline, detail } = waitingLine(waiting, agent);
  const draft = compare.draft;
  const draftVersion = draft ? photo.versions.find((v) => v.id === draft.versionId) : undefined;
  const nextNumber = notes.reduce((max, note) => Math.max(max, note.number), 0) + 1;
  const pointed = agentPointer ? photo.versions.find((v) => v.id === agentPointer.versionId) : undefined;
  const pointedStanding = pointed ? compare.standing(pointed.id) : null;

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

      {agentPointer && pointed && (
        <div className={styles.pointer} key={agentPointer.id} style={{ animationDuration: `${agentPointer.lifetime}ms` }}>
          <p className={styles.pointerFrom}>
            {agent.client ?? "The agent"} is pointing at {pointed.letter || "the original"}
            {pointedStanding === "dropped" && ", which you dropped"}
            {pointedStanding === "waiting" && ", which is waiting for room"}
            {pointedStanding === "out" && ", which is not in the comparison"}
          </p>
          <p className={styles.text}>{agentPointer.caption}</p>
          <p className={styles.pointerActions}>
            <button type="button" className={styles.addButton} onClick={keepAgentPointer}>
              Keep as note
            </button>
            {pointedStanding !== "compared" && !compare.full && (
              // The agent does not bring a version back; the person may.
              <button type="button" className={styles.addButton} onClick={() => compare.toggleCompared(pointed.id)}>
                {pointedStanding === "dropped" ? "Restore" : "Add"} {pointed.letter || "original"}
              </button>
            )}
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
        // Keyed by its place, so each draft starts with an empty field:
        // text typed into a note that was cancelled never carries over.
        <DraftRow
          key={`${photo.id}:${draft.versionId}:${draft.region.x}:${draft.region.y}:${draft.region.width}:${draft.region.height}`}
          number={nextNumber}
          letter={draftVersion.letter}
          point={isPoint(draft.region)}
        />
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

/** A note that has a place and is being given its words. */
function DraftRow({ number, letter, point }: { number: number; letter: string; point: boolean }) {
  const { addNote } = useSession();
  const compare = useCompare();
  const [text, setText] = useState("");

  const save = () => {
    const clean = text.trim();
    if (!compare.draft || clean === "") return;
    addNote(compare.draft.versionId, compare.draft.region, clean);
    compare.setDraft(null);
  };
  const cancel = () => {
    compare.setDraft(null);
    compare.setNoteTool(false);
  };

  return (
    <div className={styles.draft}>
      <span className={styles.number} data-tone="draft">
        {number}
      </span>
      <div className={styles.body}>
        <input
          className={styles.input}
          autoFocus
          value={text}
          maxLength={MAX_LENGTH}
          placeholder={`What should change ${point ? "here" : "in this area"}?`}
          aria-label={`Note ${number} on version ${letter || "original"}`}
          onChange={(event) => setText(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") save();
            if (event.key === "Escape") cancel();
          }}
          spellCheck
        />
        <p className={styles.state}>
          On {letter || "the original"} · <kbd>Return</kbd> saves · <kbd>Esc</kbd> cancels
        </p>
      </div>
    </div>
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
      {/* The person may delete any note that is theirs, or that they chose to keep. */}
      {(note.author.kind === "you" || note.state.kind === "kept") && (
        <button type="button" className={styles.remove} aria-label={`Delete note ${note.number}`} onClick={() => removeNote(note.id)}>
          <X size={16} />
        </button>
      )}
    </li>
  );
}
