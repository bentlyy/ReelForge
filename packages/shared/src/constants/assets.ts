export const ASSET_KINDS = [
  "image",
  "audio",
  "subtitle",
  "video",
  "manifest",
  "other",
] as const;

export type AssetKind = (typeof ASSET_KINDS)[number];
