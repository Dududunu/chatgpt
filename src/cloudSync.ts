import { db, ensureSeed } from "./db";
import { normalizeSettings } from "./settings";
import { supabase } from "./supabase";
import type { ActiveWorkout, BodyEntry, Settings, WorkoutHistory, WorkoutTemplate } from "./types";
import { restoreActiveWorkout } from "./workoutLogic";

export type CloudSyncStatus="syncing"|"synced"|"offline"|"error";

type CloudState={
 version:number;
 templates:WorkoutTemplate[];
 workouts:WorkoutHistory[];
 body:BodyEntry[];
 settings:Settings[];
 active:ActiveWorkout[];
};

const USER_MARKER="gym-pwa-cloud-user";

export async function snapshotLocalState():Promise<CloudState>{
 const [templates,workouts,body,settings,active]=await Promise.all([
  db.templates.toArray(),
  db.workouts.toArray(),
  db.body.toArray(),
  db.settings.toArray(),
  db.active.toArray()
 ]);
 return {version:1,templates,workouts,body,settings,active};
}

async function clearLocalState(){
 await db.transaction("rw",db.templates,db.workouts,db.body,db.settings,db.active,async()=>{
  await Promise.all([db.templates.clear(),db.workouts.clear(),db.body.clear(),db.settings.clear(),db.active.clear()]);
 });
}

async function replaceLocalState(state:Partial<CloudState>){
 await db.transaction("rw",db.templates,db.workouts,db.body,db.settings,db.active,async()=>{
  await Promise.all([db.templates.clear(),db.workouts.clear(),db.body.clear(),db.settings.clear(),db.active.clear()]);
  if(Array.isArray(state.templates)&&state.templates.length)await db.templates.bulkPut(state.templates);
  if(Array.isArray(state.workouts)&&state.workouts.length)await db.workouts.bulkPut(state.workouts);
  if(Array.isArray(state.body)&&state.body.length)await db.body.bulkPut(state.body);
  if(Array.isArray(state.settings)&&state.settings.length)await db.settings.bulkPut(state.settings.map(item=>normalizeSettings(item)));
  if(Array.isArray(state.active)&&state.active.length)await db.active.bulkPut(state.active.map(item=>restoreActiveWorkout(item)));
 });
 await ensureSeed();
}

export async function pushCloudState(userId:string){
 const state=await snapshotLocalState();
 const {error}=await supabase.from("user_app_state").upsert({user_id:userId,data:state},{onConflict:"user_id"});
 if(error)throw error;
 return state;
}

export async function prepareCloudUser(userId:string){
 const marker=localStorage.getItem(USER_MARKER);
 const {data,error}=await supabase.from("user_app_state").select("data").eq("user_id",userId).maybeSingle();
 if(error)throw error;

 if(data?.data){
  await replaceLocalState(data.data as Partial<CloudState>);
 }else{
  if(marker&&marker!==userId)await clearLocalState();
  await ensureSeed();
  await pushCloudState(userId);
 }

 localStorage.setItem(USER_MARKER,userId);
 return JSON.stringify(await snapshotLocalState());
}

export function startAutoSync(userId:string,initialHash:string,onStatus:(status:CloudSyncStatus)=>void){
 let stopped=false;
 let busy=false;
 let lastHash=initialHash;

 const run=async()=>{
  if(stopped||busy)return;
  if(!navigator.onLine){onStatus("offline");return}
  busy=true;
  try{
   const state=await snapshotLocalState();
   const hash=JSON.stringify(state);
   if(hash===lastHash){onStatus("synced");return}
   onStatus("syncing");
   const {error}=await supabase.from("user_app_state").upsert({user_id:userId,data:state},{onConflict:"user_id"});
   if(error)throw error;
   lastHash=hash;
   onStatus("synced");
  }catch{
   onStatus("error");
  }finally{
   busy=false;
  }
 };

 const timer=window.setInterval(()=>void run(),4000);
 const online=()=>void run();
 const visible=()=>{if(!document.hidden)void run()};
 window.addEventListener("online",online);
 document.addEventListener("visibilitychange",visible);

 return {
  syncNow:run,
  stop(){
   stopped=true;
   window.clearInterval(timer);
   window.removeEventListener("online",online);
   document.removeEventListener("visibilitychange",visible);
  }
 };
}
