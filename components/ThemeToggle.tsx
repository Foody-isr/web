"use client";

import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();

  const cycleTheme = () => {
    const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
  };

  const getIcon = () => {
    switch (theme) {
      case "light":
        return "☀️";
      case "dark":
        return "🌙";
      case "system":
        return "💻";
    }
  };

  const getLabel = () => {
    switch (theme) {
      case "light":
        return t("themeLight");
      case "dark":
        return t("themeDark");
      case "system":
        return t("themeSystem");
    }
  };

  return (
    <button
      onClick={cycleTheme}
      className="px-3 py-2 rounded-button border border-light-divider text-sm text-ink-muted hover:border-brand hover:text-ink transition bg-light-surface font-medium"
    >
      {getIcon()} {getLabel()}
    </button>
  );
}
