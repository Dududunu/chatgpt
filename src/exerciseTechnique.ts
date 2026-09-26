const techniques:Record<string,string[]>={
 "incline-db":["Ustaw ławkę pod niewielkim kątem.","Prowadź hantle nad górną część klatki.","Opuść je kontrolowanie do wysokości barków."],
 "seal-row-db":["Oprzyj klatkę na ławce i utrzymaj neutralny kark.","Prowadź łokcie w stronę bioder.","Opuść hantle bez bujania tułowiem."],
 chinup:["Zacznij ze zwisu i aktywnymi barkami.","Podciągnij klatkę w stronę drążka.","Opuść się spokojnie do wyprostu ramion."],
 "cable-lateral":["Utrzymaj lekko ugięty łokieć.","Unieś ramię do wysokości barku.","Nie przechylaj tułowia."],
 "hammer-rope":["Trzymaj łokcie blisko tułowia.","Zegnij łokcie bez obracania nadgarstków.","Opuść uchwyt powoli."],
 "rope-pushdown":["Ustaw łokcie przy bokach.","Wyprostuj przedramiona w dół.","Wróć do kąta prostego bez ruchu barków."],
 "back-squat":["Utrzymuj cały czas stabilne stopy.","Zejdź w dół, prowadząc kolana nad stopami.","Wstań bez zapadania kolan do środka."],
 "walking-lunge":["Zrób kontrolowany krok do przodu.","Opuść tylne kolano w stronę podłoża.","Odepchnij się przednią stopą i zmień nogę."],
 "hip-thrust":["Oprzyj łopatki o krawędź ławki.","Unieś biodra do linii tułowia.","Zatrzymaj ruch bez przeprostu pleców."],
 "standing-calf":["Opuść pięty do wygodnego rozciągnięcia.","Wspnij się wysoko na palce.","Nie odbijaj się w dolnej fazie."],
 "leg-curl":["Ustaw oś kolana zgodnie z osią maszyny.","Przyciągnij pięty w stronę pośladków.","Wróć powoli, utrzymując biodra na podparciu."],
 "cable-crunch":["Ustaw biodra nieruchomo.","Zwiń żebra w kierunku miednicy.","Wróć do wyprostu bez ciągnięcia rękami."],
 ohp:["Zacznij ze sztangą na wysokości górnej klatki.","Wyciskaj nad głowę blisko twarzy.","Zablokuj pozycję bez odchylania lędźwi."],
 bench:["Utrzymuj stopy na podłożu i łopatki stabilnie.","Opuść sztangę do dolnej części klatki.","Wyciskaj w górę bez odbijania od klatki."],
 "single-pulldown":["Ustaw tułów stabilnie i bark w dole.","Prowadź łokieć w stronę biodra.","Pozwól ramieniu wrócić do góry pod kontrolą."],
 "pec-deck":["Ustaw uchwyty na wysokości klatki.","Złącz ramiona przed sobą bez uderzania uchwytami.","Wróć do komfortowego rozciągnięcia."],
 "reverse-pec-deck":["Ustaw klatkę stabilnie przy oparciu.","Prowadź ramiona na boki z miękkimi łokciami.","Wróć bez szarpania ciężarem."],
 "incline-curl":["Oprzyj plecy o ławkę i opuść ramiona.","Zegnij łokcie bez wysuwania barków.","Opuść hantle do pełnego, wygodnego wyprostu."],
 "db-french":["Utrzymuj ramiona skierowane nad barki.","Zegnij łokcie, opuszczając hantle obok głowy.","Wyprostuj łokcie bez ruchu ramion."],
 rdl:["Cofnij biodra przy lekko ugiętych kolanach.","Prowadź sztangę blisko nóg.","Wróć, prostując biodra bez zaokrąglania pleców."],
 "leg-press":["Ustaw stopy stabilnie na platformie.","Opuść platformę do wygodnej głębokości.","Wypchnij ją bez blokowania kolan."],
 "back-extension":["Ustaw podparcie poniżej bioder.","Unieś tułów do prostej linii z nogami.","Nie unoś się wysoko ponad linię ciała."],
 "seated-calf":["Opuść pięty pod platformę.","Unieś pięty wysoko, nie odrywając przodostopia.","Wróć powoli do rozciągnięcia."],
 "leg-extension-uni":["Ustaw oś kolana zgodnie z osią maszyny.","Wyprostuj jedną nogę bez zamachu.","Opuść ciężar pod kontrolą i zmień stronę."],
 "farmer-single":["Trzymaj ciężar przy boku.","Idź krótkimi, równymi krokami.","Utrzymuj tułów pionowo i zmień rękę."]
};

export function getExerciseTechnique(id:string):readonly string[]|null{return techniques[id]??null}
