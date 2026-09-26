import { useEffect } from "react";

export type ScreenWakeLock={released?:boolean;release:()=>Promise<void>|void;addEventListener?:(type:"release",listener:()=>void)=>void};
export type ScreenWakeLockApi={request:(type:"screen")=>Promise<ScreenWakeLock>};

function isDocumentVisible():boolean{return document.visibilityState==="visible"}

export function shouldRequestScreenWakeLock(active:boolean,enabled:boolean,visible=true,supported=true):boolean{
 return active&&enabled&&visible&&supported;
}

export async function tryAcquireScreenWakeLock(api:ScreenWakeLockApi|undefined):Promise<ScreenWakeLock|null>{
 if(!api)return null;
 try{return await api.request("screen")}catch{return null}
}

export function useScreenWakeLock(active:boolean,enabled:boolean){
 useEffect(()=>{
  const browserNavigator=navigator as Navigator&{wakeLock?:ScreenWakeLockApi};
  if(!shouldRequestScreenWakeLock(active,enabled,true,Boolean(browserNavigator.wakeLock)))return;
  let current:ScreenWakeLock|null=null,disposed=false,requesting=false;
  const release=()=>{const lock=current;current=null;if(lock&&!lock.released)void Promise.resolve(lock.release()).catch(()=>{})};
  const request=async()=>{
   if(disposed||requesting||!isDocumentVisible()||current&&!current.released)return;
   requesting=true;
   const lock=await tryAcquireScreenWakeLock(browserNavigator.wakeLock);
   requesting=false;
   if(disposed||!isDocumentVisible()){
    if(lock&&!lock.released)void Promise.resolve(lock.release()).catch(()=>{});
    return;
   }
   if(!lock)return;
   current=lock;
   lock.addEventListener?.("release",()=>{if(current===lock)current=null});
  };
  const onVisibility=()=>{if(document.visibilityState==="visible")void request();else release()};
  document.addEventListener("visibilitychange",onVisibility);
  void request();
  return()=>{disposed=true;document.removeEventListener("visibilitychange",onVisibility);release()};
 },[active,enabled]);
}
