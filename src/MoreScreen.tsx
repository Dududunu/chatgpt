import { useState } from "react";
import type { BodyEntry, Settings } from "./types";
import { DEFAULT_PLATES } from "./barbellTools";
import { syncStatusMessage } from "./authMessages";
import { validateDeleteConfirmation, validateDisplayName, validatePasswordChange } from "./accountLogic";

type Props={settings:Settings|null;body:BodyEntry[];accountEmail:string;displayName:string;syncStatus:"syncing"|"synced"|"offline"|"error";onSyncNow:()=>Promise<void>;onSignOut:()=>Promise<void>;onUpdateDisplayName:(name:string)=>Promise<void>;onChangePassword:(current:string,next:string)=>Promise<void>;onDeleteAccount:(confirmation:string)=>Promise<void>;onSaveSettings:(patch:Partial<Settings>)=>Promise<void>;onAddBody:(entry:BodyEntry)=>Promise<void>;exportJson:()=>Promise<void>;importJson:(file:File)=>Promise<void>;exportCsv:()=>Promise<void>;notify:(message:string)=>void};
const id=()=>crypto.randomUUID();
const date=(time:number)=>new Intl.DateTimeFormat("pl-PL",{day:"numeric",month:"short",year:"numeric"}).format(time);
const parse=(raw:string)=>{if(!raw.trim())return null;const value=Number(raw.trim().replace(",","."));return Number.isFinite(value)&&value>=0?value:null};

