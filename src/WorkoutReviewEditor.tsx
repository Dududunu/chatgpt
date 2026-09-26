import { useEffect, useRef, useState } from "react";
import type { WorkoutHistory, WorkoutPhotoQueueEntry } from "./types";
import { compressWorkoutPhoto } from "./workoutPhoto";
import { localWorkoutPhoto, queueWorkoutPhotoRemoval, queueWorkoutPhotoUpload, resolveWorkoutPhoto } from "./workoutMedia";
import { countReviewWords, MAX_REVIEW_SENTENCES, MAX_REVIEW_WORDS, validateWorkoutRating, validateWorkoutReview } from "./workoutReview";

type ReviewPatch=Partial<Pick<WorkoutHistory,"rating"|"reviewText"|"photoPath">>;
type Props={
 workout:WorkoutHistory;
 userId:string;
 readOnly?:boolean;
 syncStatus?:string;
 onSaveReview:(patch:ReviewPatch)=>Promise<void>;
 onRetry:()=>Promise<void>;
 notify:(message:string)=>void;
};

function storedRating(value:unknown):number|null{
 const result=validateWorkoutRating(value);
 return result.ok?result.value:null;
}

function statusText(entry:WorkoutPhotoQueueEntry|null):string{
 if(!entry)return "";
 if(entry.status==="uploading")return "Wysyłanie zdjęcia…";
 if(entry.errorPhase==="delete")return "Zdjęcie zapisano; usunięcie poprzedniej kopii czeka na synchronizację.";
 if(entry.status==="error"||entry.status==="pending")return "Zdjęcie czeka na synchronizację.";
 return "";
}

