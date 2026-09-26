import { db } from "./db";
import type { WorkoutHistory, WorkoutPhotoQueueEntry } from "./types";
import {
 markWorkoutPhotoDeleteFailed,
 markWorkoutPhotoUploadFailed,
 photoPathsReadyToDelete,
 queueWorkoutPhotoRemoval as createWorkoutPhotoRemovalEntry,
 queueWorkoutPhotoUpload as createWorkoutPhotoUploadEntry,
 removeCompletedPhotoDeletions,
 shouldUploadWorkoutPhoto,
} from "./workoutMediaLogic";
import { isWorkoutPhotoPathOwnedBy, workoutPhotoQueueId } from "./workoutReview";
import { supabase } from "./supabase";

export const WORKOUT_MEDIA_BUCKET="workout-media";
const MAX_STORED_PHOTO_BYTES=25*1024*1024;

function nextTimestamp(previous=0){return Math.max(Date.now(),previous+1)}

export async function queueWorkoutPhotoUpload(userId:string,workoutId:string,blob:Blob):Promise<WorkoutPhotoQueueEntry>{
 if(!userId)throw new Error("Zaloguj się, aby dołączyć zdjęcie do treningu.");
 if(blob.size<=0||blob.size>MAX_STORED_PHOTO_BYTES)throw new Error("Skompresowane zdjęcie ma nieprawidłowy rozmiar.");
 if(blob.type!=="image/webp"&&blob.type!=="image/jpeg")throw new Error("Zdjęcie musi być zapisane jako WebP lub JPEG.");
 const id=workoutPhotoQueueId(userId,workoutId);
 const previous=await db.workoutMedia.get(id)??null;
 const extension=blob.type==="image/webp"?"webp":"jpg";
 const queuedPath=`${userId}/${workoutId}/photo-${crypto.randomUUID()}.${extension}`;
 const entry=createWorkoutPhotoUploadEntry(userId,workoutId,blob,previous,nextTimestamp(previous?.updatedAt),queuedPath);
 await db.workoutMedia.put(entry);
 return entry;
}

export async function queueWorkoutPhotoRemoval(userId:string,workoutId:string):Promise<void>{
 if(!userId)return;
 const id=workoutPhotoQueueId(userId,workoutId);
 const current=await db.workoutMedia.get(id)??null;
 const workout=await db.workouts.get(workoutId);
 const next=createWorkoutPhotoRemovalEntry(userId,workoutId,current,workout?.photoPath,nextTimestamp(current?.updatedAt));
 if(next)await db.workoutMedia.put(next);
 else await db.workoutMedia.delete(id);
}

export async function localWorkoutPhoto(userId:string,workoutId:string):Promise<WorkoutPhotoQueueEntry|null>{
 return (await db.workoutMedia.get(workoutPhotoQueueId(userId,workoutId)))??null;
}

export async function resolveWorkoutPhoto(userId:string,workout:WorkoutHistory):Promise<Blob|null>{
 const id=workoutPhotoQueueId(userId,workout.id);
 const local=await db.workoutMedia.get(id)??null;
 if(local?.blob)return local.blob;
 const path=workout.photoPath;
 if(!path||!isWorkoutPhotoPathOwnedBy(path,userId,workout.id)||!navigator.onLine)return null;
 if(local?.photoPath===path&&local.blob)return local.blob;
 const {data,error}=await supabase.storage.from(WORKOUT_MEDIA_BUCKET).download(path);
 if(error||!data)throw error??new Error("Nie udało się pobrać zdjęcia treningu.");
 const latest=await db.workoutMedia.get(id)??local;
 await db.workoutMedia.put({
  id,userId,workoutId:workout.id,blob:data,queuedPath:latest?.queuedPath??null,photoPath:path,
  deletePaths:latest?.deletePaths??[],status:latest?.status??"uploaded",
  ...(latest?.errorPhase?{errorPhase:latest.errorPhase}:{}),...(latest?.lastError?{lastError:latest.lastError}:{}),
  updatedAt:nextTimestamp(latest?.updatedAt),
 });
 return data;
}

function mediaError(error:unknown):string{
 return error instanceof Error?error.message:"Nie udało się zsynchronizować zdjęcia.";
}

async function authenticatedUserMatches(userId:string):Promise<boolean>{
 const {data,error}=await supabase.auth.getSession();
 if(error)throw error;
 return data.session?.user.id===userId;
}

