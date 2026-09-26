import { describe,expect,it,vi } from "vitest";
import { shouldRequestScreenWakeLock,tryAcquireScreenWakeLock } from "./wakeLock";

describe("screen wake lock",()=>{
 it("requests only during an enabled active workout while visible and supported",()=>{
  expect(shouldRequestScreenWakeLock(true,true)).toBe(true);
  expect(shouldRequestScreenWakeLock(false,true)).toBe(false);
  expect(shouldRequestScreenWakeLock(true,false)).toBe(false);
  expect(shouldRequestScreenWakeLock(true,true,false)).toBe(false);
  expect(shouldRequestScreenWakeLock(true,true,true,false)).toBe(false);
 });
 it("silently handles unsupported and rejected browser APIs",async()=>{
  expect(await tryAcquireScreenWakeLock(undefined)).toBeNull();
  expect(await tryAcquireScreenWakeLock({request:vi.fn(async()=>{throw new Error("denied")})})).toBeNull();
 });
 it("acquires the browser lock when supported",async()=>{
  const lock={release:vi.fn()};const request=vi.fn(async()=>lock);
  expect(await tryAcquireScreenWakeLock({request})).toBe(lock);expect(request).toHaveBeenCalledWith("screen");
 });
});
