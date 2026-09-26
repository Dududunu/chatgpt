import {useState} from "react";
import {getExerciseTechnique} from "./exerciseTechnique";
import {resolveExerciseImage} from "./exerciseImages";

export function ExerciseImage({exerciseId}:{exerciseId:string}){
 const [failedImageId,setFailedImageId]=useState<string|null>(null);
 const view=resolveExerciseImage(exerciseId,failedImageId===exerciseId);
 if(view.kind==="fallback")return <div className="exerciseImageFallback" role="img" aria-label="Brak podglądu ćwiczenia">
  <svg viewBox="0 0 48 32" aria-hidden="true"><path d="M5 16h38M10 10v12M15 12v8M33 12v8M38 10v12"/></svg>
  <span>Brak podglądu ćwiczenia</span>
 </div>;

 const {spec}=view;
 const technique=getExerciseTechnique(exerciseId)??[];
 return <div className="exerciseImageBlock">
  <img className="exerciseImage" src={spec.imagePath} alt={`Atlas ćwiczenia: ${spec.exerciseName}`} loading="lazy" decoding="async" onError={()=>setFailedImageId(exerciseId)}/>
  <div className="exerciseImageMuscles" aria-label="Zaangażowane mięśnie">
   <div className="exerciseImageMuscleRow"><span className="exerciseImageMuscleLabel">Główne</span>{spec.mainMuscles.map(muscle=><span className="muscleTag primaryMuscle" key={muscle}>{muscle}</span>)}</div>
   {spec.secondaryMuscles.length>0&&<div className="exerciseImageMuscleRow"><span className="exerciseImageMuscleLabel">Dodatkowe</span>{spec.secondaryMuscles.map(muscle=><span className="muscleTag" key={muscle}>{muscle}</span>)}</div>}
  </div>
  {technique.length>0&&<details className="technique"><summary>Technika</summary><ul>{technique.map(point=><li key={point}>{point}</li>)}</ul></details>}
 </div>;
}
