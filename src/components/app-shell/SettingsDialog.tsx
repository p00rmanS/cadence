import { useState } from "react";
import type { KeyboardEvent } from "react";
import { Eye, SlidersHorizontal } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Segmented } from "../ui/Segmented";
import { RulesForm } from "./RulesForm";
import { TEXT_SIZES } from "../../hooks/useDisplayPrefs";
import type { DisplayPrefs, TextSize } from "../../hooks/useDisplayPrefs";
import type { ThemeChoice } from "../../hooks/useTheme";
import type { ScheduleSettings } from "../../features/scheduling/types";
import { clsx } from "../../lib/clsx";

/**
 * ============================================================================
 *  THE SETTINGS WINDOW (opened by the gear in the header)
 * ============================================================================
 * One place for everything a manager can change, sorted into two tabs so each one stays short:
 *  - "Display": how Cadence looks on THIS computer: text size (Small to Extra large), light/dark
 *    colors, bigger buttons, high-contrast colors, and switching animations off. These take effect the moment they are clicked and are
 *    remembered by the browser (see `hooks/useDisplayPrefs.ts` and `hooks/useTheme.ts`).
 *  - "Schedule rules": the office-wide rules (weekly hours, break hours, shortest shift, closing
 *    time). These belong to the schedule, so they have their own Save button (`RulesForm.tsx`).
 * The tabs follow the usual keyboard pattern: Left/Right arrows move between them.
 */

export type SettingsTab = "display" | "rules";

const TABS: { id: SettingsTab; label: string; icon: typeof Eye }[] = [
  { id: "display", label: "Display", icon: Eye },
  { id: "rules", label: "Schedule rules", icon: SlidersHorizontal },
];

type Props = {
  settings: ScheduleSettings;
  onSaveRules: (s: Partial<ScheduleSettings>) => void;
  theme: ThemeChoice;
  onThemeChange: (t: ThemeChoice) => void;
  display: DisplayPrefs;
  /** Which tab to show first (the header's gear opens "display"). */
  initialTab?: SettingsTab;
  onClose: () => void;
};

/** The text-size picker: four big "Aa" buttons, each drawn at its own size so people can see what they are choosing. */
function TextSizePicker({ value, onChange }: { value: TextSize; onChange: (size: TextSize) => void }) {
  // The sample letters are drawn in fixed pixel sizes (not rem) so each button previews its own size, whatever size is active now.
  const SAMPLE_PX: Record<TextSize, number> = { small: 15, medium: 17, large: 20, xlarge: 24 };
  return (
    <div role="group" aria-label="Text size" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {TEXT_SIZES.map((size) => (
        <button
          key={size.value}
          type="button"
          aria-pressed={size.value === value}
          onClick={() => onChange(size.value)}
          className={clsx(
            "flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 transition",
            size.value === value ? "border-accent bg-accent/10" : "border-line bg-panel hover:border-accent/50",
          )}
        >
          <span aria-hidden className="font-display font-bold leading-none" style={{ fontSize: SAMPLE_PX[size.value] * 1.4 }}>
            Aa
          </span>
          <span className="text-sm font-medium">{size.label}</span>
        </button>
      ))}
    </div>
  );
}

/** The Settings window: a "Display" tab (text size, colors, motion) and a "Schedule rules" tab (the office rules). */
export function SettingsDialog({ settings, onSaveRules, theme, onThemeChange, display, initialTab = "display", onClose }: Props) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);

  // Left/Right arrows move between the tabs (and wrap around), like any tab strip.
  function onTabKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const at = TABS.findIndex((t) => t.id === tab);
    const next = TABS[(at + (e.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length];
    setTab(next.id);
    document.getElementById(`settings-tab-${next.id}`)?.focus();
  }

  return (
    <Modal title="Settings" description="Make Cadence comfortable to read, and change the office rules." onClose={onClose} size="lg">
      <div role="tablist" aria-label="Settings sections" className="mb-4 flex gap-1 border-b border-line">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`settings-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={`settings-panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id)}
            onKeyDown={onTabKeyDown}
            className={clsx(
              "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition-colors",
              tab === id ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden /> {label}
          </button>
        ))}
      </div>

      {tab === "display" && (
        <div id="settings-panel-display" role="tabpanel" aria-labelledby="settings-tab-display" className="anim-fade-quick space-y-6">
          <section>
            <h3 className="font-display text-base font-semibold">Text size</h3>
            <p className="mb-2 text-sm text-muted">Makes everything in Cadence bigger or smaller. It changes right away and is remembered on this computer.</p>
            <TextSizePicker value={display.textSize} onChange={display.setTextSize} />
            <p className="mt-3 rounded-lg bg-bg p-3 text-sm">
              <span className="font-semibold">Mon 9:00am–11:00am</span> · Noa K. works the front desk. This line is how normal writing will look.
            </p>
          </section>

          <section>
            <h3 className="font-display text-base font-semibold">Colors</h3>
            <p className="mb-2 text-sm text-muted">Auto follows your computer&apos;s own light or dark setting.</p>
            <Segmented
              label="Color theme"
              value={theme}
              onChange={onThemeChange}
              options={[
                { value: "system", label: "Auto" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
          </section>

          <section>
            <h3 className="font-display text-base font-semibold">Easier to see and click</h3>
            <label className="mt-2 flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={display.roomy}
                onChange={(e) => display.setRoomy(e.target.checked)}
                className="mt-1 h-5 w-5 shrink-0 accent-[rgb(var(--accent))]"
              />
              <span>
                <span className="font-medium">Bigger buttons and more space</span>
                <span className="block text-muted">Makes every button and list row taller, so they are easier to hit.</span>
              </span>
            </label>
            <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={display.highContrast}
                onChange={(e) => display.setHighContrast(e.target.checked)}
                className="mt-1 h-5 w-5 shrink-0 accent-[rgb(var(--accent))]"
              />
              <span>
                <span className="font-medium">High contrast</span>
                <span className="block text-muted">Pure black and white with strong edges, for the clearest possible reading. Works with Light and Dark.</span>
              </span>
            </label>
          </section>

          <section>
            <h3 className="font-display text-base font-semibold">Movement</h3>
            <label className="mt-1 flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={display.reduceMotion}
                onChange={(e) => display.setReduceMotion(e.target.checked)}
                className="mt-1 h-5 w-5 shrink-0 accent-[rgb(var(--accent))]"
              />
              <span>
                <span className="font-medium">Reduce motion</span>
                <span className="block text-muted">Turns off the sliding, fading and logo animations. Nothing else changes.</span>
              </span>
            </label>
          </section>
        </div>
      )}

      {tab === "rules" && (
        <div id="settings-panel-rules" role="tabpanel" aria-labelledby="settings-tab-rules" className="anim-fade-quick">
          <RulesForm settings={settings} onSave={onSaveRules} onClose={onClose} />
        </div>
      )}
    </Modal>
  );
}
