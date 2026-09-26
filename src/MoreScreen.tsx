import { useState } from "react";
import type { BodyEntry, Settings } from "./types";

type Props={databaseVersion:number;settings:Settings|null;body:BodyEntry[];onSaveSettings:(patch:Partial<Settings>)=>Promise<void>;onAddBody:(entry:BodyEntry)=>Promise<void>;exportJson:()=>Promise<void>;importJson:(file:File)=>Promise<void>;exportCsv:()=>Promise<void>;notify:(message:string)=>void};
const id=()=>crypto.randomUUID();
const date=(time:number)=>new Intl.DateTimeFormat("pl-PL",{day:"numeric",month:"short",year:"numeric"}).format(time);
const parse=(raw:string)=>{if(!raw.trim())return null;const value=Number(raw.trim().replace(",","."));return Number.isFinite(value)&&value>=0?value:null};

export function MoreScreen({databaseVersion,settings,body,onSaveSettings,onAddBody,exportJson,importJson,exportCsv,notify}:Props){
 const [weight,setWeight]=useState("");
 const [waist,setWaist]=useState("");
 const [chest,setChest]=useState("");
 const [arm,setArm]=useState("");
 const [note,setNote]=useState("");
 const [saving,setSaving]=useState(false);
 if(!settings)return <section className="section"><p className="muted">Wczytywanie ustawień…</p></section>;
 async function update(patch:Partial<Settings>){await onSaveSettings(patch)}
 async function saveBody(event:React.FormEvent){
  event.preventDefault();const parsed={weight:parse(weight),waist:parse(waist),chest:parse(chest),arm:parse(arm)};
  if(Object.values(parsed).every(value=>value===null)&&!note.trim()){notify("Wpisz przynajmniej jeden pomiar");return}
  setSaving(true);
  try{await onAddBody({id:id(),date:Date.now(),weight:parsed.weight??undefined,waist:parsed.waist??undefined,chest:parsed.chest??undefined,arm:parsed.arm??undefined,note:note.trim()||undefined});setWeight("");setWaist("");setChest("");setArm("");setNote("");notify("Pomiar zapisany")}
  finally{setSaving(false)}
 }
 return <section className="section more-screen">
  <div className="section-heading"><div><h2>Więcej</h2><p>Ustawienia, pomiary i kopie danych.</p></div></div>
  <section className="settings-section"><h3>Trening</h3>
   <label className="setting-row"><span><b>Domyślna przerwa</b><small>Używana dla nowych ćwiczeń</small></span><span className="setting-input"><input type="number" inputMode="numeric" min="0" max="1800" value={settings.defaultRestSec} onChange={event=>void update({defaultRestSec:bounded(event.target.value,0,1800,120)})}/> s</span></label>
   <label className="setting-row"><span><b>Domyślne RIR</b><small>Podpowiedź w nowych planach</small></span><input className="short-setting-input" inputMode="numeric" value={settings.defaultRir??"2"} onChange={event=>void update({defaultRir:event.target.value})}/></label>
   <label className="setting-row"><span><b>Minimalny skok ciężaru</b><small>Progresja dla nowych ćwiczeń</small></span><span className="setting-input"><input type="number" inputMode="decimal" step="0.1" min="0.1" value={settings.defaultIncrement??2.5} onChange={event=>void update({defaultIncrement:boundedFloat(event.target.value,.1,100,2.5)})}/> kg</span></label>
   <Toggle label="Autostart przerwy" checked={settings.autoRest} onChange={autoRest=>void update({autoRest})}/>
   <Toggle label="Dźwięk po przerwie" checked={settings.sound} onChange={sound=>void update({sound})}/>
   <Toggle label="Wibracja po przerwie" checked={settings.vibration} onChange={vibration=>void update({vibration})}/>
   <Toggle label="Pokaż grafiki ćwiczeń" checked={settings.showExerciseImages??true} onChange={showExerciseImages=>void update({showExerciseImages})}/>
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
  <p className="app-version">Gym PWA · dane lokalne w IndexedDB · wersja 0.2.0 · baza danych v{databaseVersion}</p>
 </section>;
}

function Toggle({label,checked,onChange}:{label:string;checked:boolean;onChange:(value:boolean)=>void}){return <label className="setting-row"><b>{label}</b><input className="toggle" type="checkbox" checked={checked} onChange={event=>onChange(event.target.checked)}/></label>}
function bounded(raw:string,min:number,max:number,fallback:number){const value=Number(raw);return Number.isFinite(value)?Math.max(min,Math.min(max,Math.trunc(value))):fallback}
function boundedFloat(raw:string,min:number,max:number,fallback:number){const value=Number(raw.replace(",","."));return Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback}
