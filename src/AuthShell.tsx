import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import App from "./App";
import { prepareCloudUser, pushCloudState, startAutoSync, type CloudSyncStatus } from "./cloudSync";
import { supabase } from "./supabase";
import { authErrorMessage, signOutWithSync } from "./authMessages";

export default function AuthShell(){
 const [session,setSession]=useState<Session|null|undefined>(undefined);
 const [ready,setReady]=useState(false);
 const [syncStatus,setSyncStatus]=useState<CloudSyncStatus>("syncing");
 const syncRef=useRef<ReturnType<typeof startAutoSync>|null>(null);

 useEffect(()=>{
  let alive=true;
  void supabase.auth.getSession().then(({data})=>{if(alive)setSession(data.session)});
  const {data:listener}=supabase.auth.onAuthStateChange((_event,next)=>setSession(next));
  return()=>{alive=false;listener.subscription.unsubscribe()};
 },[]);

 useEffect(()=>{
  syncRef.current?.stop();syncRef.current=null;
  if(!session?.user){setReady(false);return}
  let cancelled=false;
  setReady(false);setSyncStatus(navigator.onLine?"syncing":"offline");
  void prepareCloudUser(session.user.id).then(hash=>{
   if(cancelled)return;
   setReady(true);setSyncStatus(navigator.onLine?"synced":"offline");
   syncRef.current=startAutoSync(session.user.id,hash,setSyncStatus);
  }).catch(()=>{if(!cancelled){setSyncStatus("error");setReady(true)}});
  return()=>{cancelled=true;syncRef.current?.stop();syncRef.current=null};
 },[session?.user.id]);

 async function syncNow(){
  if(!session?.user)return;
  if(!navigator.onLine){setSyncStatus("offline");return}
  setSyncStatus("syncing");
  try{await pushCloudState(session.user.id);setSyncStatus("synced")}catch{setSyncStatus("error")}
 }

 async function signOut(){
  await signOutWithSync(navigator.onLine,
   ()=>session?.user?pushCloudState(session.user.id):Promise.resolve(),
   async()=>{const {error}=await supabase.auth.signOut();if(error)throw error}
  );
 }

 if(session===undefined)return <div className="auth-shell"><p>Ładowanie…</p></div>;
 if(!session)return <AuthScreen/>;
 if(!ready)return <div className="auth-shell"><div className="auth-card"><span className="eyebrow">GYM PWA</span><h1>Wczytywanie profilu</h1><p>Łączę Twoje dane treningowe z chmurą.</p></div></div>;

 return <App accountEmail={session.user.email??"Konto"} syncStatus={syncStatus} onSyncNow={syncNow} onSignOut={signOut}/>;
}

export function AuthScreen({initialMode="login"}:{initialMode?:"login"|"signup"}){
 const [mode,setMode]=useState<"login"|"signup">(initialMode);
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");

 async function submit(event:React.FormEvent){
  event.preventDefault();setBusy(true);setMessage("");
  try{
   if(mode==="login"){
    const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
    if(error)throw error;
   }else{
    const redirectTo=`${window.location.origin}${window.location.pathname}`;
    const {data,error}=await supabase.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:redirectTo}});
    if(error)throw error;
    if(!data.session)setMessage("Konto utworzone. Sprawdź e-mail i potwierdź rejestrację.");
   }
  }catch(error){
   setMessage(authErrorMessage(error));
  }finally{setBusy(false)}
 }

 return <div className="auth-shell"><form className="auth-card" onSubmit={submit}>
  <span className="eyebrow">GYM</span>
  <h1>{mode==="login"?"Zaloguj się":"Utwórz konto"}</h1>
  <p>{mode==="login"?"Twój trening. Twój progres.":"Zapisz plan, historię i progres na swoim koncie."}</p>
  <label className="field-label">EMAIL<input type="email" autoComplete="email" required value={email} onChange={event=>setEmail(event.target.value)}/></label>
  <label className="field-label">HASŁO<input type="password" autoComplete={mode==="login"?"current-password":"new-password"} minLength={6} required value={password} onChange={event=>setPassword(event.target.value)}/></label>
  {message&&<p className="auth-message" role="status">{message}</p>}
  <button className="primary" disabled={busy}>{busy?"Proszę czekać…":mode==="login"?"Zaloguj":"Utwórz konto"}</button>
  <button type="button" className="auth-switch" onClick={()=>{setMode(current=>current==="login"?"signup":"login");setMessage("")}}>
   {mode==="login"?"Nie masz konta? Utwórz je":"Masz już konto? Zaloguj się"}
  </button>
 </form></div>;
}