export function MoreScreen({settings,body,accountEmail,displayName,syncStatus,onSyncNow,onSignOut,onUpdateDisplayName,onChangePassword,onDeleteAccount,onSaveSettings,onAddBody,exportJson,importJson,exportCsv,notify}:Props){
 const [weight,setWeight]=useState("");
 const [waist,setWaist]=useState("");
 const [chest,setChest]=useState("");
 const [arm,setArm]=useState("");
 const [note,setNote]=useState("");
 const [saving,setSaving]=useState(false);
 const [editingName,setEditingName]=useState(false);
 const [nameDraft,setNameDraft]=useState(displayName);
 const [nameBusy,setNameBusy]=useState(false);
 const [passwordOpen,setPasswordOpen]=useState(false);
 const [currentPassword,setCurrentPassword]=useState("");
 const [newPassword,setNewPassword]=useState("");
 const [repeatPassword,setRepeatPassword]=useState("");
 const [passwordBusy,setPasswordBusy]=useState(false);
 const [deleteOpen,setDeleteOpen]=useState(false);
 const [deleteText,setDeleteText]=useState("");
 const [deleteBusy,setDeleteBusy]=useState(false);
 if(!settings)return <section className="section screen-loading" aria-label="Wczytywanie ustawień"><div className="screen-skeleton" aria-hidden="true"><i/><i/><i/></div></section>;
 async function update(patch:Partial<Settings>){await onSaveSettings(patch)}
 async function saveName(event:React.FormEvent){
  event.preventDefault();const validation=validateDisplayName(nameDraft);if(validation){notify(validation);return}
  setNameBusy(true);try{await onUpdateDisplayName(nameDraft);setEditingName(false);notify("Imię zaktualizowane")}catch(error){notify(error instanceof Error?error.message:"Nie udało się zapisać imienia.")}finally{setNameBusy(false)}
 }
 async function savePassword(event:React.FormEvent){
  event.preventDefault();const validation=validatePasswordChange(currentPassword,newPassword,repeatPassword);if(validation){notify(validation);return}
  setPasswordBusy(true);try{await onChangePassword(currentPassword,newPassword);setCurrentPassword("");setNewPassword("");setRepeatPassword("");setPasswordOpen(false);notify("Hasło zmienione")}catch(error){notify(error instanceof Error?error.message:"Nie udało się zmienić hasła.")}finally{setPasswordBusy(false)}
 }
 async function removeAccount(){
  if(!validateDeleteConfirmation(deleteText)){notify("Wpisz USUŃ, aby potwierdzić");return}
  if(!window.confirm("To trwale usunie konto i dane w chmurze. Czy na pewno kontynuować?"))return;
  setDeleteBusy(true);try{await onDeleteAccount(deleteText)}catch(error){notify(error instanceof Error?error.message:"Nie udało się usunąć konta.");setDeleteBusy(false)}
 }
 async function saveBody(event:React.FormEvent){
  event.preventDefault();const parsed={weight:parse(weight),waist:parse(waist),chest:parse(chest),arm:parse(arm)};
  if(Object.values(parsed).every(value=>value===null)&&!note.trim()){notify("Wpisz przynajmniej jeden pomiar");return}
  setSaving(true);
  try{await onAddBody({id:id(),date:Date.now(),weight:parsed.weight??undefined,waist:parsed.waist??undefined,chest:parsed.chest??undefined,arm:parsed.arm??undefined,note:note.trim()||undefined});setWeight("");setWaist("");setChest("");setArm("");setNote("");notify("Pomiar zapisany")}
  finally{setSaving(false)}
 }
 return <section className="section more-screen">
  <div className="section-heading"><div><h2>Więcej</h2><p>Ustawienia, pomiary i kopie danych.</p></div></div>
  <section className="settings-section account-section"><h3>Konto</h3>
   <div className="account-row"><span><b>{displayName||"Twoje konto"}</b><small>{accountEmail}</small><small>{syncStatusMessage(syncStatus)}</small></span><span className={`sync-dot ${syncStatus}`} aria-hidden="true"/></div>
   {!editingName?<button className="data-action" onClick={()=>{setNameDraft(displayName);setEditingName(true)}}>Zmień imię <span>›</span></button>:<form className="account-inline-form" onSubmit={saveName}><label className="field-label">IMIĘ<input autoFocus minLength={2} maxLength={30} value={nameDraft} onChange={event=>setNameDraft(event.target.value)}/></label><button className="primary compact" disabled={nameBusy}>Zapisz</button><button type="button" className="quiet-button" onClick={()=>setEditingName(false)}>Anuluj</button></form>}
   {!passwordOpen?<button className="data-action" onClick={()=>setPasswordOpen(true)}>Zmień hasło <span>›</span></button>:<form className="account-inline-form" onSubmit={savePassword}><label className="field-label">OBECNE HASŁO<input type="password" autoComplete="current-password" required value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)}/></label><label className="field-label">NOWE HASŁO<input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={event=>setNewPassword(event.target.value)}/></label><label className="field-label">POWTÓRZ NOWE HASŁO<input type="password" autoComplete="new-password" minLength={8} required value={repeatPassword} onChange={event=>setRepeatPassword(event.target.value)}/></label><button className="primary compact" disabled={passwordBusy}>Zapisz nowe hasło</button><button type="button" className="quiet-button" onClick={()=>setPasswordOpen(false)}>Anuluj</button></form>}
   {!deleteOpen?<button className="data-action danger-text" onClick={()=>setDeleteOpen(true)}>Usuń konto <span>›</span></button>:<div className="delete-account-panel"><p>Usunięcie konta i danych treningowych z chmury jest trwałe.</p><label className="field-label">WPISZ USUŃ<input value={deleteText} onChange={event=>setDeleteText(event.target.value)} autoComplete="off"/></label><button className="quiet-button danger-text" disabled={!validateDeleteConfirmation(deleteText)||deleteBusy} onClick={()=>void removeAccount()}>{deleteBusy?"Usuwanie…":"Usuń konto trwale"}</button><button className="quiet-button" onClick={()=>{setDeleteOpen(false);setDeleteText("")}}>Anuluj</button></div>}
   <button className="data-action" disabled={syncStatus==="offline"} onClick={()=>void onSyncNow()}>Synchronizuj <span>›</span></button>
   <button className="data-action danger-text" onClick={()=>void onSignOut().catch(()=>notify("Nie udało się wylogować. Spróbuj ponownie."))}>Wyloguj <span>›</span></button>
  </section>
  <section className="settings-section"><h3>Trening</h3>
   <label className="setting-row"><span><b>Domyślna przerwa</b><small>Używana dla nowych ćwiczeń</small></span><span className="setting-input"><input type="number" inputMode="numeric" min="0" max="1800" value={settings.defaultRestSec} onChange={event=>void update({defaultRestSec:bounded(event.target.value,0,1800,120)})}/> s</span></label>
   <label className="setting-row"><span><b>Domyślne RIR</b><small>Podpowiedź w nowych planach</small></span><input className="short-setting-input" inputMode="numeric" value={settings.defaultRir??"2"} onChange={event=>void update({defaultRir:event.target.value})}/></label>
   <label className="setting-row"><span><b>Minimalny skok ciężaru</b><small>Progresja dla nowych ćwiczeń</small></span><span className="setting-input"><input type="number" inputMode="decimal" step="0.1" min="0.1" value={settings.defaultIncrement??2.5} onChange={event=>void update({defaultIncrement:boundedFloat(event.target.value,.1,100,2.5)})}/> kg</span></label>
   <Toggle label="Autostart przerwy" checked={settings.autoRest} onChange={autoRest=>void update({autoRest})}/>
   <Toggle label="Dźwięk po przerwie" checked={settings.sound} onChange={sound=>void update({sound})}/>
   <Toggle label="Haptyka" checked={settings.haptics??settings.vibration} onChange={haptics=>void update({haptics,vibration:haptics})}/>
   <Toggle label="Pokaż grafiki ćwiczeń" checked={settings.showExerciseImages??true} onChange={showExerciseImages=>void update({showExerciseImages})}/>
   <Toggle label="Wstępnie wpisuj poprzedni ciężar" checked={settings.prefillPreviousWeight??false} onChange={prefillPreviousWeight=>void update({prefillPreviousWeight})}/>
   <Toggle label="Kopiuj RIR z poprzedniej serii" checked={settings.copyPreviousRir??false} onChange={copyPreviousRir=>void update({copyPreviousRir})}/>
   <Toggle label="Nie wygaszaj ekranu podczas treningu" checked={settings.keepScreenAwake??true} onChange={keepScreenAwake=>void update({keepScreenAwake})}/>
   <div className="plate-settings"><b>Ustawienia talerzy</b><label className="setting-row"><span><b>Waga gryfu</b></span><select aria-label="Waga gryfu" value={settings.barWeight===15?"15":settings.barWeight===20?"20":"custom"} onChange={event=>{const value=event.target.value;if(value!=="custom")void update({barWeight:Number(value)})}}><option value="20">20 kg</option><option value="15">15 kg</option><option value="custom">Własna</option></select></label>{settings.barWeight!==15&&settings.barWeight!==20&&<label className="field-label">WŁASNA WAGA GRYFU (KG)<input type="number" inputMode="decimal" min="1" max="100" step="0.25" value={settings.barWeight??20} onChange={event=>void update({barWeight:boundedFloat(event.target.value,1,100,20)})}/></label>}<span className="muted">Dostępne talerze · każda zaznaczona wartość oznacza komplet na obie strony</span><div className="plate-toggle-grid">{DEFAULT_PLATES.map(plate=><label key={plate}><input type="checkbox" checked={(settings.availablePlates??DEFAULT_PLATES).includes(plate)} onChange={event=>{const current=settings.availablePlates??DEFAULT_PLATES;const next=event.target.checked?[...current,plate]:current.filter(value=>value!==plate);void update({availablePlates:next})}}/><span>{plate} kg</span></label>)}</div></div>
  </section>
  <section className="settings-section"><h3>Wygląd</h3><label className="setting-row"><span><b>Motyw</b></span><select value={settings.theme} onChange={event=>void update({theme:event.target.value as Settings["theme"]})}><option value="dark">Ciemny</option><option value="light">Jasny</option><option value="system">Systemowy</option></select></label></section>
  <section className="settings-section body-section"><h3>Pomiary ciała</h3><form className="body-form" onSubmit={saveBody}>
   <label className="field-label">MASA (KG)<input inputMode="decimal" value={weight} onChange={event=>setWeight(event.target.value)} placeholder="70,0"/></label>
   <label className="field-label">TALIA (CM)<input inputMode="decimal" value={waist} onChange={event=>setWaist(event.target.value)}/></label>
   <label className="field-label">KLATKA (CM)<input inputMode="decimal" value={chest} onChange={event=>setChest(event.target.value)}/></label>
   <label className="field-label">RAMIĘ (CM)<input inputMode="decimal" value={arm} onChange={event=>setArm(event.target.value)}/></label>
   <label className="field-label span-two">NOTATKA<input value={note} onChange={event=>setNote(event.target.value)}/></label>
   <button className="primary span-two" disabled={saving} type="submit">Zapisz pomiar</button>
  </form>
  {body.length>0&&<div className="body-log">{body.map(entry=><div key={entry.id}><span>{date(entry.date)}{entry.waist!=null?` · talia ${entry.waist} cm`:""}</span><b>{entry.weight==null?"—":`${entry.weight} kg`}</b></div>)}</div>}
  </section>
  <section className="settings-section"><h3>Dane</h3><button className="data-action" onClick={()=>void exportJson()}>Pobierz kopię JSON <span>›</span></button><label className="data-action file-action">Wczytaj kopię JSON<input type="file" accept=".json,application/json" onChange={event=>{const file=event.target.files?.[0];if(file)void importJson(file);event.currentTarget.value=""}}/><span>›</span></label><button className="data-action" onClick={()=>void exportCsv()}>Eksport historii CSV <span>›</span></button></section>
  <p className="app-version">Gym · wersja 0.2.0</p>
 </section>;
}

function Toggle({label,checked,onChange}:{label:string;checked:boolean;onChange:(value:boolean)=>void}){return <label className="setting-row"><b>{label}</b><input className="toggle" type="checkbox" checked={checked} onChange={event=>onChange(event.target.checked)}/></label>}
function bounded(raw:string,min:number,max:number,fallback:number){const value=Number(raw);return Number.isFinite(value)?Math.max(min,Math.min(max,Math.trunc(value))):fallback}
function boundedFloat(raw:string,min:number,max:number,fallback:number){const value=Number(raw.replace(",","."));return Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback}
