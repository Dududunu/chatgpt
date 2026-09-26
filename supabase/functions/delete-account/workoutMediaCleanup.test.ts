import { describe,expect,it } from "vitest";
import type { AccountStorageAdmin,StorageFolderEntry } from "./workoutMediaCleanup";
import { removeUserWorkoutMedia } from "./workoutMediaCleanup";

function storageAdmin(folders:Record<string,StorageFolderEntry[]>):AccountStorageAdmin&{removed:string[][];listed:string[];offsets:number[]}{
 const admin={removed:[] as string[][],listed:[] as string[],offsets:[] as number[],storage:{from(bucket:string){
  expect(bucket).toBe("workout-media");
  return {
   async list(path:string,options:{limit:number;offset:number}){admin.listed.push(path);admin.offsets.push(options.offset);return {data:(folders[path]??[]).slice(options.offset,options.offset+options.limit),error:null}},
   async remove(paths:string[]){admin.removed.push(paths);return {error:null}},
  };
 }}};
 return admin;
}

describe("account workout media cleanup",()=>{
 it("recursively removes only files below the requested user's private folder",async()=>{
  const admin=storageAdmin({
   "user-a":[{name:"workout-1",id:null}],
   "user-a/workout-1":[{name:"photo-1.webp",id:"object-1"},{name:"photo-2.jpg",id:"object-2"}],
  });
  expect(await removeUserWorkoutMedia(admin,"user-a")).toBe(2);
  expect(admin.listed).toEqual(["user-a","user-a/workout-1"]);
  expect(admin.removed).toEqual([["user-a/workout-1/photo-1.webp","user-a/workout-1/photo-2.jpg"]]);
 });

 it("paginates large folders and removes objects in bounded batches",async()=>{
  const files=Array.from({length:1500},(_,index)=>({name:`photo-${index}.webp`,id:`object-${index}`}));
  const admin=storageAdmin({"user-a":files});
  expect(await removeUserWorkoutMedia(admin,"user-a")).toBe(1500);
  expect(admin.listed).toEqual(["user-a","user-a"]);
  expect(admin.offsets).toEqual([0,1000]);
  expect(admin.removed.map(batch=>batch.length)).toEqual([100,100,100,100,100,100,100,100,100,100,100,100,100,100,100]);
 });

 it("fails safely if Storage cannot list or remove files",async()=>{
  const failingList:AccountStorageAdmin={storage:{from:()=>({list:async()=>({data:null,error:new Error("Storage unavailable")}),remove:async()=>({error:null})})}};
  await expect(removeUserWorkoutMedia(failingList,"user-a")).rejects.toThrow("Storage unavailable");
  const failingRemove:AccountStorageAdmin={storage:{from:()=>({list:async()=>({data:[{name:"photo.webp",id:"object"}],error:null}),remove:async()=>({error:new Error("Storage unavailable")})})}};
  await expect(removeUserWorkoutMedia(failingRemove,"user-a")).rejects.toThrow("Storage unavailable");
 });
});
