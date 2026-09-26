import { describe,expect,it } from "vitest";
import { mergeRecords,shouldSyncWhileOnline,type VersionedRecord } from "./syncLogic";

const row=(id:string,updatedAt:number,data:string|null,deletedAt?:number):VersionedRecord<string>=>({id,updatedAt,data,deletedAt});

describe("record-level sync merge",()=>{
 it("pushes records that exist only locally",()=>{
  const merged=mergeRecords([row("a",10,"local")],[]);
  expect(merged.upload).toEqual([row("a",10,"local")]);expect(merged.pull).toEqual([]);
 });
 it("pulls records that exist only in cloud",()=>{
  const merged=mergeRecords([], [row("a",10,"cloud")]);
  expect(merged.pull).toEqual([row("a",10,"cloud")]);
 });
 it("uses the newer local version without replacing unrelated cloud records",()=>{
  const merged=mergeRecords([row("a",12,"local")],[row("a",10,"old"),row("b",9,"other")]);
  expect(merged.upload.map(item=>item.id)).toEqual(["a"]);
  expect(merged.records).toEqual([row("a",12,"local"),row("b",9,"other")]);
 });
 it("uses the newer cloud version and returns it for local persistence",()=>{
  const merged=mergeRecords([row("a",8,"old")],[row("a",11,"cloud")]);
  expect(merged.pull).toEqual([row("a",11,"cloud")]);
 });
 it("propagates a newer soft delete as a tombstone",()=>{
  const merged=mergeRecords([row("a",10,"template")],[row("a",12,"template",12)]);
  expect(merged.records[0].deletedAt).toBe(12);expect(merged.upload).toEqual([]);
 });
 it("does not let stale local history overwrite a newer cloud workout",()=>{
  const merged=mergeRecords([row("old-workout",100,"stale")],[row("old-workout",200,"newer")]);
  expect(merged.records[0].data).toBe("newer");expect(merged.upload).toHaveLength(0);
 });
 it("can keep multiple non-conflicting records from both devices",()=>{
  const merged=mergeRecords([row("local",1,"L")],[row("cloud",2,"C")]);
  expect(merged.records.map(item=>item.id).sort()).toEqual(["cloud","local"]);
  expect(merged.upload).toHaveLength(1);expect(merged.pull).toHaveLength(1);
 });
 it("leaves offline changes local and allows sync again when online",()=>{
  expect(shouldSyncWhileOnline(false)).toBe(false);expect(shouldSyncWhileOnline(true)).toBe(true);
 });
});
