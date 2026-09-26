export type NumericField=number|string|null;

export type ExerciseTemplate={
 id:string;
 name:string;
 sets:number;
 repMin:number;
 repMax:number;
 rir:string;
 tempo:string;
 restSec:number;
 superset?:string;
 perLeg?:boolean;
 timed?:boolean;
};

export type WorkoutTemplate={id:string;name:string;exercises:ExerciseTemplate[]};

export type SetLog={
 id:string;
 setNo:number;
 weight:NumericField;
 reps:NumericField;
 rir:NumericField;
 completedAt:number|null;
 restStartedAt?:number;
 restEndsAt?:number;
};

export type ExerciseLog={
 templateExerciseId:string;
 name:string;
 target:ExerciseTemplate;
 sets:SetLog[];
};

export type RestState={
 exerciseName:string;
 nextSet:number;
 startedAt:number;
 endsAt:number;
 pausedRemaining?:number;
 notifiedAt?:number;
};

export type ActiveWorkout={
 id:string;
 templateId:string;
 name:string;
 startedAt:number;
 exercises:ExerciseLog[];
 /** Stable exercise identity for restoring the active screen if plan order changes. */
 currentExerciseId?:string;
 rest?:RestState|null;
};

export type WorkoutHistory=ActiveWorkout&{endedAt:number};

export type BodyEntry={
 id:string;
 date:number;
 weight?:number;
 waist?:number;
 chest?:number;
 arm?:number;
 note?:string;
};

export type Settings={
 id:"main";
 defaultRestSec:number;
 autoRest:boolean;
 sound:boolean;
 vibration:boolean;
 theme:"dark"|"light"|"system";
};
