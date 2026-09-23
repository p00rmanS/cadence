import { Monitor, Moon, Sun } from "lucide-react";
import { Segmented } from "../ui/Segmented";
import type { ThemeChoice } from "../../hooks/useTheme";

/**
 * The Auto/Light/Dark three-way switch in the header. Icon-only (a monitor, sun, and moon) so
 * it reads as one small control instead of three more buttons competing for attention next to
 * Save & share / Rules / Help — the names are still there for screen readers and as a hover
 * tooltip, via `Segmented`'s icon mode.
 */
export function ThemeControl({ theme, onChange }: { theme: ThemeChoice; onChange: (t: ThemeChoice) => void }) {
  return (
    <Segmented
      label="Color theme"
      value={theme}
      onChange={onChange}
      options={[
        { value: "system", label: "Auto", icon: Monitor },
        { value: "light", label: "Light", icon: Sun },
        { value: "dark", label: "Dark", icon: Moon },
      ]}
    />
  );
}
