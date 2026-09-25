import type { ActiveWorkout, ExerciseTemplate, NumericField, SetLog } from "./types";

export function toFiniteNumber(value:NumericField):number|null{
 if(typeof value==="number") return Number.isFinite(value)?value:null;
 if(typeof value!=="string") return null;
 const normalized=value.trim().replace(",",".");
 if(!normalized || normalized==="." || normalized==="-") return null;
 const parsed=Number(normalized);
 return Number.isFinite(parsed)?parsed:null;
}

export function normalizeSetForCompletion(set:SetLog,target:ExerciseTemplate):
 {ok:true;weight:number;reps:number;rir:number|null}|{ok:false;message:string}{
 const weight=toFiniteNumber(set.weight);
 const reps=toFiniteNumber(set.reps);
 const rir=toFiniteNumber(set.rir);

 if(weight===null || weight<0) return {ok:false,message:"Wpisz poprawny ciężar (0 kg jest dozwolone)."};
 if(reps===null || reps<=0) return {ok:false,message:target.timed?"Wpisz czas w sekundach.":"Wpisz liczbę powtórzeń."};
 if(!target.timed && !Number.isInteger(reps)) return {ok:false,message:"Liczba powtórzeń musi być całkowita."};
 if(rir!==null && (rir<0 || rir>10)) return {ok:false,message:"RIR powinien być w zakresie 0–10."};

 return {ok:true,weight,reps,rir};
}

export function shouldStartRest(workout:ActiveWorkout,exerciseIndex:number,setIndex:number):boolean{
 const current=workout.exercises[exerciseIndex];
 const group=current.target.superset;
 if(!group) return true;

 const groupExercises=workout.exercises.filter(ex=>ex.target.superset===group);
 return groupExercises.every(ex=>{
  const pairedSet=ex.sets[setIndex];
  return !pairedSet || Boolean(pairedSet.completedAt);
 });
}
