import type { ReactNode } from "react";

type Scene="standing"|"bench"|"bent"|"hang"|"seated"|"hip"|"prone"|"floor"|"lunge"|"carry";
type Motion="press"|"row"|"pull"|"raise"|"curl"|"pushdown"|"squat"|"step"|"thrust"|"calf"|"knee"|"crunch"|"fly"|"hinge"|"back-extension"|"carry";
type ExerciseMotionSpec={scene:Scene;motion:Motion;technique:string[]};

// Original line drawings and short movement loops. No third-party media is embedded.
export const exerciseMotionSpecs:Record<string,ExerciseMotionSpec>={
 "incline-db":{scene:"bench",motion:"press",technique:["Ustaw ławkę pod niewielkim kątem.","Prowadź hantle nad górną część klatki.","Opuść je kontrolowanie do wysokości barków."]},
 "seal-row-db":{scene:"bent",motion:"row",technique:["Oprzyj klatkę na ławce i utrzymaj neutralny kark.","Prowadź łokcie w stronę bioder.","Opuść hantle bez bujania tułowiem."]},
 chinup:{scene:"hang",motion:"pull",technique:["Zacznij ze zwisu i aktywnymi barkami.","Podciągnij klatkę w stronę drążka.","Opuść się spokojnie do wyprostu ramion."]},
 "cable-lateral":{scene:"standing",motion:"raise",technique:["Utrzymaj lekko ugięty łokieć.","Unieś ramię do wysokości barku.","Nie przechylaj tułowia."]},
 "hammer-rope":{scene:"standing",motion:"curl",technique:["Trzymaj łokcie blisko tułowia.","Zegnij łokcie bez obracania nadgarstków.","Opuść uchwyt powoli."]},
 "rope-pushdown":{scene:"standing",motion:"pushdown",technique:["Ustaw łokcie przy bokach.","Wyprostuj przedramiona w dół.","Wróć do kąta prostego bez ruchu barków."]},
 "back-squat":{scene:"standing",motion:"squat",technique:["Utrzymuj cały czas stabilne stopy.","Zejdź w dół, prowadząc kolana nad stopami.","Wstań bez zapadania kolan do środka."]},
 "walking-lunge":{scene:"lunge",motion:"step",technique:["Zrób kontrolowany krok do przodu.","Opuść tylne kolano w stronę podłoża.","Odepchnij się przednią stopą i zmień nogę."]},
 "hip-thrust":{scene:"hip",motion:"thrust",technique:["Oprzyj łopatki o krawędź ławki.","Unieś biodra do linii tułowia.","Zatrzymaj ruch bez przeprostu pleców."]},
 "standing-calf":{scene:"standing",motion:"calf",technique:["Opuść pięty do wygodnego rozciągnięcia.","Wspnij się wysoko na palce.","Nie odbijaj się w dolnej fazie."]},
 "leg-curl":{scene:"prone",motion:"knee",technique:["Ustaw oś kolana zgodnie z osią maszyny.","Przyciągnij pięty w stronę pośladków.","Wróć powoli, utrzymując biodra na podparciu."]},
 "cable-crunch":{scene:"floor",motion:"crunch",technique:["Ustaw biodra nieruchomo.","Zwiń żebra w kierunku miednicy.","Wróć do wyprostu bez ciągnięcia rękami."]},
 ohp:{scene:"standing",motion:"press",technique:["Zacznij ze sztangą na wysokości górnej klatki.","Wyciskaj nad głowę blisko twarzy.","Zablokuj pozycję bez odchylania lędźwi."]},
 bench:{scene:"bench",motion:"press",technique:["Utrzymuj stopy na podłożu i łopatki stabilnie.","Opuść sztangę do dolnej części klatki.","Wyciskaj w górę bez odbijania od klatki."]},
 "single-pulldown":{scene:"seated",motion:"pull",technique:["Ustaw tułów stabilnie i bark w dole.","Prowadź łokieć w stronę biodra.","Pozwól ramieniu wrócić do góry pod kontrolą."]},
 "pec-deck":{scene:"seated",motion:"fly",technique:["Ustaw uchwyty na wysokości klatki.","Złącz ramiona przed sobą bez uderzania uchwytami.","Wróć do komfortowego rozciągnięcia."]},
 "reverse-pec-deck":{scene:"seated",motion:"fly",technique:["Ustaw klatkę stabilnie przy oparciu.","Prowadź ramiona na boki z miękkimi łokciami.","Wróć bez szarpania ciężarem."]},
 "incline-curl":{scene:"bench",motion:"curl",technique:["Oprzyj plecy o ławkę i opuść ramiona.","Zegnij łokcie bez wysuwania barków.","Opuść hantle do pełnego, wygodnego wyprostu."]},
 "db-french":{scene:"bench",motion:"pushdown",technique:["Utrzymuj ramiona skierowane nad barki.","Zegnij łokcie, opuszczając hantle obok głowy.","Wyprostuj łokcie bez ruchu ramion."]},
 rdl:{scene:"bent",motion:"hinge",technique:["Cofnij biodra przy lekko ugiętych kolanach.","Prowadź sztangę blisko nóg.","Wróć, prostując biodra bez zaokrąglania pleców."]},
 "leg-press":{scene:"seated",motion:"knee",technique:["Ustaw stopy stabilnie na platformie.","Opuść platformę do wygodnej głębokości.","Wypchnij ją bez blokowania kolan."]},
 "back-extension":{scene:"hip",motion:"back-extension",technique:["Ustaw podparcie poniżej bioder.","Unieś tułów do prostej linii z nogami.","Nie unoś się wysoko ponad linię ciała."]},
 "seated-calf":{scene:"seated",motion:"calf",technique:["Opuść pięty pod platformę.","Unieś pięty wysoko, nie odrywając przodostopia.","Wróć powoli do rozciągnięcia."]},
 "leg-extension-uni":{scene:"seated",motion:"knee",technique:["Ustaw oś kolana zgodnie z osią maszyny.","Wyprostuj jedną nogę bez zamachu.","Opuść ciężar pod kontrolą i zmień stronę."]},
 "farmer-single":{scene:"carry",motion:"carry",technique:["Trzymaj ciężar przy boku.","Idź krótkimi, równymi krokami.","Utrzymuj tułów pionowo i zmień rękę."]}
};

