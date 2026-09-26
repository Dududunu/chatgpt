export type VersionedRecord<T>={id:string;updatedAt:number;deletedAt?:number;data:T|null};
export type MergeResult<T>={records:VersionedRecord<T>[];upload:VersionedRecord<T>[];pull:VersionedRecord<T>[]};

function revision<T>(record:VersionedRecord<T>):number{
 return Math.max(record.updatedAt,record.deletedAt??0);
}

/** Merge independent records by revision; cloud wins exact timestamp ties. */
export function mergeRecords<T>(local:VersionedRecord<T>[],cloud:VersionedRecord<T>[]):MergeResult<T>{
 const localById=new Map(local.map(record=>[record.id,record]));
 const cloudById=new Map(cloud.map(record=>[record.id,record]));
 const ids=new Set([...localById.keys(),...cloudById.keys()]);
 const records:VersionedRecord<T>[]=[],upload:VersionedRecord<T>[]=[],pull:VersionedRecord<T>[]=[];
 for(const id of ids){
  const localRecord=localById.get(id),cloudRecord=cloudById.get(id);
  if(!cloudRecord){records.push(localRecord!);upload.push(localRecord!);continue}
  if(!localRecord){records.push(cloudRecord);pull.push(cloudRecord);continue}
  if(revision(localRecord)>revision(cloudRecord)){records.push(localRecord);upload.push(localRecord)}
  else{records.push(cloudRecord);if(revision(cloudRecord)>revision(localRecord))pull.push(cloudRecord)}
 }
 return {records,upload,pull};
}

export function shouldSyncWhileOnline(isOnline:boolean):boolean{return isOnline;}
