import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import App from "./App";
import { prepareCloudUser, pushCloudState, startAutoSync, type CloudSyncStatus, updateDisplayName, clearLocalAccountState } from "./cloudSync";
import { supabase } from "./supabase";
import { authErrorMessage, signOutWithSync } from "./authMessages";
import { validateDisplayName } from "./accountLogic";
import { BrandLockup } from "./AppIcons";
import { changePassword as changePasswordAction,deleteAccountFlow,loginWithPassword,requestPasswordReset,signupWithDisplayName,updatePassword } from "./authActions";

export default function AuthShell(){
 const [session,setSession]=useState<Session|null|undefined>(undefined);
 const [ready,setReady]=useState(false);
 const [syncStatus,setSyncStatus]=useState<CloudSyncStatus>("syncing");
 const [displayName,setDisplayName]=useState("");
 const [passwordRecovery,setPasswordRecovery]=useState(false);
 const syncRef=useRef<ReturnType<typeof startAutoSync>|null>(null);

 useEffect(()=>{
  let alive=true;
  void supabase.auth.getSession().then(({data})=>{if(alive)setSession(data.session)});
  const {data:listener}=supabase.auth.onAuthStateChange((event,next)=>{
   if(event==="PASSWORD_RECOVERY")setPasswordRecovery(true);
   if(event==="SIGNED_OUT")setPasswordRecovery(false);
   setSession(next);
  });
  return()=>{alive=false;listener.subscription.unsubscribe()};
 },[]);

 useEffect(()=>{
  syncRef.current?.stop();syncRef.current=null;
  if(!session?.user){setReady(false);return}
  let cancelled=false;
  const user=session.user;
  const fallback=typeof user.user_metadata?.display_name==="string"?user.user_metadata.display_name:"";
  setReady(false);setSyncStatus(navigator.onLine?"syncing":"offline");
  void prepareCloudUser(user.id,fallback).then(result=>{
   if(cancelled)return;
   setDisplayName(result.displayName??"");setReady(true);setSyncStatus(navigator.onLine?"synced":"offline");
   syncRef.current=startAutoSync(user.id,result.hash,setSyncStatus,fallback,setDisplayName);
  }).catch(()=>{
   if(cancelled)return;
   setSyncStatus(navigator.onLine?"error":"offline");
   setReady(true);
   syncRef.current=startAutoSync(user.id,"",setSyncStatus,fallback,setDisplayName);
  });
  return()=>{cancelled=true;syncRef.current?.stop();syncRef.current=null};
 },[session?.user.id]);

 async function syncNow(){
  if(!session?.user)return;
  if(!navigator.onLine){setSyncStatus("offline");return}
  setSyncStatus("syncing");
  try{const result=await pushCloudState(session.user.id);setDisplayName(result.displayName??"");setSyncStatus("synced")}catch{setSyncStatus("error")}
 }

 async function signOut(){
  await signOutWithSync(navigator.onLine,
   ()=>session?.user?pushCloudState(session.user.id):Promise.resolve(),
   async()=>{const {error}=await supabase.auth.signOut();if(error)throw error}
  );
 }

 async function saveDisplayName(value:string){
  if(!session?.user)throw new Error("Nie znaleziono aktywnego konta.");
  const validation=validateDisplayName(value);if(validation)throw new Error(validation);
  const saved=await updateDisplayName(session.user.id,value);
  setDisplayName(saved);
 }

 async function changeAccountPassword(currentPassword:string,newPassword:string){
  if(!session?.user?.email)throw new Error("Nie udało się potwierdzić adresu email.");
  try{await changePasswordAction(session.user.email,currentPassword,newPassword,input=>supabase.auth.signInWithPassword(input),input=>supabase.auth.updateUser(input))}
  catch(error){throw new Error(authErrorMessage(error))}
 }

 async function deleteAccount(confirmation:string){
  await deleteAccountFlow(confirmation,async typedConfirmation=>{
   const {error}=await supabase.functions.invoke("delete-account",{body:{confirmation:typedConfirmation}});
   if(error)throw new Error("Nie udało się usunąć konta. Spróbuj ponownie.");
  },clearLocalAccountState,async()=>{
   const {error}=await supabase.auth.signOut({scope:"local"});
   if(error)throw new Error("Konto usunięto, ale nie udało się wyczyścić sesji. Odśwież aplikację.");
  });
 }

 if(passwordRecovery)return <AuthScreen initialMode="recovery" onRecoveryComplete={()=>setPasswordRecovery(false)}/>;
 if(session===undefined)return <div className="auth-shell auth-loading"><BrandLockup/><span className="loading-mark" aria-hidden="true"/><p>Przygotowuję trening</p></div>;
 if(!session)return <AuthScreen/>;
 if(!ready)return <div className="auth-shell auth-loading"><BrandLockup/><h1>Wczytywanie profilu</h1><p>Łączę Twoje dane treningowe z chmurą.</p><div className="skeleton-stack" aria-hidden="true"><i/><i/><i/></div></div>;

 return <App userId={session.user.id} accountEmail={session.user.email??"Konto"} displayName={displayName} syncStatus={syncStatus} onSyncNow={syncNow} onSignOut={signOut} onUpdateDisplayName={saveDisplayName} onChangePassword={changeAccountPassword} onDeleteAccount={deleteAccount}/>;
}

