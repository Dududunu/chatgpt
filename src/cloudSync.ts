import { db, ensureSeed, withPreservedSyncTimestamps } from "./db";
import { normalizeSettings } from "./settings";
import { supabase } from "./supabase";
import type { ActiveWorkout, BodyEntry, Settings, SyncFields, SyncMeta, WorkoutHistory, WorkoutTemplate } from "./types";
import { restoreActiveWorkout } from "./workoutLogic";
import { mergeRecords, type VersionedRecord } from "./syncLogic";

export type CloudSyncStatus="syncing"|"synced"|"offline"|"error";
type CloudState={templates:WorkoutTemplate[];workouts:WorkoutHistory[];body:BodyEntry[];settings:Settings|null;active:ActiveWorkout|null;meta:SyncMeta|null};
type RawRow={id?:string;data?:unknown;updated_at?:string|null;deleted_at?:string|null;display_name?:string|null;created_at?:string|null;name?:string;template_id?:string|null;started_at?:string|null;ended_at?:string|null;date?:string|null;legacy_migrated_at?:string|null;active_deleted_at?:string|null};

const USER_MARKER="gym-pwa-cloud-user";
const SYNC_INTERVAL_MS=15_000;
let cloudUserGeneration=0;

function assertCurrentGeneration(generation:number){
 if(generation!==cloudUserGeneration)throw new Error("Konto zmieniło się podczas synchronizacji.");
}
function assertCurrentCloudUser(userId:string,generation:number){
 assertCurrentGeneration(generation);
 if(localStorage.getItem(USER_MARKER)!==userId)throw new Error("Konto zmieniło się podczas synchronizacji.");
}

function toMillis(value:unknown,fallback=Date.now()):number{
 if(typeof value==="number"&&Number.isFinite(value))return value;
 if(typeof value==="string"){const parsed=Date.parse(value);if(Number.isFinite(parsed))return parsed}
 return fallback;
}
function iso(value:number):string{return new Date(value).toISOString()}
function cleanPayload<T extends SyncFields>(value:T):Omit<T,"updatedAt"|"deletedAt">{
 const {updatedAt:_updatedAt,deletedAt:_deletedAt,...data}=value;
 return data;
}
function localVersion<T extends SyncFields&{id:string}>(value:T,fallback=Date.now()):VersionedRecord<T>{
 const updatedAt=toMillis(value.updatedAt,fallback);
 return {id:value.id,updatedAt,deletedAt:value.deletedAt,data:{...value,updatedAt}};
}
function remoteVersion<T extends SyncFields&{id:string}>(row:RawRow,fallback=Date.now()):VersionedRecord<T>{
 const updatedAt=toMillis(row.updated_at,fallback);
 const deletedAt=row.deleted_at?toMillis(row.deleted_at):undefined;
 const raw=row.data&&typeof row.data==="object"&&!Array.isArray(row.data)?row.data as Record<string,unknown>:null;
 const data=raw?({...raw,id:row.id,updatedAt,...(deletedAt===undefined?{}:{deletedAt})} as T):null;
 return {id:String(row.id??""),updatedAt,deletedAt,data};
}
function setVersion<T extends SyncFields>(record:VersionedRecord<T>):T|null{
 if(!record.data)return null;
 return {...record.data,updatedAt:record.updatedAt,...(record.deletedAt===undefined?{deletedAt:undefined}:{deletedAt:record.deletedAt})};
}
function assertResult<T>(result:{data:T|null;error:unknown}):T{
 if(result.error)throw result.error;
 return result.data as T;
}
function arrayOf<T>(value:unknown):T[]{return Array.isArray(value)?value as T[]:[]}
function objectOf(value:unknown):Record<string,unknown>{return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{}
}

async function clearLocalState(){
 await db.transaction("rw",[db.templates,db.workouts,db.body,db.settings,db.active,db.syncMeta],async()=>{
  await Promise.all([db.templates.clear(),db.workouts.clear(),db.body.clear(),db.settings.clear(),db.active.clear(),db.syncMeta.clear()]);
 });
}

export async function clearLocalAccountState(){
 cloudUserGeneration++;
 localStorage.removeItem(USER_MARKER);
 await clearLocalState();
}

async function snapshotLocalState():Promise<CloudState>{
 const [templates,workouts,body,settings,active,meta]=await Promise.all([
  db.templates.toArray(),db.workouts.toArray(),db.body.toArray(),db.settings.get("main"),db.active.toArray(),db.syncMeta.get("main")
 ]);
 return {templates,workouts,body,settings:settings?normalizeSettings(settings):null,active:active[0]??null,meta:meta??null};
}

