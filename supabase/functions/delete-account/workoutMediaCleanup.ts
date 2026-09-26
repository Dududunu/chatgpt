export type StorageFolderEntry={name:string;id?:string|null};
export type AccountStorageAdmin={
 storage:{from:(bucket:string)=>{
  list:(path:string,options:{limit:number;offset:number})=>Promise<{data:StorageFolderEntry[]|null;error:unknown|null}>;
  remove:(paths:string[])=>Promise<{error:unknown|null}>;
 }};
};

const BUCKET="workout-media";
const PAGE_SIZE=1000;
const REMOVE_BATCH_SIZE=100;

export async function removeUserWorkoutMedia(admin:AccountStorageAdmin,userId:string):Promise<number>{
 const paths:string[]=[];
 const listFolder=async(path:string):Promise<StorageFolderEntry[]>=>{
  const entries:StorageFolderEntry[]=[];
  for(let offset=0;;offset+=PAGE_SIZE){
   const {data,error}=await admin.storage.from(BUCKET).list(path,{limit:PAGE_SIZE,offset});
   if(error)throw error;
   if(!data)throw new Error("Storage returned no object listing.");
   entries.push(...data);
   if(data.length<PAGE_SIZE)break;
  }
  return entries;
 };
 const visit=async(folder:string):Promise<void>=>{
  for(const entry of await listFolder(folder)){
   if(!entry.name||entry.name.includes("/"))throw new Error("Storage returned an invalid object name.");
   const path=`${folder}/${entry.name}`;
   if(entry.id===null||entry.id===undefined)await visit(path);
   else paths.push(path);
  }
 };
 if(!userId||userId.includes("/"))throw new Error("Invalid account folder.");
 await visit(userId);
 for(let offset=0;offset<paths.length;offset+=REMOVE_BATCH_SIZE){
  const {error}=await admin.storage.from(BUCKET).remove(paths.slice(offset,offset+REMOVE_BATCH_SIZE));
  if(error)throw error;
 }
 return paths.length;
}
