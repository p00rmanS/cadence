import { useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronRight, HelpCircle, MoreHorizontal, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { clsx } from "../../lib/clsx";
import { TextSizePicker } from "./SettingsDialog";
import type { ThemeChoice } from "../../hooks/useTheme";
import type { TextSize } from "../../hooks/useDisplayPrefs";

/**
 * ============================================================================
 *  THE "MORE" MENU (PHONE ONLY)
 * ============================================================================
 * On a phone the header had four rows of small buttons and used about a third of the screen before any
 * schedule showed. The things used least (Save & share, Settings, Help, the light/dark choice and the text
 * size) now live behind ONE "More" button, so the header keeps only what is used all the time: Fill week
 * for me, Semester/Break, Plan options, and Undo/Redo.
 *
 * It opens as a bottom sheet (the shared `Modal` already does that on a small screen, with focus handling,
 * Escape to close, and no scrolling behind it). Every row has words, not only an icon. Colors and text size
 * are changed right here and take effect at once, so a person can see the result without leaving the menu.
 * On a bigger screen this button is hidden (`sm:hidden`) because the same controls are already in the header.
 */

/** One row of the menu: an icon, a title, one plain line about it, and an arrow showing it opens something. */
function MenuRow({ icon: Icon, title, detail, onClick }: { icon: LucideIcon; title: string; detail: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-line bg-panel p-3 text-left transition hover:bg-line/30"
    >
      <Icon className="h-5 w-5 shrink-0 text-accent" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted">{detail}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
    </button>
  );
}

/** The three color looks, written out in words (the header's switch uses small icons, which are too vague here). */
const THEME_CHOICES: { value: ThemeChoice; label: string; detail: string }[] = [
  { value: "light", label: "Light", detail: "White background" },
  { value: "dark", label: "Dark", detail: "Easier at night" },
  { value: "system", label: "Auto", detail: "Match this device" },
];

export function MoreMenu({
  onOpenShare,
  onOpenSettings,
  onOpenHelp,
  theme,
  onThemeChange,
  textSize,
  onTextSizeChange,
}: {
  onOpenShare: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  theme: ThemeChoice;
  onThemeChange: (theme: ThemeChoice) => void;
  textSize: TextSize;
  onTextSizeChange: (size: TextSize) => void;
}) {
  const [open, setOpen] = useState(false);

  /** Closes the menu first, then opens the chosen window, so two windows are never stacked on top of each other. */
  function openThen(action: () => void) {
    return () => {
      setOpen(false);
      action();
    };
  }

  /** The bottom sheet itself, built here so the portal call below stays short and readable. */
  const sheet = (
    <Modal title="More" description="Sharing, settings, help, and how Syncro looks." onClose={() => setOpen(false)}>
      <div className="space-y-5">
        <div className="space-y-2">
          <MenuRow icon={CalendarDays} title="Save & share" detail="Student links, calendar files, backup." onClick={openThen(onOpenShare)} />
          <MenuRow icon={Settings} title="Settings" detail="Schedule rules and more display choices." onClick={openThen(onOpenSettings)} />
          <MenuRow icon={HelpCircle} title="Help" detail="Short answers and a quick start." onClick={openThen(onOpenHelp)} />
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Colors</h3>
          <div role="group" aria-label="Colors" className="grid grid-cols-3 gap-2">
            {THEME_CHOICES.map((choice) => (
              <button
                key={choice.value}
                type="button"
                aria-pressed={choice.value === theme}
                onClick={() => onThemeChange(choice.value)}
                className={clsx(
                  "rounded-xl border-2 px-2 py-3 text-center transition",
                  choice.value === theme ? "border-accent bg-accent/10" : "border-line bg-panel hover:border-accent/50",
                )}
              >
                <span className="block text-sm font-semibold">{choice.label}</span>
                <span className="block text-xs text-muted">{choice.detail}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Text size</h3>
          <TextSizePicker value={textSize} onChange={onTextSizeChange} />
        </div>
      </div>
    </Modal>
  );

  return (
    <>
      <Button variant="secondary" className="sm:hidden" aria-haspopup="dialog" onClick={() => setOpen(true)} title="More: share, settings, help, colors and text size">
        <MoreHorizontal className="h-4 w-4" aria-hidden /> More
      </Button>
      {/* Drawn directly in <body> (a "portal"): the header has its own stacking level, which would otherwise keep the sheet underneath the bottom tab bar. */}
      {open && createPortal(sheet, document.body)}
    </>
  );
}
