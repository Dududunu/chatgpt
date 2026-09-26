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
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
