import type { Settings } from "./types";

const defaults:Settings={
 id:"main",
 defaultRestSec:120,
 autoRest:true,
 sound:true,
 vibration:true,
 theme:"dark",
 hideMotion:false,
 defaultRir:"2",
 defaultIncrement:2.5
};

/** Adds settings introduced by later app versions while preserving stored preferences. */
export function normalizeSettings(value:Partial<Settings>|null|undefined):Settings{
 return {
  ...defaults,
  ...value,
  id:"main",
  hideMotion:value?.hideMotion??defaults.hideMotion,
  defaultRir:value?.defaultRir??defaults.defaultRir,
  defaultIncrement:value?.defaultIncrement??defaults.defaultIncrement
 };
}
