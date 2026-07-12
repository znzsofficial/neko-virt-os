/** Major runtime dependencies shown in About. Keep versions in sync with package-lock when upgrading. */
export type OpenSourcePackage = {
  name: string;
  version: string;
  license: string;
  note?: string;
};

export const OPEN_SOURCE_PACKAGES: readonly OpenSourcePackage[] = [
  { name: "react", version: "19.2.7", license: "MIT" },
  { name: "react-dom", version: "19.2.7", license: "MIT" },
  { name: "three", version: "0.185.1", license: "MIT" },
  { name: "@react-three/fiber", version: "9.6.1", license: "MIT" },
  { name: "@react-three/drei", version: "10.7.7", license: "MIT" },
  { name: "postprocessing", version: "6.39.2", license: "Zlib" },
  { name: "@yohawing/three-mmd-loader", version: "0.6.0", license: "MIT" },
  { name: "mediabunny", version: "1.50.8", license: "MPL-2.0" },
  { name: "zustand", version: "5.0.14", license: "MIT" },
  { name: "dexie", version: "4.4.4", license: "Apache-2.0" },
  { name: "zod", version: "4.4.3", license: "MIT" },
  { name: "marked", version: "18.0.6", license: "MIT" },
  { name: "dompurify", version: "3.4.12", license: "MPL-2.0 OR Apache-2.0" },
  { name: "cmdk", version: "1.1.1", license: "MIT" },
  { name: "fuse.js", version: "7.4.2", license: "Apache-2.0" },
  { name: "nanoid", version: "5.1.16", license: "MIT" },
  { name: "clsx", version: "2.1.1", license: "MIT" },
  { name: "react-rnd", version: "10.5.3", license: "MIT" },
  { name: "react-hotkeys-hook", version: "5.3.3", license: "MIT" },
  { name: "@iconify-icon/react", version: "3.0.3", license: "MIT" },
  { name: "qrcode.react", version: "4.2.0", license: "ISC" },
  { name: "jsqr", version: "1.4.0", license: "Apache-2.0" },
] as const;

export const APP_VERSION = "0.1.0";
