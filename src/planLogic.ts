import type { ActiveWorkout, ExerciseTemplate, WorkoutTemplate } from "./types";

export type IdFactory=()=>string;

export function createWorkoutSnapshot(template:WorkoutTemplate,startedAt:number,idFactory:IdFactory):ActiveWorkout{
 return {
  id:idFactory(),
  templateId:template.id,
  name:template.name,
  startedAt,
  currentExerciseId:template.exercises[0]?.id,
  rest:null,
  exercises:template.exercises.map(exercise=>({
   templateExerciseId:exercise.id,
   name:exercise.name,
   target:structuredClone(exercise),
   sets:Array.from({length:Number.isFinite(exercise.sets)?Math.max(0,Math.min(20,Math.floor(exercise.sets))):0},(_,index)=>({
    id:idFactory(),setNo:index+1,weight:null,reps:null,rir:null,completedAt:null
   }))
  }))
 };
}

export function createWorkoutTemplate(name:string,id:string,createdAt=Date.now()):WorkoutTemplate{
 return {id,name:name.trim(),exercises:[],createdAt};
}

export function duplicateWorkoutTemplate(template:WorkoutTemplate,id:string,name=`${template.name} COPY`):WorkoutTemplate{
 return {...structuredClone(template),id,name,createdAt:Date.now()};
}

export function addTemplateExercise(template:WorkoutTemplate,exercise:ExerciseTemplate):WorkoutTemplate{
 if(template.exercises.some(item=>item.id===exercise.id)) return template;
 return {...template,exercises:[...template.exercises,structuredClone(exercise)]};
}

export function updateTemplateExercise(template:WorkoutTemplate,exerciseId:string,patch:Partial<ExerciseTemplate>):WorkoutTemplate{
 return {...template,exercises:template.exercises.map(exercise=>
  exercise.id===exerciseId?{...exercise,...patch,id:exercise.id}:exercise
 )};
}

export function removeTemplateExercise(template:WorkoutTemplate,exerciseId:string):WorkoutTemplate{
 return {...template,exercises:template.exercises.filter(exercise=>exercise.id!==exerciseId)};
}

export function moveTemplateExercise(template:WorkoutTemplate,exerciseId:string,targetIndex:number):WorkoutTemplate{
 const sourceIndex=template.exercises.findIndex(exercise=>exercise.id===exerciseId);
 if(sourceIndex<0||template.exercises.length<2) return template;
 const boundedIndex=Math.max(0,Math.min(template.exercises.length-1,targetIndex));
 if(sourceIndex===boundedIndex) return template;
 const exercises=[...template.exercises];
 const [moved]=exercises.splice(sourceIndex,1);
 exercises.splice(boundedIndex,0,moved);
 return {...template,exercises};
}

export function validateWorkoutTemplate(template:WorkoutTemplate):string|null{
 if(!template.name.trim())return "Wpisz nazwę treningu.";
 for(const exercise of template.exercises){
  if(!exercise.name.trim())return "Każde ćwiczenie musi mieć nazwę.";
  if(!Number.isInteger(exercise.sets)||exercise.sets<1||exercise.sets>20)return `${exercise.name}: liczba serii musi wynosić 1–20.`;
  if(!Number.isInteger(exercise.repMin)||!Number.isInteger(exercise.repMax)||exercise.repMin<0||exercise.repMax<exercise.repMin||exercise.repMax>300)return `${exercise.name}: sprawdź zakres powtórzeń.`;
  const rir=Number(exercise.rir.trim().replace(",","."));
  if(!Number.isFinite(rir)||rir<0||rir>10)return `${exercise.name}: RIR musi wynosić 0–10.`;
  if(!Number.isInteger(exercise.restSec)||exercise.restSec<0||exercise.restSec>1800)return `${exercise.name}: przerwa musi wynosić 0–1800 sekund.`;
  if(exercise.minIncrement!==undefined&&(!Number.isFinite(exercise.minIncrement)||exercise.minIncrement<=0||exercise.minIncrement>100))return `${exercise.name}: minimalny skok ciężaru musi być większy od 0 kg.`;
 }
 return null;
}
