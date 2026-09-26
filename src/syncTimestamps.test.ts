import { describe,expect,it } from "vitest";
import { recordTimestampForWrite } from "./syncTimestamps";

describe("local and synchronized record timestamps",()=>{
 it("preserves timestamps from pulled cloud rows on creation and update",()=>{
  expect(recordTimestampForWrite(undefined,100,200,true,true)).toBe(100);
  expect(recordTimestampForWrite(90,100,200,true)).toBe(100);
 });
 it("gives local writes a monotonic timestamp even if the device clock stalls",()=>{
  expect(recordTimestampForWrite(undefined,undefined,200,false,true)).toBe(200);
  expect(recordTimestampForWrite(200,undefined,150,false)).toBe(201);
 });
});
