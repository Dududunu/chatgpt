export type ExerciseImageSpec={
 exerciseId:string;
 exerciseName:string;
 imagePath:string;
 mainMuscles:readonly string[];
 secondaryMuscles:readonly string[];
};

const image=(exerciseId:string,exerciseName:string,imageFile:string,mainMuscles:string[],secondaryMuscles:string[]=[]):ExerciseImageSpec=>({
 exerciseId,
 exerciseName,
 imagePath:`./exercise-images/${imageFile}.webp`,
 mainMuscles,
 secondaryMuscles
});

/** Local original illustrations for every exercise in the bundled UPPER/LOWER plans. */
export const exerciseImageSpecs:Record<string,ExerciseImageSpec>={
 "incline-db":image("incline-db","Wyciskanie hantli na ławce skośnej","incline-db",["Górna klatka"],["Triceps","Przedni bark"]),
 "seal-row-db":image("seal-row-db","Focze wiosło hantlami","seal-row-db",["Plecy środkowe","Najszerszy grzbietu"],["Biceps","Tylny bark"]),
 chinup:image("chinup","Podciąganie podchwytem","chinup",["Najszerszy grzbietu"],["Biceps","Obły większy"]),
 "cable-lateral":image("cable-lateral","Wznosy w bok na wyciągu","cable-lateral",["Boczny bark"],["Nadgrzebieniowy"]),
 "hammer-rope":image("hammer-rope","Uginanie młotkowe z warkoczem","hammer-rope",["Ramienny","Ramienno-promieniowy"],["Biceps"]),
 "rope-pushdown":image("rope-pushdown","Prostowanie ramion z warkoczem","rope-pushdown",["Triceps"]),
 "back-squat":image("back-squat","Przysiad ze sztangą","back-squat",["Czworogłowe uda","Pośladki"],["Przywodziciele"]),
 "walking-lunge":image("walking-lunge","Wykroki chodzone z hantlami","walking-lunge",["Czworogłowe uda","Pośladki"],["Dwugłowe uda"]),
 "hip-thrust":image("hip-thrust","Hip thrust ze sztangą","hip-thrust",["Pośladki"],["Dwugłowe uda"]),
 "standing-calf":image("standing-calf","Wspięcia na palce stojąc","standing-calf",["Brzuchaty łydki"],["Płaszczkowaty"]),
 "leg-curl":image("leg-curl","Uginanie kolan na maszynie","leg-curl",["Dwugłowe uda"],["Brzuchaty łydki"]),
 "cable-crunch":image("cable-crunch","Allahy na wyciągu","cable-crunch",["Prosty brzucha"],["Skośne brzucha"]),
 ohp:image("ohp","OHP ze sztangą","ohp",["Barki"],["Triceps","Górna klatka"]),
 bench:image("bench","Wyciskanie sztangi na ławce płaskiej","bench",["Klatka piersiowa"],["Triceps","Przedni bark"]),
 "single-pulldown":image("single-pulldown","Ściąganie jednorącz z wyciągu górnego","single-pulldown",["Najszerszy grzbietu"],["Biceps"]),
 "pec-deck":image("pec-deck","Rozpiętki Butterfly","pec-deck",["Klatka piersiowa"],["Przedni bark"]),
 "reverse-pec-deck":image("reverse-pec-deck","Odwrotne rozpiętki Butterfly","reverse-pec-deck",["Tylny bark","Część środkowa pleców"],["Czworoboczny"]),
 "incline-curl":image("incline-curl","Uginanie ramion z hantlami na ławce skośnej","incline-curl",["Biceps"],["Ramienny"]),
 "db-french":image("db-french","Wyciskanie francuskie z hantlami leżąc","db-french",["Triceps"]),
 rdl:image("rdl","Rumuński martwy ciąg ze sztangą (RDL)","rdl",["Dwugłowe uda","Pośladki"],["Prostowniki grzbietu"]),
 "leg-press":image("leg-press","Leg press","leg-press",["Czworogłowe uda","Pośladki"],["Przywodziciele"]),
 "back-extension":image("back-extension","Wyprosty tułowia na ławce rzymskiej","back-extension",["Prostowniki grzbietu","Pośladki"],["Dwugłowe uda"]),
 "seated-calf":image("seated-calf","Wspięcia na palce siedząc","seated-calf",["Płaszczkowaty"],["Brzuchaty łydki"]),
 "leg-extension-uni":image("leg-extension-uni","Wyprosty nóg na maszynie jednonóż","leg-extension-uni",["Czworogłowe uda"]),
 "farmer-single":image("farmer-single","Spacer farmera jednorącz","farmer-single",["Chwyt","Skośne brzucha"],["Czworoboczny","Przedramiona"])
};

export const exerciseImagePrecachePaths=Object.values(exerciseImageSpecs).map(spec=>spec.imagePath);

export type ExerciseImageView={kind:"image";spec:ExerciseImageSpec}|{kind:"fallback"};
export function resolveExerciseImage(exerciseId:string,failed=false):ExerciseImageView{
 const spec=exerciseImageSpecs[exerciseId];
 return !spec||failed?{kind:"fallback"}:{kind:"image",spec};
}