export function getExerciseMotionSpec(id:string):ExerciseMotionSpec|null{
 return exerciseMotionSpecs[id]??null;
}

function Figure({scene,motion}:{scene:Scene;motion:Motion}){
 const isHorizontal=scene==="bench"||scene==="prone"||scene==="floor";
 const isSeated=scene==="seated";
 const isHanging=scene==="hang";
 const isHinged=scene==="bent";
 let body:ReactNode;

 if(isHorizontal){
  body=<>
   <circle className="head" cx="248" cy="119" r="13"/>
   <path className="bodyline" d="M231 131 L147 145 L112 151"/>
   <path className="limb" d="M151 144 L117 119 L83 120"/>
   <path className="limb" d="M147 145 L119 168 L83 168"/>
   <path className="limb arm arm-a" d="M210 134 L201 111 L185 101"/>
   <path className="limb arm arm-b" d="M218 132 L221 109 L214 98"/>
  </>;
 }else if(isHanging){
  body=<>
   <circle className="head" cx="175" cy="78" r="13"/>
   <path className="bodyline" d="M175 92 L175 151"/>
   <path className="limb arm arm-a" d="M170 102 L143 77 L128 51"/>
   <path className="limb arm arm-b" d="M180 102 L207 77 L222 51"/>
   <path className="limb" d="M175 151 L157 181 L148 211"/>
   <path className="limb" d="M175 151 L194 181 L203 211"/>
  </>;
 }else if(isSeated){
  body=<>
   <circle className="head" cx="171" cy="60" r="13"/>
   <path className="bodyline" d="M171 74 L171 130 L209 142"/>
   <path className="limb arm arm-a" d="M171 86 L142 105 L129 127"/>
   <path className="limb arm arm-b" d="M174 86 L202 105 L215 127"/>
   <path className="limb leg leg-a" d="M209 142 L232 164 L246 193"/>
   <path className="limb leg leg-b" d="M209 142 L196 168 L196 196"/>
  </>;
 }else if(scene==="hip"&&motion==="thrust"){
  body=<>
   <circle className="head" cx="99" cy="132" r="13"/>
   <path className="bodyline" d="M112 138 L157 151 L196 156"/>
   <path className="limb arm arm-a" d="M128 143 L148 165 L167 170"/>
   <path className="limb arm arm-b" d="M132 143 L150 158 L169 163"/>
   <path className="limb leg leg-a" d="M196 156 L229 173 L247 201"/>
   <path className="limb leg leg-b" d="M196 156 L222 167 L235 198"/>
  </>;
 }else if(scene==="hip"&&motion==="back-extension"){
  body=<>
   <circle className="head" cx="253" cy="121" r="13"/>
   <path className="bodyline" d="M237 129 L175 145 L135 153"/>
   <path className="limb arm arm-a" d="M201 139 L185 161 L168 168"/>
   <path className="limb arm arm-b" d="M207 138 L196 158 L179 166"/>
   <path className="limb" d="M135 153 L106 174 L84 198"/>
   <path className="limb" d="M135 153 L117 177 L101 201"/>
  </>;
 }else if(isHinged){
  body=<>
   <circle className="head" cx="223" cy="69" r="13"/>
   <path className="bodyline" d="M210 81 L174 116 L142 148"/>
   <path className="limb arm arm-a" d="M193 96 L176 127 L165 155"/>
   <path className="limb arm arm-b" d="M201 91 L195 124 L188 151"/>
   <path className="limb" d="M142 148 L132 178 L111 201"/>
   <path className="limb" d="M142 148 L167 176 L184 202"/>
  </>;
 }else if(scene==="lunge"){
  body=<>
   <circle className="head" cx="172" cy="59" r="13"/>
   <path className="bodyline" d="M172 73 L172 133"/>
   <path className="limb arm arm-a" d="M172 84 L143 108 L141 132"/>
   <path className="limb arm arm-b" d="M172 84 L202 108 L203 132"/>
   <path className="limb leg leg-a" d="M172 133 L208 159 L224 196"/>
   <path className="limb leg leg-b" d="M172 133 L142 164 L122 195"/>
  </>;
 }else if(scene==="carry"){
  body=<>
   <circle className="head" cx="172" cy="58" r="13"/>
   <path className="bodyline" d="M172 72 L172 134"/>
   <path className="limb arm arm-a" d="M172 83 L141 111 L139 143"/>
   <path className="limb arm arm-b" d="M172 83 L203 108 L211 134"/>
   <path className="limb leg leg-a" d="M172 134 L153 170 L142 203"/>
   <path className="limb leg leg-b" d="M172 134 L194 169 L208 201"/>
  </>;
 }else{
  body=<>
   <circle className="head" cx="171" cy="58" r="13"/>
   <path className="bodyline" d="M171 72 L171 136"/>
   <path className="limb arm arm-a" d="M171 84 L141 108 L130 136"/>
   <path className="limb arm arm-b" d="M171 84 L201 108 L212 136"/>
   <path className="limb leg leg-a" d="M171 136 L151 170 L143 203"/>
   <path className="limb leg leg-b" d="M171 136 L191 170 L199 203"/>
  </>;
 }

 return <g className={`figure scene-${scene} motion-${motion}`}>{body}</g>;
}

