import Dexie, { type Table } from "dexie";
import type { ActiveWorkout, BodyEntry, Settings, SyncMeta, WorkoutHistory, WorkoutPhotoQueueEntry, WorkoutTemplate } from "./types";
import { defaultTemplates } from "./seed";
import { normalizeSettings } from "./settings";
import { restoreActiveWorkout } from "./workoutLogic";
import { recordTimestampForWrite } from "./syncTimestamps";

let preserveIncomingSyncTimestamps=false;

export async function withPreservedSyncTimestamps<T>(operation:()=>Promise<T>):Promise<T>{
 const previous=preserveIncomingSyncTimestamps;
 preserveIncomingSyncTimestamps=true;
 try{return await operation()}finally{preserveIncomingSyncTimestamps=previous}
}

class GymDB extends Dexie {
 templates!:Table<WorkoutTemplate,string>;
 active!:Table<ActiveWorkout,string>;
 workouts!:Table<WorkoutHistory,string>;
 body!:Table<BodyEntry,string>;
 settings!:Table<Settings,string>;
 syncMeta!:Table<SyncMeta,string>;
 workoutMedia!:Table<WorkoutPhotoQueueEntry,string>;
 constructor(){
  super("gym-pwa");
  this.version(1).stores({
   templates:"id,name",
   active:"id,templateId,startedAt",
   workouts:"id,templateId,startedAt,endedAt",
   body:"id,date",
   settings:"id"
  });
  this.version(2).stores({
   templates:"id,name",
   active:"id,templateId,startedAt",
   workouts:"id,templateId,startedAt,endedAt",
   body:"id,date",
   settings:"id"
  }).upgrade(async transaction=>{
   const settings=transaction.table("settings");
   const current=await settings.get("main");
   if(current)await settings.put(normalizeSettings(current));
   await transaction.table("active").toCollection().modify((workout:ActiveWorkout)=>Object.assign(workout,restoreActiveWorkout(workout)));
  });
  this.version(3).stores({
   templates:"id,name",
   active:"id,templateId,startedAt",
   workouts:"id,templateId,startedAt,endedAt",
   body:"id,date",
   settings:"id",
   syncMeta:"id,userId"
  }).upgrade(async transaction=>{
   const now=Date.now();
   for(const tableName of ["templates","workouts","body","settings","active"]){
    await transaction.table(tableName).toCollection().modify((row:{updatedAt?:number;createdAt?:number;startedAt?:number;endedAt?:number;date?:number})=>{
     row.updatedAt??=row.createdAt??row.endedAt??row.date??row.startedAt??now;
    });
   }
   if(!(await transaction.table("syncMeta").get("main")))await transaction.table("syncMeta").put({id:"main"});
  });
  this.version(4).stores({
   templates:"id,name",
   active:"id,templateId,startedAt",
   workouts:"id,templateId,startedAt,endedAt",
   body:"id,date",
   settings:"id",
   syncMeta:"id,userId",
   workoutMedia:"id,userId,workoutId,status"
  });
  this.installUpdatedAtHook(this.templates);
  this.installUpdatedAtHook(this.active);
  this.installUpdatedAtHook(this.workouts);
  this.installUpdatedAtHook(this.body);
  this.installUpdatedAtHook(this.settings);
 }

 private installUpdatedAtHook<T extends {updatedAt?:number}>(table:Table<T,string>){
  table.hook("creating",(_key,row)=>{
   const updatedAt=recordTimestampForWrite(undefined,row.updatedAt,Date.now(),preserveIncomingSyncTimestamps,true);
   if(updatedAt!==undefined)row.updatedAt=updatedAt;
  });
  table.hook("updating",(changes,_key,row)=>{
   const incomingUpdatedAt=(changes as Partial<T>).updatedAt;
   const updatedAt=recordTimestampForWrite(row.updatedAt,incomingUpdatedAt,Date.now(),preserveIncomingSyncTimestamps);
   return updatedAt===undefined?changes:{...changes,updatedAt};
  });
 }
}
export const db=new GymDB();

export async function ensureSeed(){
 if(await db.templates.count()===0) await db.templates.bulkPut(defaultTemplates.map(template=>({...template,updatedAt:Date.now()})));
 if(!(await db.settings.get("main"))) await db.settings.put(normalizeSettings(null));
 if(!(await db.syncMeta.get("main")))await db.syncMeta.put({id:"main"});
}
