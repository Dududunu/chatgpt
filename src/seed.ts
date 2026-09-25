import type { WorkoutTemplate } from "./types";

export const defaultTemplates:WorkoutTemplate[]=[
 {id:"upper-1",name:"UPPER 1",exercises:[
  {id:"incline-db",name:"Wyciskanie hantli na ławce skośnej",sets:4,repMin:6,repMax:8,rir:"2",tempo:"2110",restSec:180},
  {id:"seal-row-db",name:"Focze wiosło hantlami",sets:3,repMin:8,repMax:10,rir:"1",tempo:"2110",restSec:150},
  {id:"chinup",name:"Podciąganie podchwytem",sets:3,repMin:6,repMax:8,rir:"2",tempo:"2110",restSec:180},
  {id:"cable-lateral",name:"Wznosy w bok na wyciągu",sets:4,repMin:8,repMax:10,rir:"1",tempo:"2110",restSec:120},
  {id:"hammer-rope",name:"Uginanie młotkowe z warkoczem (wyciąg)",sets:2,repMin:8,repMax:10,rir:"1",tempo:"2110",restSec:120,superset:"arms-a"},
  {id:"rope-pushdown",name:"Prostowanie ramion z warkoczem (wyciąg)",sets:2,repMin:8,repMax:10,rir:"1",tempo:"2110",restSec:120,superset:"arms-a"}
 ]},
 {id:"lower-1",name:"LOWER 1",exercises:[
  {id:"back-squat",name:"Przysiad ze sztangą (back squat)",sets:4,repMin:5,repMax:7,rir:"2",tempo:"2110",restSec:180},
  {id:"walking-lunge",name:"Wykroki chodzone z hantlami",sets:3,repMin:10,repMax:12,rir:"2",tempo:"2110",restSec:180,perLeg:true},
  {id:"hip-thrust",name:"Hip thrust ze sztangą",sets:3,repMin:8,repMax:10,rir:"1",tempo:"2111",restSec:150},
  {id:"standing-calf",name:"Wspięcia na palce stojąc",sets:4,repMin:10,repMax:12,rir:"1",tempo:"2111",restSec:120,perLeg:true},
  {id:"leg-curl",name:"Uginanie kolan na maszynie",sets:3,repMin:10,repMax:12,rir:"1",tempo:"3110",restSec:120},
  {id:"cable-crunch",name:"Allahy na wyciągu",sets:3,repMin:10,repMax:12,rir:"1",tempo:"2110",restSec:120}
 ]},
 {id:"upper-2",name:"UPPER 2",exercises:[
  {id:"ohp",name:"OHP ze sztangą",sets:4,repMin:6,repMax:8,rir:"2",tempo:"2111",restSec:180},
  {id:"bench",name:"Wyciskanie sztangi na ławce płaskiej",sets:4,repMin:8,repMax:10,rir:"2",tempo:"2110",restSec:210},
  {id:"single-pulldown",name:"Ściąganie jednorącz z wyciągu górnego",sets:3,repMin:8,repMax:10,rir:"1",tempo:"2110",restSec:120},
  {id:"pec-deck",name:"Rozpiętki na maszynie Butterfly",sets:3,repMin:10,repMax:12,rir:"1",tempo:"2110",restSec:120,superset:"fly"},
  {id:"reverse-pec-deck",name:"Odwrotne rozpiętki na maszynie Butterfly",sets:3,repMin:12,repMax:14,rir:"1",tempo:"2110",restSec:120,superset:"fly"},
  {id:"incline-curl",name:"Uginanie ramion z hantlami leżąc na ławce skośnej",sets:3,repMin:8,repMax:10,rir:"1",tempo:"2110",restSec:120,superset:"arms-b"},
  {id:"db-french",name:"Wyciskanie francuskie z hantlami leżąc",sets:3,repMin:8,repMax:10,rir:"1",tempo:"2110",restSec:120,superset:"arms-b"}
 ]},
 {id:"lower-2",name:"LOWER 2",exercises:[
  {id:"rdl",name:"Rumuński martwy ciąg ze sztangą (RDL)",sets:4,repMin:6,repMax:8,rir:"2",tempo:"2110",restSec:180},
  {id:"leg-press",name:"Leg press",sets:4,repMin:10,repMax:12,rir:"2",tempo:"2110",restSec:180},
  {id:"back-extension",name:"Wyprosty tułowia na ławce rzymskiej",sets:3,repMin:8,repMax:10,rir:"1",tempo:"2110",restSec:120},
  {id:"seated-calf",name:"Wspięcia na palce siedząc",sets:4,repMin:12,repMax:15,rir:"1",tempo:"2111",restSec:120},
  {id:"leg-extension-uni",name:"Wyprosty nóg na maszynie jednonóż",sets:3,repMin:8,repMax:10,rir:"1-2",tempo:"2110",restSec:120,perLeg:true},
  {id:"farmer-single",name:"Spacer farmera jednorącz",sets:4,repMin:0,repMax:0,rir:"0",tempo:"X",restSec:120,timed:true}
 ]}
];

export const exerciseSubstitutions=[
 "Wznosy w bok na wyciągu → hantle lub guma",
 "Uginanie młotkowe z warkoczem → hantle",
 "Prostowanie ramion z warkoczem → wyciskanie francuskie z hantlami",
 "Rozpiętki Butterfly → hantle na ławce lub wyciąg",
 "Odwrotne rozpiętki Butterfly → hantle na ławce lub wyciąg",
 "Leg press → przysiad ze sztangą, goblet squat lub wykroki"
];
