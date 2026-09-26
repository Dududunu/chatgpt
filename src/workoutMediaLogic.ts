import type { WorkoutPhotoQueueEntry } from "./types";
import { isWorkoutPhotoPathOwnedBy, workoutPhotoQueueId } from "./workoutReview";

export function queueWorkoutPhotoUpload(
 userId:string,
 workoutId:string,
 blob:Blob,
 current:WorkoutPhotoQueueEntry|null,
 now=Date.now(),
 queuedPath:string|null=null,
):WorkoutPhotoQueueEntry{
 const deletePaths=new Set(current?.deletePaths??[]);
 if(current?.queuedPath&&(current.status==="uploading"||current.status==="error"&&current.errorPhase==="upload"))deletePaths.add(current.queuedPath);
 return {
  id:workoutPhotoQueueId(userId,workoutId),
  userId,
  workoutId,
  blob,
  queuedPath,
  photoPath:current?.photoPath??null,
  deletePaths:[...deletePaths],
  status:"pending",
  updatedAt:now,
 };
}

export function queueWorkoutPhotoRemoval(
 userId:string,
 workoutId:string,
 current:WorkoutPhotoQueueEntry|null,
 photoPath:string|null|undefined,
 now=Date.now(),
):WorkoutPhotoQueueEntry|null{
 const deletePaths=new Set(current?.deletePaths??[]);
 if(photoPath&&isWorkoutPhotoPathOwnedBy(photoPath,userId,workoutId))deletePaths.add(photoPath);
 if((current?.status==="uploading"||current?.status==="error")&&current.queuedPath&&isWorkoutPhotoPathOwnedBy(current.queuedPath,userId,workoutId))deletePaths.add(current.queuedPath);
 const next:WorkoutPhotoQueueEntry={
  id:workoutPhotoQueueId(userId,workoutId),
  userId,
  workoutId,
  blob:null,
  photoPath:null,
  deletePaths:[...deletePaths],
  status:deletePaths.size?"pending":"uploaded",
  updatedAt:now,
 };
 return next.status==="uploaded"?null:next;
}

export function markWorkoutPhotoUploadFailed(entry:WorkoutPhotoQueueEntry,error:string,now=Date.now()):WorkoutPhotoQueueEntry{
 return {...entry,status:"error",errorPhase:"upload",lastError:error,updatedAt:now};
}

export function markWorkoutPhotoDeleteFailed(entry:WorkoutPhotoQueueEntry,error:string,now=Date.now()):WorkoutPhotoQueueEntry{
 return {...entry,status:"error",errorPhase:"delete",lastError:error,updatedAt:now};
}

export function photoPathsReadyToDelete(entry:WorkoutPhotoQueueEntry,currentPath:string|null|undefined):string[]{
 return [...new Set(entry.deletePaths)].filter(path=>path!==currentPath&&isWorkoutPhotoPathOwnedBy(path,entry.userId,entry.workoutId));
}

export function shouldUploadWorkoutPhoto(entry:WorkoutPhotoQueueEntry):boolean{
 if(!entry.blob)return false;
 if(entry.status==="uploaded"&&!entry.queuedPath)return false;
 if(entry.status==="error"&&entry.errorPhase==="delete"&&!entry.queuedPath)return false;
 return true;
}

export function removeCompletedPhotoDeletions(entry:WorkoutPhotoQueueEntry,deletedPaths:readonly string[],now=Date.now()):WorkoutPhotoQueueEntry|null{
 const deleted=new Set(deletedPaths);
 const deletePaths=entry.deletePaths.filter(path=>!deleted.has(path));
 if(!entry.blob&&deletePaths.length===0)return null;
 return {...entry,deletePaths,status:entry.blob?entry.status:"uploaded",errorPhase:undefined,lastError:undefined,updatedAt:now};
}
