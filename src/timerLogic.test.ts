import { describe,expect,it } from "vitest";
import { createManualRest,remainingRestMs,restProgress,restSessionKey,shouldShowFullscreenTimer } from "./timerLogic";
import { adjustRestTimer,isRestNotificationDue,restoreActiveWorkout,toggleRestPause } from "./workoutLogic";
import type { ActiveWorkout,RestState } from "./types";

const rest:RestState={kind:"rest",exerciseName:"Bench Press",nextSet:2,startedAt:10_000,endsAt:130_000};
const workout:ActiveWorkout={id:"active",templateId:"upper",name:"UPPER 1",startedAt:1,rest,exercises:[]};

describe("fullscreen rest timer recovery",()=>{
 it("opens automatically for a new rest and reopens the same persisted timer after reload",()=>{
  const key=restSessionKey(workout.id,rest);
  expect(shouldShowFullscreenTimer(workout.id,rest,null)).toBe(true);
  expect(shouldShowFullscreenTimer(workout.id,rest,key)).toBe(false);
  const restored=restoreActiveWorkout(structuredClone(workout));
  expect(restored.rest).toEqual(rest);
  expect(shouldShowFullscreenTimer(restored.id,restored.rest,null)).toBe(true);
  expect(remainingRestMs(restored.rest!,50_000)).toBe(80_000);
 });

 it("keeps a finished timer visible and marks it complete until the user clears it",()=>{
  const finished={...rest,notifiedAt:130_000};
  expect(remainingRestMs(finished,140_000)).toBe(0);
  expect(restProgress(finished,140_000)).toBe(1);
  expect(isRestNotificationDue(finished,140_000)).toBe(false);
  expect(shouldShowFullscreenTimer(workout.id,finished,null)).toBe(true);
  expect(shouldShowFullscreenTimer(workout.id,null,null)).toBe(false);
 });

 it("pauses and resumes from the saved remainder and supports 30 second adjustments",()=>{
  const paused=toggleRestPause(rest,40_000);
  expect(paused.pausedRemaining).toBe(90_000);
  const shorter=adjustRestTimer(paused,-30,45_000);
  expect(shorter.pausedRemaining).toBe(60_000);
  const longer=adjustRestTimer(shorter,30,45_000);
  expect(longer.pausedRemaining).toBe(90_000);
  const resumed=toggleRestPause(longer,60_000);
  expect(remainingRestMs(resumed,70_000)).toBe(80_000);
 });

 it("does not restart notifications by changing a timer after it has ended",()=>{
  const finished={...rest,notifiedAt:130_000};
  expect(adjustRestTimer(finished,-30,140_000)).toEqual(finished);
  expect(toggleRestPause(finished,140_000)).toEqual(finished);
 });

 it("creates a manual timer that uses the same persisted fullscreen flow",()=>{
  const manual=createManualRest(150,20_000);
  expect(manual).toEqual({kind:"manual",exerciseName:"Timer ręczny",nextSet:0,startedAt:20_000,endsAt:170_000});
  expect(shouldShowFullscreenTimer(workout.id,manual,null)).toBe(true);
 });
});
