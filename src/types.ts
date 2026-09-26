export type NumericField=number|string|null;
export type SyncFields={updatedAt?:number;deletedAt?:number};
export type SetType="normal"|"warmup"|"drop"|"failure";

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
 muscleGroup?:string;
 equipment?:string;
 minIncrement?:number;
};

export type WorkoutTemplate=SyncFields&{id:string;name:string;exercises:ExerciseTemplate[];createdAt?:number};

export type SetLog={
 id:string;
 setNo:number;
 weight:NumericField;
 reps:NumericField;
 rir:NumericField;
 completedAt:number|null;
 type?:SetType;
 toFailure?:boolean;
 restStartedAt?:number;
 restEndsAt?:number;
};

export type ExerciseLog={
 templateExerciseId:string;
 name:string;
 target:ExerciseTemplate;
 sets:SetLog[];
 note?:string;
};

export type RestState={
 exerciseName:string;
 nextExerciseId?:string;
 nextSet:number;
 completedExerciseName?:string;
 completedSetNo?:number;
 completedSetTotal?:number;
 startedAt:number;
 endsAt:number;
 kind?:"rest"|"manual";
 pausedRemaining?:number;
 notifiedAt?:number;
};

export type ActiveWorkout=SyncFields&{
 id:string;
 templateId:string;
 name:string;
 startedAt:number;
 exercises:ExerciseLog[];
 /** Stable exercise identity for restoring the active screen if plan order changes. */
 currentExerciseId?:string;
 rest?:RestState|null;
 /** Exercise set-count edits are intentionally applied to the plan only after user confirmation. */
 planSetChanges?:string[];
};

export type WorkoutHistory=ActiveWorkout&{
 endedAt:number;
 rating?:number|null;
 reviewText?:string|null;
 /** Private workout-media object key, never a public URL. */
 photoPath?:string|null;
};

export type WorkoutPhotoSyncStatus="pending"|"uploading"|"uploaded"|"error";
export type WorkoutPhotoErrorPhase="upload"|"delete";
/** A compressed local copy also acts as the durable offline upload queue. */
export type WorkoutPhotoQueueEntry={
 id:string;
 userId:string;
 workoutId:string;
 blob:Blob|null;
 /** Stable target path makes an upload retry idempotent. */
 queuedPath?:string|null;
 photoPath:string|null;
 deletePaths:string[];
 status:WorkoutPhotoSyncStatus;
 errorPhase?:WorkoutPhotoErrorPhase;
 lastError?:string;
 updatedAt:number;
};

export type BodyEntry=SyncFields&{
 id:string;
 date:number;
 weight?:number;
 waist?:number;
 chest?:number;
 arm?:number;
 note?:string;
};

export type Settings=SyncFields&{
 id:"main";
 defaultRestSec:number;
 autoRest:boolean;
 sound:boolean;
 vibration:boolean;
 theme:"dark"|"light"|"system";
 hideMotion?:boolean;
 showExerciseImages?:boolean;
 defaultRir?:string;
 defaultIncrement?:number;
 prefillPreviousWeight?:boolean;
 keepScreenAwake?:boolean;
};

export type SyncMeta={
 id:"main";
 userId?:string;
 activeDeletedAt?:number;
 displayName?:string;
 profileUpdatedAt?:number;
 legacyMigratedAt?:number;
};