async function uploadQueuedPhotos(userId:string){
 const rows=await db.workoutMedia.where("userId").equals(userId).toArray();
 for(const initial of rows){
  let queued=await db.workoutMedia.get(initial.id);
  if(!queued||!shouldUploadWorkoutPhoto(queued))continue;
  let uploadMayExist=queued.status==="uploading"||queued.status==="error";
  if(queued.status==="uploading"){
   if(Date.now()-queued.updatedAt<60_000)continue;
   queued={...queued,status:"pending",updatedAt:nextTimestamp(queued.updatedAt)};
   await db.workoutMedia.put(queued);
  }
  const queuedBlob=queued.blob;
  if(!queuedBlob)continue;
  const workout=await db.workouts.get(queued.workoutId);
  if(!workout||workout.deletedAt!==undefined){
   const removal=createWorkoutPhotoRemovalEntry(userId,queued.workoutId,queued,workout?.photoPath??queued.photoPath,nextTimestamp(queued.updatedAt));
   if(removal){removal.blob=null;removal.queuedPath=null;removal.deletePaths=[...new Set([...removal.deletePaths,...(uploadMayExist&&queued.queuedPath?[queued.queuedPath]:[])])];await db.workoutMedia.put(removal)}
   else await db.workoutMedia.delete(queued.id);
   continue;
  }
  const target=queued.queuedPath;
  if(!target||!isWorkoutPhotoPathOwnedBy(target,userId,queued.workoutId)){
   await db.workoutMedia.put(markWorkoutPhotoUploadFailed(queued,"Nieprawidłowa ścieżka zdjęcia.",nextTimestamp(queued.updatedAt)));
   continue;
  }
  const startedAt=nextTimestamp(queued.updatedAt);
  await db.workoutMedia.put({...queued,status:"uploading",errorPhase:undefined,lastError:undefined,updatedAt:startedAt});
  const {error}=await supabase.storage.from(WORKOUT_MEDIA_BUCKET).upload(target,queuedBlob,{
   cacheControl:"3600",contentType:queuedBlob.type,upsert:true,
  });
  if(error){
   const current=await db.workoutMedia.get(queued.id);
   if(current?.updatedAt===startedAt)await db.workoutMedia.put(markWorkoutPhotoUploadFailed(current,mediaError(error),nextTimestamp(current.updatedAt)));
   continue;
  }

  const currentQueue=await db.workoutMedia.get(queued.id);
  if(!currentQueue||currentQueue.status!=="uploading"||currentQueue.updatedAt!==startedAt){
   if(currentQueue){
    await db.workoutMedia.put({...currentQueue,deletePaths:[...new Set([...currentQueue.deletePaths,target])],status:currentQueue.blob?"pending":"uploaded",errorPhase:undefined,lastError:undefined,updatedAt:nextTimestamp(currentQueue.updatedAt)});
   }
   continue;
  }
  const latestWorkout=await db.workouts.get(queued.workoutId);
  if(!latestWorkout||latestWorkout.deletedAt!==undefined){
   const cleanup=createWorkoutPhotoRemovalEntry(userId,queued.workoutId,currentQueue,latestWorkout?.photoPath,nextTimestamp(currentQueue.updatedAt));
   if(cleanup){cleanup.blob=null;cleanup.queuedPath=null;cleanup.deletePaths=[...new Set([...cleanup.deletePaths,...(uploadMayExist?[target]:[])])];await db.workoutMedia.put(cleanup)}
   else await db.workoutMedia.delete(queued.id);
   continue;
  }
  const previousPath=latestWorkout.photoPath;
  await db.workouts.put({...latestWorkout,photoPath:target,updatedAt:nextTimestamp(latestWorkout.updatedAt)});
  const completed:WorkoutPhotoQueueEntry={
   ...currentQueue,blob:queuedBlob,queuedPath:null,photoPath:target,
   deletePaths:[...new Set([...currentQueue.deletePaths,...(previousPath&&previousPath!==target?[previousPath]:[])])],
   status:"uploaded",errorPhase:undefined,lastError:undefined,updatedAt:nextTimestamp(currentQueue.updatedAt),
  };
  await db.workoutMedia.put(completed);
 }
}

async function deleteObsoletePhotos(userId:string){
 const rows=await db.workoutMedia.where("userId").equals(userId).toArray();
 for(const initial of rows){
  const entry=await db.workoutMedia.get(initial.id);
  if(!entry||entry.status==="uploading"||entry.blob&&(entry.status==="pending"||entry.errorPhase==="upload"))continue;
  const workout=await db.workouts.get(entry.workoutId);
  const currentPath=workout?.deletedAt===undefined?workout?.photoPath:null;
  const protectedPaths=new Set(entry.deletePaths.filter(path=>path===currentPath));
  const deletable=photoPathsReadyToDelete(entry,currentPath);
  const remaining=entry.deletePaths.filter(path=>!protectedPaths.has(path));
  if(remaining.length!==entry.deletePaths.length){entry.deletePaths=remaining;entry.updatedAt=nextTimestamp(entry.updatedAt);await db.workoutMedia.put(entry)}
  if(!deletable.length){
   const updated=removeCompletedPhotoDeletions(entry,[],nextTimestamp(entry.updatedAt));
   if(updated)await db.workoutMedia.put(updated);else await db.workoutMedia.delete(entry.id);
   continue;
  }
  const {error}=await supabase.storage.from(WORKOUT_MEDIA_BUCKET).remove(deletable);
  if(error){
   const latest=await db.workoutMedia.get(entry.id);
   if(latest)await db.workoutMedia.put(markWorkoutPhotoDeleteFailed(latest,mediaError(error),nextTimestamp(latest.updatedAt)));
   continue;
  }
  const latest=await db.workoutMedia.get(entry.id);
  if(!latest)continue;
  const updated=removeCompletedPhotoDeletions(latest,deletable,nextTimestamp(latest.updatedAt));
  if(updated)await db.workoutMedia.put(updated);else await db.workoutMedia.delete(entry.id);
 }
}

export async function processWorkoutMedia(userId:string,phase:"upload"|"delete"):Promise<void>{
 if(!navigator.onLine||!(await authenticatedUserMatches(userId)))return;
 if(phase==="upload")await uploadQueuedPhotos(userId);
 else await deleteObsoletePhotos(userId);
}
