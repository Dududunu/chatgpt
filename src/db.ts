import Dexie, { type Table } from "dexie";
import type { ActiveWorkout, BodyEntry, Settings, WorkoutHistory, WorkoutTemplate } from "./types";
import { defaultTemplates } from "./seed";
import { normalizeSettings } from "./settings";
import { restoreActiveWorkout } from "./workoutLogic";

class GymDB extends Dexie {
 templates!:Table<WorkoutTemplate,string>;
 active!:Table<ActiveWorkout,string>;
 workouts!:Table<WorkoutHistory,string>;
 body!:Table<BodyEntry,string>;
 settings!:Table<Settings,string>;
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
 }
}
export const db=new GymDB();

export async function ensureSeed(){
 if(await db.templates.count()===0) await db.templates.bulkPut(defaultTemplates);
 if(!(await db.settings.get("main"))) await db.settings.put(normalizeSettings(null));
}