async function fetchCloudState(userId:string){
 const [templateResult,workoutResult,bodyResult,settingsResult,activeResult,profileResult,stateResult]=await Promise.all([
  supabase.from("workout_templates").select("id,name,data,updated_at,deleted_at").eq("user_id",userId),
  supabase.from("workouts").select("id,template_id,started_at,ended_at,data,updated_at,deleted_at").eq("user_id",userId),
  supabase.from("body_entries").select("id,date,data,updated_at,deleted_at").eq("user_id",userId),
  supabase.from("user_settings").select("data,updated_at,deleted_at").eq("user_id",userId).maybeSingle(),
  supabase.from("active_workout").select("data,updated_at,deleted_at").eq("user_id",userId).maybeSingle(),
  supabase.from("profiles").select("display_name,created_at,updated_at").eq("user_id",userId).maybeSingle(),
  supabase.from("user_sync_state").select("legacy_migrated_at,active_deleted_at,updated_at").eq("user_id",userId).maybeSingle()
 ]);
 return {
  templates:assertResult(templateResult) as RawRow[],workouts:assertResult(workoutResult) as RawRow[],body:assertResult(bodyResult) as RawRow[],
  settings:assertResult(settingsResult) as RawRow|null,active:assertResult(activeResult) as RawRow|null,profile:assertResult(profileResult) as RawRow|null,state:assertResult(stateResult) as RawRow|null
 };
}

function cloudTemplateRecords(rows:RawRow[]){return rows.map(row=>remoteVersion<WorkoutTemplate>(row))}
function cloudWorkoutRecords(rows:RawRow[]){return rows.map(row=>remoteVersion<WorkoutHistory>(row))}
function cloudBodyRecords(rows:RawRow[]){return rows.map(row=>remoteVersion<BodyEntry>(row))}
function cloudSettingsRecord(row:RawRow|null):VersionedRecord<Settings>|null{return row?remoteVersion<Settings>({...row,id:"main"}):null}

async function upsertCloudTemplates(userId:string,records:VersionedRecord<WorkoutTemplate>[]){
 if(!records.length)return;
 const rows=records.filter(record=>record.data).map(record=>({user_id:userId,id:record.id,name:record.data!.name,data:cleanPayload(record.data!),updated_at:iso(record.updatedAt),deleted_at:record.deletedAt?iso(record.deletedAt):null}));
 if(rows.length){const {error}=await supabase.from("workout_templates").upsert(rows,{onConflict:"user_id,id"});if(error)throw error}
}
async function upsertCloudWorkouts(userId:string,records:VersionedRecord<WorkoutHistory>[]){
 if(!records.length)return;
 const rows=records.filter(record=>record.data).map(record=>({user_id:userId,id:record.id,template_id:record.data!.templateId||null,started_at:iso(record.data!.startedAt),ended_at:iso(record.data!.endedAt),data:cleanPayload(record.data!),updated_at:iso(record.updatedAt),deleted_at:record.deletedAt?iso(record.deletedAt):null}));
 if(rows.length){const {error}=await supabase.from("workouts").upsert(rows,{onConflict:"user_id,id"});if(error)throw error}
}
async function upsertCloudBody(userId:string,records:VersionedRecord<BodyEntry>[]){
 if(!records.length)return;
 const rows=records.filter(record=>record.data).map(record=>({user_id:userId,id:record.id,date:iso(record.data!.date),data:cleanPayload(record.data!),updated_at:iso(record.updatedAt),deleted_at:record.deletedAt?iso(record.deletedAt):null}));
 if(rows.length){const {error}=await supabase.from("body_entries").upsert(rows,{onConflict:"user_id,id"});if(error)throw error}
}
async function upsertCloudSettings(userId:string,record:VersionedRecord<Settings>|null){
 if(!record?.data)return;
 const {error}=await supabase.from("user_settings").upsert({user_id:userId,data:cleanPayload(record.data),updated_at:iso(record.updatedAt),deleted_at:record.deletedAt?iso(record.deletedAt):null},{onConflict:"user_id"});if(error)throw error;
}
async function upsertCloudActive(userId:string,record:VersionedRecord<ActiveWorkout>|null){
 if(!record)return;
 const {error}=await supabase.from("active_workout").upsert({user_id:userId,data:record.data?cleanPayload(record.data):null,updated_at:iso(record.updatedAt),deleted_at:record.deletedAt?iso(record.deletedAt):null},{onConflict:"user_id"});if(error)throw error;
}

