import { useState } from "react";
import {
  COLOUR_PARAMS,
  hueBandOf,
  LIGHT_PARAMS,
  MIXER_CHANNELS,
  MIXER_CHANNEL_LABELS,
  MIXER_PARAMS,
  type MixerChannel,
  type ParamDef,
  type ParamId,
} from "../model/params";
import { isOriginal } from "../model/types";
import { isChanged, resetValue } from "../model/versions";
import { useSession } from "../session/Session";
import { SliderRow } from "../ui/SliderRow";
import { tabKeys } from "../ui/tabKeys";
import styles from "./AdjustPanel.module.css";
import { Group } from "./Group";
import { Histogram } from "./Histogram";
import { ToneCurve } from "./ToneCurve";

type GroupId = "light" | "colour" | "curve" | "mixer";

const ALL_MIXER_PARAMS = MIXER_CHANNELS.flatMap((channel) => MIXER_PARAMS[channel]);

export function AdjustPanel() {
  const { status, photo, version, parent, agentTouched, histogram, setParam } = useSession();
  const [open, setOpen] = useState<Record<GroupId, boolean>>({ light: true, colour: true, curve: true, mixer: true });
  const [channel, setChannel] = useState<MixerChannel>("sat");

  const toggle = (id: GroupId) => setOpen((current) => ({ ...current, [id]: !current[id] }));
  const disabled = status !== "ready" || !version;

  const valueOf = (def: ParamDef) => version?.params[def.id] ?? def.neutral;
  // What counts as changed, and what Reset restores, are the model's rules.
  const parentValueOf = (def: ParamDef) => (photo && version && parent ? resetValue(photo, version, def.id) : null);
  const countChanged = (defs: ParamDef[]) => defs.filter((def) => !!version && isChanged(version, parent, def.id)).length;
  /** The latest agent mark among these controls, if any. */
  const markOf = (defs: ParamDef[]) => {
    const marks = defs.map((def) => agentTouched[def.id]).filter((mark) => mark !== undefined);
    return marks.length ? Math.max(...marks) : undefined;
  };

  // A mixer row shows only its band, so its name adds the channel: "Red saturation".
  const rows = (defs: ParamDef[], channelName?: string) =>
    defs.map((def) => (
      <SliderRow
        key={def.id}
        def={def}
        name={channelName ? `${def.label} ${channelName.toLowerCase()}` : undefined}
        swatch={hueBandOf(def.id) ? `var(--band-${hueBandOf(def.id)})` : undefined}
        value={valueOf(def)}
        parentValue={parentValueOf(def)}
        agentMark={agentTouched[def.id]}
        disabled={disabled}
        onChange={(value) => setParam(def.id as ParamId, value)}
      />
    ));

  return (
    <aside className={styles.panel} aria-label="Adjustments">
      <Histogram />
      <div className={styles.scroll}>
        <Group
          title="Light"
          open={open.light}
          onToggle={() => toggle("light")}
          changed={countChanged(LIGHT_PARAMS)}
          agentMark={markOf(LIGHT_PARAMS)}
          disabled={status === "empty"}
        >
          {rows(LIGHT_PARAMS)}
        </Group>

        <Group
          title="Colour"
          open={open.colour}
          onToggle={() => toggle("colour")}
          changed={countChanged(COLOUR_PARAMS)}
          agentMark={markOf(COLOUR_PARAMS)}
          disabled={status === "empty"}
        >
          {rows(COLOUR_PARAMS)}
        </Group>

        <Group title="Curve" open={open.curve} onToggle={() => toggle("curve")} changed={0} disabled={status === "empty"}>
          <ToneCurve shaped={!!version && !isOriginal(version)} histogram={histogram} disabled={disabled} />
        </Group>

        <Group
          title="Colour Mixer"
          open={open.mixer}
          onToggle={() => toggle("mixer")}
          changed={countChanged(ALL_MIXER_PARAMS)}
          agentMark={markOf(ALL_MIXER_PARAMS)}
          disabled={status === "empty"}
        >
          <div className={styles.tabs} role="tablist" aria-label="Mixer channel" onKeyDown={tabKeys(MIXER_CHANNELS, channel, setChannel)}>
            {MIXER_CHANNELS.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                className={styles.tab}
                aria-selected={id === channel}
                tabIndex={id === channel ? 0 : -1}
                disabled={disabled}
                onClick={() => setChannel(id)}
              >
                {MIXER_CHANNEL_LABELS[id]}
                {countChanged(MIXER_PARAMS[id]) > 0 && <span className={styles.tabDot} aria-label="changed" />}
              </button>
            ))}
          </div>
          {rows(MIXER_PARAMS[channel], MIXER_CHANNEL_LABELS[channel])}
        </Group>
      </div>
    </aside>
  );
}
