import { describe,expect,it } from "vitest";
import { normalizeSettings } from "./settings";

describe("IndexedDB settings migration",()=>{
 it("fills fields missing from older records and keeps existing preferences",()=>{
  expect(normalizeSettings({id:"main",defaultRestSec:150,autoRest:false,sound:false,vibration:true,theme:"light"})).toEqual({
   id:"main",defaultRestSec:150,autoRest:false,sound:false,vibration:true,theme:"light",hideMotion:false,defaultRir:"2",defaultIncrement:2.5
  });
 });
 it("provides defaults when an old backup has no settings record",()=>{
  expect(normalizeSettings(null)).toMatchObject({id:"main",defaultRestSec:120,autoRest:true,theme:"dark",defaultRir:"2",defaultIncrement:2.5});
 });
});
