import type { ReactNode, SVGProps } from "react";

export type AppIconName = "train" | "plan" | "history" | "progress" | "more";

const paths: Record<AppIconName, ReactNode> = {
 train: <><path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12"/><path d="m9 9 3-3 3 3M9 15l3 3 3-3"/></>,
 plan: <><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></>,
 history: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
 progress: <><path d="M4 19V5M4 19h17"/><path d="m7 15 4-4 3 2 6-7"/></>,
 more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>
};

export function AppIcon({name,...props}:SVGProps<SVGSVGElement>&{name:AppIconName}){
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}

export function BrandMark({className=""}:{className?:string}){
 return <svg className={`brand-mark ${className}`} viewBox="0 0 48 48" fill="none" aria-hidden="true">
  <path d="M33.8 13.3A15 15 0 1 0 38 24H25" stroke="currentColor" strokeWidth="4.2" strokeLinecap="square" strokeLinejoin="miter"/>
 </svg>;
}

export function BrandLockup({compact=false}:{compact?:boolean}){
 return <span className={`brand-lockup${compact?" brand-lockup-compact":""}`}><span className="brand-symbol"><BrandMark/></span><span className="brand-word">GYM</span></span>;
}

export function StarIcon({filled=false}:{filled?:boolean}){
 return <svg className={`star-icon${filled?" filled":""}`} viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.8 2.45 5 5.52.8-3.99 3.9.94 5.5L12 16.4l-4.92 2.6.94-5.5-3.99-3.9 5.52-.8L12 3.8Z"/></svg>;
}

export function RatingStars({rating}:{rating:number}){
 const bounded=Math.max(0,Math.min(5,Math.round(rating)));
 return <span className="rating-stars" aria-label={`${bounded} z 5 gwiazdek`}>{Array.from({length:5},(_,index)=><StarIcon key={index} filled={index<bounded}/>)}</span>;
}