function legacyRecords(data:unknown,storedUpdatedAt:number){
 const source=objectOf(data);
 const timestamp=(value:unknown)=>toMillis(value,storedUpdatedAt);
 const templates=arrayOf<WorkoutTemplate>(source.templates).map(item=>({...item,updatedAt:timestamp(item.updatedAt)}));
 const workouts=arrayOf<WorkoutHistory>(source.workouts).map(item=>({...item,updatedAt:timestamp(item.updatedAt)}));
 const body=arrayOf<BodyEntry>(source.body).map(item=>({...item,updatedAt:timestamp(item.updatedAt)}));
 const settings=arrayOf<Settings>(source.settings).map(item=>({...normalizeSettings(item),updatedAt:timestamp(item.updatedAt)}));
 const active=arrayOf<ActiveWorkout>(source.active).map(item=>({...restoreActiveWorkout(item),updatedAt:timestamp(item.updatedAt)}));
 return {templates,workouts,body,settings,active,profile:objectOf(source.profile)};
}

async function migrateLegacyState(userId:string,fallbackDisplayName:string){
 const current=await fetchCloudState(userId);
 if(current.state?.legacy_migrated_at)return;
 const legacyResult=await supabase.from("user_app_state").select("data,updated_at").eq("user_id",userId).maybeSingle();
 const old=assertResult(legacyResult) as {data:unknown;updated_at?:string|null}|null;
 if(old?.data){
  const migrated=legacyRecords(old.data,toMillis(old.updated_at));
  await Promise.all([
   upsertCloudTemplates(userId,migrated.templates.map(item=>localVersion(item))),
   upsertCloudWorkouts(userId,migrated.workouts.map(item=>localVersion(item))),
   upsertCloudBody(userId,migrated.body.map(item=>localVersion(item))),
   upsertCloudSettings(userId,migrated.settings[0]?localVersion(migrated.settings[0]):null),
   upsertCloudActive(userId,migrated.active[0]?localVersion(migrated.active[0]):null)
  ]);
  const oldDisplayName=String(migrated.profile.displayName??migrated.profile.display_name??fallbackDisplayName).trim();
  if(oldDisplayName){const {error}=await supabase.from("profiles").upsert({user_id:userId,display_name:oldDisplayName,updated_at:iso(toMillis(old.updated_at))},{onConflict:"user_id"});if(error)throw error}
 }
 const {error}=await supabase.from("user_sync_state").upsert({user_id:userId,legacy_migrated_at:iso(Date.now()),updated_at:iso(Date.now())},{onConflict:"user_id"});
 if(error)throw error;
}

async function ensureProfile(userId:string,fallbackDisplayName:string){
 const result=await supabase.from("profiles").select("display_name,created_at,updated_at").eq("user_id",userId).maybeSingle();
 const profile=assertResult(result) as RawRow|null;
 if(profile)return {displayName:String(profile.display_name??""),updatedAt:toMillis(profile.updated_at),createdAt:profile.created_at};
 const name=fallbackDisplayName.trim().slice(0,30);
 const now=Date.now();
 const {data,error}=await supabase.from("profiles").upsert({user_id:userId,display_name:name,created_at:iso(now),updated_at:iso(now)},{onConflict:"user_id"}).select("display_name,created_at,updated_at").single();
 if(error)throw error;
 return {displayName:String(data.display_name??""),updatedAt:toMillis(data.updated_at),createdAt:data.created_at};
}

async function updateCloudProfile(userId:string,displayName:string,updatedAt:number){
 const {error}=await supabase.from("profiles").upsert({user_id:userId,display_name:displayName,updated_at:iso(updatedAt)},{onConflict:"user_id"});
 if(error)throw error;
}

async function upsertSyncState(userId:string,meta:SyncMeta){
 const now=Date.now();
 const {error}=await supabase.from("user_sync_state").upsert({user_id:userId,legacy_migrated_at:meta.legacyMigratedAt?iso(meta.legacyMigratedAt):null,active_deleted_at:meta.activeDeletedAt?iso(meta.activeDeletedAt):null,updated_at:iso(now)},{onConflict:"user_id"});
 if(error)throw error;
}

