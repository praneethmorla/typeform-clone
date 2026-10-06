export interface ThemeDefinition {
  id: string;
  name: string;
  bg: string;
  color: string;
  mutedColor: string;
  btn: string;
  btnText: string;
  choiceBg: string;
  choiceBorder: string;
  choiceText: string;
  choiceSelBg: string;
  choiceSelText: string;
  badgeBg: string;
  badgeText: string;
  line: string;
}

export const THEMES: Record<string, ThemeDefinition> = {
  pearl: {
    id: "pearl",
    name: "Pearl White",
    bg: "#ffffff",
    color: "#191919",
    mutedColor: "#737373",
    btn: "#191919",
    btnText: "#ffffff",
    choiceBg: "#f7f7f8",
    choiceBorder: "#e5e5e5",
    choiceText: "#191919",
    choiceSelBg: "#191919",
    choiceSelText: "#ffffff",
    badgeBg: "#ffffff",
    badgeText: "#191919",
    line: "#191919",
  },
  classic: {
    id: "classic",
    name: "Classic Blue",
    bg: "#ffffff",
    color: "#191919",
    mutedColor: "#596780",
    btn: "#0445af",
    btnText: "#ffffff",
    choiceBg: "rgba(4, 69, 175, 0.05)",
    choiceBorder: "rgba(4, 69, 175, 0.25)",
    choiceText: "#0445af",
    choiceSelBg: "#0445af",
    choiceSelText: "#ffffff",
    badgeBg: "#ffffff",
    badgeText: "#0445af",
    line: "#0445af",
  },
  inky: {
    id: "inky",
    name: "Inky Black",
    bg: "#1f1d24",
    color: "#ffffff",
    mutedColor: "#9ca3af",
    btn: "#ffffff",
    btnText: "#191919",
    choiceBg: "rgba(255, 255, 255, 0.08)",
    choiceBorder: "rgba(255, 255, 255, 0.22)",
    choiceText: "#ffffff",
    choiceSelBg: "#ffffff",
    choiceSelText: "#191919",
    badgeBg: "rgba(255, 255, 255, 0.16)",
    badgeText: "#ffffff",
    line: "#ffffff",
  },
  teal: {
    id: "teal",
    name: "Plain Blue",
    bg: "#e6f4f1",
    color: "#064e3b",
    mutedColor: "#0f766e",
    btn: "#0f766e",
    btnText: "#ffffff",
    choiceBg: "rgba(15, 118, 110, 0.07)",
    choiceBorder: "rgba(15, 118, 110, 0.3)",
    choiceText: "#064e3b",
    choiceSelBg: "#0f766e",
    choiceSelText: "#ffffff",
    badgeBg: "#ffffff",
    badgeText: "#0f766e",
    line: "#0f766e",
  },
};

export const THEME_LIST = Object.values(THEMES);

export function getTheme(id?: string): ThemeDefinition {
  if (!id || !THEMES[id]) return THEMES.pearl;
  return THEMES[id];
}

export function getThemeStyles(id?: string): React.CSSProperties {
  const t = getTheme(id);
  return {
    "--theme-bg": t.bg,
    "--theme-color": t.color,
    "--theme-muted": t.mutedColor,
    "--theme-btn": t.btn,
    "--theme-btn-text": t.btnText,
    "--theme-choice-bg": t.choiceBg,
    "--theme-choice-border": t.choiceBorder,
    "--theme-choice-text": t.choiceText,
    "--theme-choice-sel-bg": t.choiceSelBg,
    "--theme-choice-sel-text": t.choiceSelText,
    "--theme-badge-bg": t.badgeBg,
    "--theme-badge-text": t.badgeText,
    "--theme-line": t.line,
  } as React.CSSProperties;
}
