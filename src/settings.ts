import type { Settings } from "./types";
import { DEFAULT_PLATES } from "./barbellTools";

const defaults:Settings={
 id:"main",
 defaultRestSec:120,
 autoRest:true,
 sound:true,
 vibration:true,
 theme:"dark",
 hideMotion:false,
 showExerciseImages:true,
 defaultRir:"2",
 defaultIncrement:2.5,
 prefillPreviousWeight:false,
 keepScreenAwake:true,
 haptics:true,
 barWeight:20,
 availablePlates:DEFAULT_PLATES,
 copyPreviousRir:false
};

/** Adds settings introduced by later app versions while preserving stored preferences. */
export function normalizeSettings(value:Partial<Settings>|null|undefined):Settings{
 return {
  ...defaults,
  ...value,
  id:"main",
  hideMotion:value?.hideMotion??defaults.hideMotion,
  showExerciseImages:value?.showExerciseImages??!(value?.hideMotion??defaults.hideMotion),
  defaultRir:value?.defaultRir??defaults.defaultRir,
  defaultIncrement:value?.defaultIncrement??defaults.defaultIncrement,
  prefillPreviousWeight:value?.prefillPreviousWeight??defaults.prefillPreviousWeight,
  keepScreenAwake:value?.keepScreenAwake??defaults.keepScreenAwake,
  haptics:value?.haptics??value?.vibration??defaults.haptics,
  barWeight:value?.barWeight??defaults.barWeight,
  availablePlates:value?.availablePlates? [...new Set(value.availablePlates.filter(plate=>Number.isFinite(plate)&&plate>0))]:[...DEFAULT_PLATES],
  copyPreviousRir:value?.copyPreviousRir??defaults.copyPreviousRir
 };
}