function remoteActiveRecord(row:RawRow|null):VersionedRecord<ActiveWorkout>|null{
 if(!row)return null;
 const updatedAt=toMillis(row.updated_at),deletedAt=row.deleted_at?toMillis(row.deleted_at):undefined;
 const raw=row.data&&typeof row.data==="object"&&!Array.isArray(row.data)?row.data as ActiveWorkout:null;
 const data=raw&&deletedAt===undefined?restoreActiveWorkout({...raw,updatedAt}):null;
 return {id:"active",updatedAt,deletedAt,data};
}
function localActiveRecord(workout:ActiveWorkout|null,deletedAt:number|undefined):VersionedRecord<ActiveWorkout>|null{
 if(workout){
  const record=localVersion(workout);
  if(deletedAt!==undefined&&deletedAt>record.updatedAt)return {id:"active",updatedAt:deletedAt,deletedAt,data:null};
  return {...record,id:"active"};
 }
 return deletedAt===undefined?null:{id:"active",updatedAt:deletedAt,deletedAt,data:null};
}

async function applyLocalState(userId:string,generation:number,state:{templates:VersionedRecord<WorkoutTemplate>[];workouts:VersionedRecord<WorkoutHistory>[];body:VersionedRecord<BodyEntry>[];settings:VersionedRecord<Settings>|null;active:VersionedRecord<ActiveWorkout>|null;meta:SyncMeta}){
 await withPreservedSyncTimestamps(()=>db.transaction("rw",[db.templates,db.workouts,db.body,db.settings,db.active,db.syncMeta],async()=>{
  assertCurrentCloudUser(userId,generation);
  const templates=state.templates.map(setVersion).filter((row):row is WorkoutTemplate=>Boolean(row));
  const workouts=state.workouts.map(setVersion).filter((row):row is WorkoutHistory=>Boolean(row));
  const body=state.body.map(setVersion).filter((row):row is BodyEntry=>Boolean(row));
  if(templates.length)await db.templates.bulkPut(templates);
  if(workouts.length)await db.workouts.bulkPut(workouts);
  if(body.length)await db.body.bulkPut(body);
  if(state.settings?.data){const value=setVersion(state.settings);if(value)await db.settings.put(normalizeSettings(value))}
  if(state.active?.data){const value=setVersion(state.active);if(value)await db.active.put(restoreActiveWorkout(value))}
  else await db.active.clear();
  await db.syncMeta.put(state.meta);
 }));
}

async function localVersions(){
 const state=await snapshotLocalState();
 const meta=state.meta??{id:"main" as const};
 const templates=state.templates.map(item=>localVersion(item,item.createdAt??Date.now()));
 const workouts=state.workouts.map(item=>localVersion(item,item.endedAt));
 const body=state.body.map(item=>localVersion(item,item.date));
 const settings=state.settings?localVersion(state.settings):null;
 const active=localActiveRecord(state.active,meta.activeDeletedAt);
 return {state,meta,templates,workouts,body,settings,active};
}

