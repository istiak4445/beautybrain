import acsLogo from "../assets/acs-logo.png";
import chemshifuLogo from "../assets/chemshifu-logo.png";

export type SlideLogo = {
  src: string;
  width: number;
  height: number;
};

export type SlideLogos = {
  left: SlideLogo | null;
  right: SlideLogo | null;
};

export type LogoChoice = "acs" | "chemshifu" | "none" | "custom";

export const LOGO_PRESETS = {
  acs: { src: acsLogo, width: 741, height: 325 },
  chemshifu: { src: chemshifuLogo, width: 1280, height: 418 },
} satisfies Record<"acs" | "chemshifu", SlideLogo>;

export const DEFAULT_SLIDE_LOGOS: SlideLogos = {
  left: LOGO_PRESETS.acs,
  right: LOGO_PRESETS.chemshifu,
};

export function resolveLogo(choice: LogoChoice, custom: SlideLogo | null) {
  if (choice === "none") return null;
  if (choice === "custom") return custom;
  return LOGO_PRESETS[choice];
}
