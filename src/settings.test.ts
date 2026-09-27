import { describe,expect,it } from "vitest";
import { normalizeSettings } from "./settings";

describe("IndexedDB settings migration",()=>{
 it("fills fields missing from older records and keeps existing preferences",()=>{
  expect(normalizeSettings({id:"main",defaultRestSec:150,autoRest:false,sound:false,vibration:true,theme:"light"})).toEqual({
   id:"main",defaultRestSec:150,autoRest:false,sound:false,vibration:true,theme:"light",hideMotion:false,showExerciseImages:true,defaultRir:"2",defaultIncrement:2.5,prefillPreviousWeight:false,keepScreenAwake:true,haptics:true,barWeight:20,availablePlates:[25,20,15,10,5,2.5,1.25,.5],copyPreviousRir:false
  });
 });
 it("provides defaults when an old backup has no settings record",()=>{
  expect(normalizeSettings(null)).toMatchObject({id:"main",defaultRestSec:120,autoRest:true,theme:"dark",defaultRir:"2",defaultIncrement:2.5,haptics:true,barWeight:20,copyPreviousRir:false});
 });
 it("keeps the exercise-image preference and migrates the old hide-preview preference",()=>{
  expect(normalizeSettings({showExerciseImages:false}).showExerciseImages).toBe(false);
  expect(normalizeSettings({hideMotion:true}).showExerciseImages).toBe(false);
  expect(normalizeSettings({hideMotion:true,showExerciseImages:true}).showExerciseImages).toBe(true);
 });
});