async function mergeRound(userId:string,remote:Awaited<ReturnType<typeof fetchCloudState>>,fallbackDisplayName:string,generation:number,allowPush=true){
 assertCurrentCloudUser(userId,generation);
 const local=await localVersions();
 assertCurrentCloudUser(userId,generation);
 const templateMerge=mergeRecords(local.templates,cloudTemplateRecords(remote.templates));
 const workoutMerge=mergeRecords(local.workouts,cloudWorkoutRecords(remote.workouts));
 const bodyMerge=mergeRecords(local.body,cloudBodyRecords(remote.body));
 const settingsMerge=mergeRecords(local.settings?[local.settings]:[],cloudSettingsRecord(remote.settings)?[cloudSettingsRecord(remote.settings)!]:[]);
 const activeMerge=mergeRecords(local.active?[local.active]:[],remoteActiveRecord(remote.active)?[remoteActiveRecord(remote.active)!]:[]);

 const cloudProfile=remote.profile?{displayName:String(remote.profile.display_name??""),updatedAt:toMillis(remote.profile.updated_at),createdAt:remote.profile.created_at}:null;
 const localProfile=local.meta.displayName?{displayName:local.meta.displayName,updatedAt:local.meta.profileUpdatedAt??0}:null;
 const profile:{displayName:string;updatedAt:number;createdAt?:string|null}=localProfile&&(!cloudProfile||localProfile.updatedAt>cloudProfile.updatedAt)
  ?localProfile
  :cloudProfile??await ensureProfile(userId,fallbackDisplayName);
 const profileNeedsUpload=Boolean(localProfile&&(!cloudProfile||localProfile.updatedAt>cloudProfile.updatedAt));

 if(allowPush){
  assertCurrentCloudUser(userId,generation);
  await Promise.all([
   upsertCloudTemplates(userId,templateMerge.upload),upsertCloudWorkouts(userId,workoutMerge.upload),upsertCloudBody(userId,bodyMerge.upload),
   upsertCloudSettings(userId,settingsMerge.upload[0]??null),upsertCloudActive(userId,activeMerge.upload[0]??null),
   profileNeedsUpload?updateCloudProfile(userId,profile.displayName,profile.updatedAt):Promise.resolve()
  ]);
 }
 const syncRowUpdated=remote.state?.updated_at?toMillis(remote.state.updated_at):0;
 const legacyMigratedAt=remote.state?.legacy_migrated_at?toMillis(remote.state.legacy_migrated_at):local.meta.legacyMigratedAt??Date.now();
 const activeWinner=activeMerge.records[0]??null;
 const mergedMeta:SyncMeta={id:"main",userId,activeDeletedAt:activeWinner?.deletedAt,displayName:profile.displayName,profileUpdatedAt:profile.updatedAt,legacyMigratedAt};
 const allChanged=templateMerge.upload.length+workoutMerge.upload.length+bodyMerge.upload.length+settingsMerge.upload.length+activeMerge.upload.length+templateMerge.pull.length+workoutMerge.pull.length+bodyMerge.pull.length+settingsMerge.pull.length+activeMerge.pull.length>0;
 assertCurrentCloudUser(userId,generation);
 await applyLocalState(userId,generation,{templates:templateMerge.records,workouts:workoutMerge.records,body:bodyMerge.records,settings:settingsMerge.records[0]??null,active:activeWinner,meta:mergedMeta});
 if(allowPush&&allChanged||allowPush&&profileNeedsUpload||!remote.state?.legacy_migrated_at){
  const meta={...mergedMeta,legacyMigratedAt};
  if(!remote.state?.legacy_migrated_at||syncRowUpdated===0)await upsertSyncState(userId,meta);
 }
 return mergedMeta;
}

async function syncCloudUser(userId:string,fallbackDisplayName="",generation=cloudUserGeneration){
 assertCurrentCloudUser(userId,generation);
 await migrateLegacyState(userId,fallbackDisplayName);
 assertCurrentCloudUser(userId,generation);
 let remote=await fetchCloudState(userId);
 assertCurrentCloudUser(userId,generation);
 let meta=await mergeRound(userId,remote,fallbackDisplayName,generation,true);
 // A second read catches a newer write that landed on another device while the first batch was uploading.
 remote=await fetchCloudState(userId);
 assertCurrentCloudUser(userId,generation);
 meta=await mergeRound(userId,remote,fallbackDisplayName,generation,true);
 assertCurrentCloudUser(userId,generation);
 await ensureSeed();
 localStorage.setItem(USER_MARKER,userId);
 return {hash:JSON.stringify(await snapshotLocalState()),displayName:meta.displayName};
}

