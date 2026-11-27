import {
  COLOUR_PARAMS,
  formatValue,
  hueBandOf,
  LIGHT_PARAMS,
  MIXER_CHANNELS,
  MIXER_CHANNEL_LABELS,
  MIXER_PARAMS,
  type ParamDef,
} from "../model/params";
import type { Version } from "../model/types";
import { useSession } from "../session/Session";
import { useCompare } from "./CompareState";
import styles from "./DifferencesPanel.module.css";
import { NotesSection } from "./NotesSection";

/** The groups of the Develop panel, in its order. */
const GROUPS: Array<{ title: string; params: ParamDef[] }> = [
  { title: "Light", params: LIGHT_PARAMS },
  { title: "Colour", params: COLOUR_PARAMS },
  ...MIXER_CHANNELS.map((channel) => ({ title: `Mixer · ${MIXER_CHANNEL_LABELS[channel]}`, params: MIXER_PARAMS[channel] })),
];

/**
 * What separates two versions, and what the person has said about them.
 * It replaces the sliders in Compare: here one judges, and adjusts elsewhere.
 */
export function DifferencesPanel() {
  const { status } = useSession();
  const { focus, against, compared } = useCompare();
  const pair = status === "ready" && compared.length >= 2 && focus && against ? { focus, against } : null;

  return (
    <aside className={styles.panel} aria-label="Differences and notes">
      <div className={styles.scroll}>
        <header className={styles.header}>
          <h2 className={styles.heading}>Differences</h2>
          {pair && (
            <span className={styles.pairing}>
              {pair.against.letter || "Original"} and {pair.focus.letter || "Original"}
            </span>
          )}
        </header>
        {pair ? <Differences focus={pair.focus} against={pair.against} /> : <p className={styles.note}>Two versions are needed to list what differs.</p>}
        <NotesSection />
      </div>
      <footer className={styles.keys} aria-hidden="true">
        <span>
          <kbd>N</kbd> note
        </span>
        <span>
          <kbd>H</kbd> hide marks
        </span>
        <span>
          <kbd>T</kbd> tiles only
        </span>
      </footer>
    </aside>
  );
}

function Differences({ focus, against }: { focus: Version; against: Version }) {
  const groups = GROUPS.map((group) => ({
    title: group.title,
    params: group.params.filter((def) => focus.params[def.id] !== against.params[def.id]),
  })).filter((group) => group.params.length > 0);

  return (
    <>
      <div className={styles.rationales}>
        <Rationale version={against} />
        <Rationale version={focus} focused />
      </div>

      {groups.length === 0 ? (
        <p className={styles.note}>
          These two versions have the same settings. Any difference you see is in the display, not in the edit.
        </p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" className="visually-hidden">
                Adjustment
              </th>
              <th scope="col">
                <span className={styles.tile}>{against.letter || "O"}</span>
              </th>
              <th scope="col">
                <span className={styles.tile} data-focused>
                  {focus.letter || "O"}
                </span>
              </th>
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.title}>
              <tr className={styles.group}>
                <th scope="colgroup" colSpan={3}>
                  {group.title}
                </th>
              </tr>
              {group.params.map((def) => {
                const band = hueBandOf(def.id);
                return (
                  <tr key={def.id}>
                    <th scope="row">
                      {band && <span className={styles.swatch} style={{ background: `var(--band-${band})` }} />}
                      {def.label}
                    </th>
                    <td className="num">{formatValue(def, against.params[def.id])}</td>
                    <td className="num" data-focused>
                      {formatValue(def, focus.params[def.id])}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      )}
    </>
  );
}

function Rationale({ version, focused }: { version: Version; focused?: boolean }) {
  const agent = version.author?.kind === "agent";
  return (
    <div className={styles.rationale}>
      <span className={styles.tile} data-focused={focused || undefined}>
        {version.letter || "O"}
      </span>
      <div className={styles.rationaleText}>
        <p className={styles.name}>
          {version.name}
          {version.author && (
            <span className={styles.author} data-agent={agent || undefined}>
              {version.author.kind === "agent" ? version.author.client : "You"}
            </span>
          )}
        </p>
        <p className={styles.reason}>
          {version.rationale ?? (version.author ? "Your own adjustment. It carries no rationale." : "The photo as shot, with no adjustments.")}
        </p>
      </div>
    </div>
  );
}
