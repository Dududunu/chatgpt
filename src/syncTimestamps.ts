export function recordTimestampForWrite(
 existing:number|undefined,
 incoming:number|undefined,
 now:number,
 preserveIncoming:boolean,
 creating=false
):number|undefined{
 if(preserveIncoming)return incoming;
 return Math.max(now,creating?0:(existing??0)+1,incoming??0);
}