function Equipment({scene,motion}:{scene:Scene;motion:Motion}){
 return <g className={`equipment equipment-${scene} prop-${motion}`}>
  {(scene==="bench"||scene==="hip")&&<path className="machine" d="M95 170 H269 M124 170 L110 193 M249 170 L262 193"/>}
  {scene==="prone"&&<path className="machine" d="M72 177 H258 M89 177 L79 198 M242 177 L252 198"/>}
  {scene==="seated"&&<path className="machine" d="M192 142 V183 H226 M190 183 H240 M218 145 L245 145"/>}
  {scene==="hang"&&<path className="machine" d="M104 45 H246 M111 45 V56 M239 45 V56"/>}
  {scene==="floor"&&<path className="machine" d="M72 190 H278"/>}
  {(scene==="standing"||scene==="lunge"||scene==="carry")&&<path className="machine" d="M115 207 H231"/>}
  {motion==="press"&&<g className="moving-object"><path className="implement" d="M119 104 H229 M130 95 V113 M218 95 V113"/></g>}
  {motion==="row"&&<g className="moving-object"><path className="implement" d="M158 145 H222 M165 137 V153 M215 137 V153"/></g>}
  {motion==="pull"&&<path className="implement" d="M123 49 H227 M175 49 V70"/>}
  {motion==="raise"&&<g className="moving-object"><path className="implement" d="M131 133 L106 120 M212 133 L237 120"/></g>}
  {motion==="curl"&&<g className="moving-object"><circle className="implement" cx="125" cy="138" r="6"/><circle className="implement" cx="217" cy="138" r="6"/></g>}
  {motion==="pushdown"&&<path className="machine" d="M229 67 V143 M219 143 H239 M229 67 H247"/>}
  {motion==="squat"&&<g className="moving-object"><path className="implement" d="M121 91 H221 M132 83 V99 M210 83 V99"/></g>}
  {motion==="step"&&<path className="machine" d="M222 194 H264 V205 H222"/>}
  {motion==="thrust"&&<g className="moving-object"><path className="implement" d="M132 143 H206 M140 137 V149 M198 137 V149"/></g>}
  {motion==="calf"&&<path className="motion-mark" d="M272 139 V115 M266 121 L272 114 L278 121"/>}
  {motion==="knee"&&<path className="machine" d="M239 142 V189 M239 189 L259 189"/>}
  {motion==="crunch"&&<path className="motion-mark" d="M113 131 C96 120 95 106 107 96"/>}
  {motion==="fly"&&<g className="moving-object"><path className="implement" d="M129 104 L146 108 M214 104 L197 108"/></g>}
  {motion==="hinge"&&<g className="moving-object"><path className="implement" d="M114 150 H207 M122 143 V157 M199 143 V157"/></g>}
  {motion==="back-extension"&&<path className="machine" d="M104 159 H187 M118 159 V186 M177 159 V186"/>}
  {motion==="carry"&&<g className="moving-object"><rect className="implement" x="121" y="143" width="15" height="23" rx="3"/></g>}
  <path className="motion-arrow" d="M284 165 C300 142 300 113 284 91"/>
 </g>;
}

export function ExerciseMotion({exerciseId}:{exerciseId:string}){
 const spec=getExerciseMotionSpec(exerciseId);
 if(!spec) return <div className="mediaFallback" role="img" aria-label="Brak podglądu ruchu">BRAK PODGLĄDU RUCHU</div>;
 return <div className="exerciseMedia">
  <svg className="exerciseIllustration" data-motion={spec.motion} viewBox="0 0 340 230" role="img" aria-label={`Animowany schemat ruchu: ${exerciseId}`}>
   <rect className="mediaBackground" width="340" height="230" rx="8"/>
   <path className="floorLine" d="M34 208 H306"/>
   <Equipment scene={spec.scene} motion={spec.motion}/>
   <Figure scene={spec.scene} motion={spec.motion}/>
  </svg>
  <details className="technique"><summary>Technika</summary><ul>{spec.technique.map(point=><li key={point}>{point}</li>)}</ul></details>
 </div>;
}
