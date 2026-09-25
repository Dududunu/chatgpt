import Dexie, { type Table } from "dexie";
import type { ActiveWorkout, BodyEntry, Settings, WorkoutHistory, WorkoutTemplate } from "./types";
import { defaultTemplates } from "./seed";

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
 }
}
export const db=new GymDB();

export async function ensureSeed(){
 if(await db.templates.count()===0) await db.templates.bulkPut(defaultTemplates);
 if(!(await db.settings.get("main"))) await db.settings.put({id:"main",defaultRestSec:120,autoRest:true,sound:true,vibration:true,theme:"dark"});
}