export async function prepareCloudUser(userId:string,fallbackDisplayName=""){
 const generation=++cloudUserGeneration;
 const marker=localStorage.getItem(USER_MARKER);
 const switched=Boolean(marker&&marker!==userId);
 if(switched)await clearLocalState();
 assertCurrentGeneration(generation);
 localStorage.setItem(USER_MARKER,userId);
 await migrateLegacyState(userId,fallbackDisplayName);
 assertCurrentCloudUser(userId,generation);
 let remote=await fetchCloudState(userId);
 assertCurrentCloudUser(userId,generation);
 const remoteHasRecords=remote.templates.length+remote.workouts.length+remote.body.length>0||Boolean(remote.settings)||Boolean(remote.active);
 if(switched||(!marker&&remoteHasRecords)){
  const templateRecords=cloudTemplateRecords(remote.templates),workoutRecords=cloudWorkoutRecords(remote.workouts),bodyRecords=cloudBodyRecords(remote.body);
  const settingsRecord=cloudSettingsRecord(remote.settings),activeRecord=remoteActiveRecord(remote.active);
  const cloudProfile=remote.profile?{displayName:String(remote.profile.display_name??""),updatedAt:toMillis(remote.profile.updated_at)}:null;
  const profile=cloudProfile??await ensureProfile(userId,fallbackDisplayName);
  const activeDeletedAt=activeRecord?.deletedAt??(remote.state?.active_deleted_at?toMillis(remote.state.active_deleted_at):undefined);
  await withPreservedSyncTimestamps(()=>db.transaction("rw",[db.templates,db.workouts,db.body,db.settings,db.active,db.syncMeta],async()=>{
   assertCurrentCloudUser(userId,generation);
   await Promise.all([db.templates.clear(),db.workouts.clear(),db.body.clear(),db.settings.clear(),db.active.clear()]);
   const templates=templateRecords.map(setVersion).filter((row):row is WorkoutTemplate=>Boolean(row));
   const workouts=workoutRecords.map(setVersion).filter((row):row is WorkoutHistory=>Boolean(row));
   const body=bodyRecords.map(setVersion).filter((row):row is BodyEntry=>Boolean(row));
   if(templates.length)await db.templates.bulkPut(templates);if(workouts.length)await db.workouts.bulkPut(workouts);if(body.length)await db.body.bulkPut(body);
   if(settingsRecord?.data){const settings=setVersion(settingsRecord);if(settings)await db.settings.put(normalizeSettings(settings))}
   if(activeRecord?.data)await db.active.put(restoreActiveWorkout(setVersion(activeRecord)!));
   await db.syncMeta.put({id:"main",userId,activeDeletedAt,displayName:profile.displayName,profileUpdatedAt:profile.updatedAt,legacyMigratedAt:remote.state?.legacy_migrated_at?toMillis(remote.state.legacy_migrated_at):Date.now()});
  }));
 }
 assertCurrentCloudUser(userId,generation);
 await ensureSeed();
 const synchronized=await syncCloudUser(userId,fallbackDisplayName,generation);
 return synchronized;
}

export async function pushCloudState(userId:string){return syncCloudUser(userId)}

export async function updateDisplayName(userId:string,displayName:string){
 const name=displayName.trim();
 if(name.length<2||name.length>30)throw new Error("Wpisz imię o długości 2–30 znaków.");
 const meta=await db.syncMeta.get("main")??{id:"main" as const};
 let remoteUpdatedAt=0;
 if(navigator.onLine){
  const result=await supabase.from("profiles").select("updated_at").eq("user_id",userId).maybeSingle();
  if(result.error)throw new Error("Nie udało się zapisać imienia. Spróbuj ponownie.");
  remoteUpdatedAt=toMillis(result.data?.updated_at,0);
 }
 const updatedAt=Math.max(Date.now(),(meta.profileUpdatedAt??0)+1,remoteUpdatedAt+1);
 const generation=cloudUserGeneration;
 assertCurrentCloudUser(userId,generation);
 await db.syncMeta.put({...meta,userId,displayName:name,profileUpdatedAt:updatedAt});
 if(navigator.onLine){
  try{await updateCloudProfile(userId,name,updatedAt)}
  catch{await db.syncMeta.put(meta);throw new Error("Nie udało się zapisać imienia. Spróbuj ponownie.")}
 }
 return name;
}

export async function markActiveWorkoutDeleted(deletedAt=Date.now()){
 const current=await db.syncMeta.get("main")??{id:"main" as const};
 await db.syncMeta.put({...current,activeDeletedAt:deletedAt});
}

export function startAutoSync(userId:string,_initialHash:string,onStatus:(status:CloudSyncStatus)=>void,fallbackDisplayName="",onProfileChange?:(displayName:string)=>void){
 const generation=cloudUserGeneration;
 let stopped=false,busy=false;
 const run=async()=>{
  if(stopped||busy||generation!==cloudUserGeneration)return;
  if(!navigator.onLine){onStatus("offline");return}
  busy=true;onStatus("syncing");
  try{const synchronized=await syncCloudUser(userId,fallbackDisplayName,generation);onProfileChange?.(synchronized.displayName??"");onStatus("synced")}
  catch{if(!stopped&&generation===cloudUserGeneration)onStatus("error")}
  finally{busy=false}
 };
 const timer=window.setInterval(()=>void run(),SYNC_INTERVAL_MS);
 const online=()=>void run();
 const visible=()=>{if(!document.hidden)void run()};
 window.addEventListener("online",online);document.addEventListener("visibilitychange",visible);
  return {syncNow:run,stop(){stopped=true;if(generation===cloudUserGeneration)cloudUserGeneration++;window.clearInterval(timer);window.removeEventListener("online",online);document.removeEventListener("visibilitychange",visible)}};
}
