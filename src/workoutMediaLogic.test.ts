import { describe,expect,it } from "vitest";
import type { WorkoutPhotoQueueEntry } from "./types";
import {
 markWorkoutPhotoDeleteFailed,
 markWorkoutPhotoUploadFailed,
 photoPathsReadyToDelete,
 queueWorkoutPhotoRemoval,
 queueWorkoutPhotoUpload,
 removeCompletedPhotoDeletions,
 shouldUploadWorkoutPhoto,
} from "./workoutMediaLogic";

const path="user-a/workout-1/photo-old.webp";
const queued=(patch:Partial<WorkoutPhotoQueueEntry>={}):WorkoutPhotoQueueEntry=>({
 id:"user-a:workout-1",userId:"user-a",workoutId:"workout-1",blob:new Blob(["photo"],{type:"image/webp"}),photoPath:path,deletePaths:[],status:"pending",updatedAt:1,...patch,
});

describe("offline workout photo queue",()=>{
 it("stores a compressed Blob as a durable pending upload and replaces at most one row per workout",()=>{
  const first=queueWorkoutPhotoUpload("user-a","workout-1",new Blob(["first"],{type:"image/webp"}),null,10);
  const replacement=queueWorkoutPhotoUpload("user-a","workout-1",new Blob(["second"],{type:"image/webp"}),first,20);
  expect(replacement.id).toBe(first.id);
  expect(replacement.blob?.size).toBe(6);
  expect(replacement.status).toBe("pending");
 });

 it("keeps the queued Blob after a failed upload so the same workout can retry",()=>{
  const pending=queued();
  const error=markWorkoutPhotoUploadFailed(pending,"offline",20);
  expect(error.status).toBe("error");
  expect(error.errorPhase).toBe("upload");
  expect(error.blob).toBe(pending.blob);
  expect(queueWorkoutPhotoUpload(error.userId,error.workoutId,error.blob!,error,30).status).toBe("pending");
 });

 it("queues cleanup for an uncertain old upload when the user replaces it",()=>{
  const failed=markWorkoutPhotoUploadFailed(queued({queuedPath:"user-a/workout-1/photo-uncertain.webp"}),"timeout",20);
  const replacement=queueWorkoutPhotoUpload("user-a","workout-1",new Blob(["replacement"]),failed,30,"user-a/workout-1/photo-next.webp");
  expect(replacement.queuedPath).toBe("user-a/workout-1/photo-next.webp");
  expect(replacement.deletePaths).toContain("user-a/workout-1/photo-uncertain.webp");
 });

 it("schedules an existing image for deletion while removing pending local bytes",()=>{
  const removed=queueWorkoutPhotoRemoval("user-a","workout-1",queued(),path,40);
  expect(removed).toMatchObject({status:"pending",blob:null,photoPath:null,deletePaths:[path]});
 });

 it("does not queue paths belonging to another user or workout",()=>{
  const other="user-b/workout-1/photo-old.webp";
  expect(queueWorkoutPhotoRemoval("user-a","workout-1",null,other)).toBeNull();
  expect(photoPathsReadyToDelete(queued({deletePaths:[other,path]}),path)).toEqual([]);
 });

 it("preserves the current cloud photo and removes only obsolete photo paths",()=>{
  const entry=queued({deletePaths:[path,"user-a/workout-1/photo-new.webp"]});
  expect(photoPathsReadyToDelete(entry,"user-a/workout-1/photo-new.webp")).toEqual([path]);
  expect(removeCompletedPhotoDeletions(entry,[path],50)?.deletePaths).toEqual(["user-a/workout-1/photo-new.webp"]);
 });

 it("retains failed deletions for retry and clears the queue after success",()=>{
  const failed=markWorkoutPhotoDeleteFailed(queued({blob:null,deletePaths:[path]}),"network",60);
  expect(failed.status).toBe("error");
  expect(failed.deletePaths).toEqual([path]);
  expect(removeCompletedPhotoDeletions(failed,[path],70)).toBeNull();
 });

 it("retries failed uploads but never re-uploads a saved photo when only cleanup failed",()=>{
  expect(shouldUploadWorkoutPhoto(markWorkoutPhotoUploadFailed(queued(),"offline"))).toBe(true);
  const saved=markWorkoutPhotoDeleteFailed(queued({queuedPath:null,deletePaths:[path],status:"uploaded"}),"network");
  expect(shouldUploadWorkoutPhoto(saved)).toBe(false);
 });
});
