/**
 * Launcher icons built into the native app (origin-app assets/app-icons/icons.json).
 * The admin picks one at /admin/app-icon; /api/mobile/config sends it as `appIcon`
 * and the app switches its home-screen icon the next time it goes to the background.
 * An app can only show icons inside its build, so a new design needs an app release:
 * keep this list in step with the app's catalogue (an id an older build lacks is ignored there).
 */
export const APP_ICONS = [
  { id: "default", label: "Origin (normal)", when: "Any time" },
  { id: "diwali", label: "Diwali", when: "October – November" },
  { id: "holi", label: "Holi", when: "March" },
  { id: "eid", label: "Eid", when: "Eid al-Fitr / Eid al-Adha" },
  { id: "christmas", label: "Christmas", when: "December" },
  { id: "ganesh", label: "Ganesh Chaturthi", when: "August – September" },
  { id: "navratri", label: "Navratri / Durga Puja", when: "September – October" },
  { id: "rakhi", label: "Raksha Bandhan", when: "August" },
  { id: "national", label: "Independence Day / Republic Day", when: "15 August, 26 January" },
  { id: "harvest", label: "Makar Sankranti / Pongal / Lohri", when: "January" },
  { id: "onam", label: "Onam", when: "August – September" },
] as const;

export type AppIconId = (typeof APP_ICONS)[number]["id"];

export function isAppIconId(value: unknown): value is AppIconId {
  return typeof value === "string" && APP_ICONS.some((icon) => icon.id === value);
}