type AuthMode="login"|"signup"|"reset"|"recovery";
export function AuthScreen({initialMode="login",onRecoveryComplete}:{initialMode?:AuthMode;onRecoveryComplete?:()=>void}){
 const [mode,setMode]=useState<AuthMode>(initialMode);
 const [name,setName]=useState("");
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");

 async function submit(event:React.FormEvent){
  event.preventDefault();setBusy(true);setMessage("");
  try{
   if(mode==="login"){
    await loginWithPassword(email,password,input=>supabase.auth.signInWithPassword(input));
   }else if(mode==="signup"){
    const redirectTo=`${window.location.origin}${window.location.pathname}`;
    const hasSession=await signupWithDisplayName(name,email,password,redirectTo,input=>supabase.auth.signUp(input));
    if(!hasSession)setMessage("Konto utworzone. Sprawdź e-mail i potwierdź rejestrację.");
   }else if(mode==="reset"){
    const redirectTo=`${window.location.origin}${window.location.pathname}`;
    await requestPasswordReset(email,redirectTo,(address,options)=>supabase.auth.resetPasswordForEmail(address,options));
    setMessage("Jeśli konto z tym adresem istnieje, wyślemy wiadomość z instrukcją zmiany hasła.");
   }else{
    await updatePassword(password,input=>supabase.auth.updateUser(input));
    setMessage("Hasło zmienione. Możesz wrócić do treningu.");onRecoveryComplete?.();
   }
  }catch(error){setMessage(authErrorMessage(error))}
  finally{setBusy(false)}
 }
 const title=mode==="login"?"Zaloguj się":mode==="signup"?"Utwórz konto":mode==="reset"?"Reset hasła":"Ustaw nowe hasło";
 const description=mode==="login"?"Twój trening. Twój progres.":mode==="signup"?"Zapisz plan, historię i progres na swoim koncie.":mode==="reset"?"Wyślemy link do zmiany hasła na podany adres email.":"Wpisz nowe hasło do swojego konta.";
 return <div className="auth-shell"><form className="auth-card" onSubmit={submit}>
  <BrandLockup/>
  <h1>{title}</h1>
  <p>{description}</p>
  {mode==="signup"&&<label className="field-label">IMIĘ<input autoComplete="given-name" required minLength={2} maxLength={30} value={name} onChange={event=>setName(event.target.value)}/></label>}
  {mode!=="recovery"&&<label className="field-label">EMAIL<input type="email" autoComplete="email" required value={email} onChange={event=>setEmail(event.target.value)}/></label>}
  {(mode==="login"||mode==="signup"||mode==="recovery")&&<label className="field-label">{mode==="recovery"?"NOWE HASŁO":"HASŁO"}<input type="password" autoComplete={mode==="login"?"current-password":"new-password"} minLength={8} required value={password} onChange={event=>setPassword(event.target.value)}/></label>}
  {message&&<p className="auth-message" role="status">{message}</p>}
  <button className="primary" disabled={busy}>{busy?"Proszę czekać…":mode==="login"?"Zaloguj się":mode==="signup"?"Utwórz konto":mode==="reset"?"Wyślij link":"Zapisz nowe hasło"}</button>
  {mode==="login"&&<button type="button" className="auth-switch" onClick={()=>{setMode("reset");setMessage("")}}>Nie pamiętasz hasła?</button>}
  {(mode==="login"||mode==="signup")&&<button type="button" className="auth-switch" onClick={()=>{setMode(current=>current==="login"?"signup":"login");setMessage("")}}>{mode==="login"?"Nie masz konta? Utwórz je":"Masz już konto? Zaloguj się"}</button>}
  {(mode==="reset"||mode==="recovery")&&<button type="button" className="auth-switch" onClick={()=>{setMode("login");setPassword("");setMessage("")}}>Wróć do logowania</button>}
 </form></div>;
}
