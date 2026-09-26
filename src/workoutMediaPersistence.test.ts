import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach,beforeEach,describe,expect,it } from "vitest";
import { db } from "./db";
import type { WorkoutHistory,WorkoutPhotoQueueEntry } from "./types";

describe("local workout review persistence",()=>{
 beforeEach(async()=>{
  db.close();
  await Dexie.delete("gym-pwa");
  await db.open();
 });
 afterEach(async()=>{
  db.close();
  await Dexie.delete("gym-pwa");
 });

 it("restores the review, private path, and pending photo Blob after IndexedDB is reopened",async()=>{
  const workout:WorkoutHistory={id:"workout-1",templateId:"upper",name:"UPPER 1",startedAt:100,endedAt:200,exercises:[],rating:4,reviewText:"Mocna sesja.",photoPath:null};
  const photo=new Blob(["compressed webp payload"],{type:"image/webp"});
  const entry:WorkoutPhotoQueueEntry={id:"user-a:workout-1",userId:"user-a",workoutId:workout.id,blob:photo,queuedPath:"user-a/workout-1/photo-pending.webp",photoPath:null,deletePaths:[],status:"pending",updatedAt:200};
  await db.workouts.put(workout);
  await db.workoutMedia.put(entry);

  db.close();
  await db.open();
  const restoredWorkout=await db.workouts.get(workout.id);
  const restoredPhoto=await db.workoutMedia.get(entry.id);
  expect(restoredWorkout).toMatchObject({rating:4,reviewText:"Mocna sesja.",photoPath:null});
  expect(restoredPhoto).toMatchObject({status:"pending",queuedPath:entry.queuedPath,userId:"user-a"});
  expect(await restoredPhoto?.blob?.text()).toBe("compressed webp payload");
 });
});