export function WorkoutReviewEditor({workout,userId,readOnly=false,syncStatus,onSaveReview,onRetry,notify}:Props){
 const [rating,setRating]=useState(()=>storedRating(workout.rating));
 const [review,setReview]=useState(workout.reviewText??"");
 const [queue,setQueue]=useState<WorkoutPhotoQueueEntry|null>(null);
 const [photo,setPhoto]=useState<Blob|null>(null);
 const [photoUrl,setPhotoUrl]=useState<string|null>(null);
 const [photoError,setPhotoError]=useState("");
 const [working,setWorking]=useState(false);
 const [expanded,setExpanded]=useState(false);
 const inputRef=useRef<HTMLInputElement>(null);
 const reviewValidation=validateWorkoutReview(review);

 async function loadPhoto(){
  try{
   const entry=await localWorkoutPhoto(userId,workout.id);
   setQueue(entry);
   const localBlob=entry?.blob??await resolveWorkoutPhoto(userId,workout);
   setPhoto(localBlob);
   const latest=await localWorkoutPhoto(userId,workout.id);
   setQueue(latest);
   setPhotoError("");
  }catch{
   setPhoto(null);
   setPhotoError(navigator.onLine?"Nie udało się wczytać zdjęcia treningu.":"Zdjęcie będzie dostępne po połączeniu z internetem.");
  }
 }

 useEffect(()=>{void loadPhoto()},[workout.id,workout.photoPath,userId,syncStatus]);
 useEffect(()=>{
  if(!photo){setPhotoUrl(null);return}
  const url=URL.createObjectURL(photo);
  setPhotoUrl(url);
  return()=>URL.revokeObjectURL(url);
 },[photo]);

 async function saveReview(patch:ReviewPatch){
  try{await onSaveReview(patch)}
  catch{notify("Nie udało się zapisać zmian na tym urządzeniu.")}
 }

 async function changeRating(next:number|null){
  if(readOnly)return;
  const validated=validateWorkoutRating(next);
  if(!validated.ok){notify(validated.error);return}
  setRating(validated.value);
  await saveReview({rating:validated.value});
 }

 async function changeReview(value:string){
  setReview(value);
  const validation=validateWorkoutReview(value);
  if(!validation.error)await saveReview({reviewText:validation.value});
 }

 async function selectPhoto(file:File|null){
  if(!file)return;
  setWorking(true);setPhotoError("");
  try{
   const compressed=await compressWorkoutPhoto(file);
   const queued=await queueWorkoutPhotoUpload(userId,workout.id,compressed);
   setQueue(queued);setPhoto(compressed);
   await saveReview({photoPath:workout.photoPath??null});
  }catch(error){setPhotoError(error instanceof Error?error.message:"Nie udało się dodać zdjęcia.")}
  finally{setWorking(false);if(inputRef.current)inputRef.current.value=""}
 }

 async function removePhoto(){
  if(readOnly)return;
  setWorking(true);setPhotoError("");
  try{
   await queueWorkoutPhotoRemoval(userId,workout.id);
   await saveReview({photoPath:null});
   setPhoto(null);setQueue(await localWorkoutPhoto(userId,workout.id));
  }catch(error){setPhotoError(error instanceof Error?error.message:"Nie udało się usunąć zdjęcia.")}
  finally{setWorking(false)}
 }

 async function retryPhoto(){
  setWorking(true);
  try{await onRetry();await loadPhoto()}
  catch{setPhotoError("Zdjęcie czeka na synchronizację. Spróbuj ponownie później.")}
  finally{setWorking(false)}
 }

 const hasPhoto=Boolean(photoUrl||photo||workout.photoPath);
 const photoStatus=statusText(queue);
 const canRetry=!readOnly&&Boolean(queue&&(queue.status==="pending"||queue.status==="error"||queue.deletePaths.length))&&!working;
 if(readOnly&&!workout.rating&&!workout.reviewText&&!workout.photoPath)return null;

 return <section className={`workout-review${readOnly?" workout-review-readonly":""}`}>
  {!readOnly&&<>
   <div className="summary-section review-rating-section">
    <h3>JAK POSZEDŁ TRENING?</h3>
    <div className="workout-rating" role="group" aria-label="Ocena treningu">
     {[1,2,3,4,5].map(value=><button key={value} type="button" className={value<=(rating??0)?"selected":""} aria-label={`${value} ${value===1?"gwiazdka":"gwiazdki"}`} aria-pressed={rating===value} disabled={working} onClick={()=>void changeRating(rating===value?null:value)}>{value<=(rating??0)?"★":"☆"}</button>)}
    </div>
    {rating!==null&&<button type="button" className="review-clear-rating" disabled={working} onClick={()=>void changeRating(null)}>Wyczyść ocenę</button>}
   </div>
   <div className="summary-section review-note-section">
    <label htmlFor={`workout-review-${workout.id}`}><h3>NOTATKA PO TRENINGU</h3></label>
    <textarea id={`workout-review-${workout.id}`} value={review} rows={3} aria-describedby={`review-count-${workout.id}`} onChange={event=>void changeReview(event.target.value)}/>
    <div id={`review-count-${workout.id}`} className="review-count"><span>{countReviewWords(review)} / {MAX_REVIEW_WORDS} słów</span><span>{reviewValidation.sentenceCount} / {MAX_REVIEW_SENTENCES} zdań</span></div>
    {reviewValidation.error&&<p className="review-error" role="alert">{reviewValidation.error}</p>}
   </div>
  </>}
  {readOnly&&workout.rating!=null&&<div className="summary-section review-readonly-rating"><h3>OCENA</h3><p aria-label={`${workout.rating} z 5 gwiazdek`}>{"★".repeat(storedRating(workout.rating)??0)}{"☆".repeat(5-(storedRating(workout.rating)??0))}</p></div>}
  {readOnly&&workout.reviewText&&<div className="summary-section review-readonly-note"><h3>NOTATKA</h3><p>{workout.reviewText}</p></div>}
  {(!readOnly||workout.photoPath)&&<div className="summary-section workout-photo-section">
   {readOnly?workout.photoPath&&<h3>ZDJĘCIE</h3>:<h3>ZDJĘCIE PO TRENINGU</h3>}
   {hasPhoto&&photoUrl?<button type="button" className="workout-photo-preview" onClick={()=>setExpanded(true)} aria-label="Powiększ zdjęcie treningu"><img src={photoUrl} alt="Zdjęcie z treningu"/></button>:hasPhoto?<div className="workout-photo-placeholder">{photoError||"Wczytywanie zdjęcia…"}</div>:readOnly?null:<div className="workout-photo-placeholder">Brak dodanego zdjęcia</div>}
   {!readOnly&&<div className="workout-photo-actions">
    <input ref={inputRef} className="visually-hidden-file" type="file" accept="image/*" aria-label="Wybierz zdjęcie z treningu" onChange={event=>void selectPhoto(event.target.files?.[0]??null)}/>
    <button type="button" className="quiet-button" disabled={working||queue?.status==="uploading"} onClick={()=>inputRef.current?.click()}>{hasPhoto?"ZMIEŃ ZDJĘCIE":"DODAJ ZDJĘCIE"}</button>
    {hasPhoto&&<button type="button" className="quiet-button" disabled={working||queue?.status==="uploading"} onClick={()=>void removePhoto()}>USUŃ</button>}
   </div>}
   {photoStatus&&<p className="workout-photo-status" role="status">{photoStatus}</p>}
   {canRetry&&<button type="button" className="quiet-button photo-retry" disabled={!navigator.onLine} onClick={()=>void retryPhoto()}>SPRÓBUJ PONOWNIE</button>}
   {photoError&&(!hasPhoto||readOnly)&&<p className="review-error" role="alert">{photoError}</p>}
  </div>}
  {expanded&&photoUrl&&<div className="workout-photo-lightbox" role="dialog" aria-modal="true" aria-label="Zdjęcie treningu" onClick={()=>setExpanded(false)}><button type="button" aria-label="Zamknij podgląd" onClick={()=>setExpanded(false)}>×</button><img src={photoUrl} alt="Zdjęcie z treningu"/></div>}
 </section>;
}
