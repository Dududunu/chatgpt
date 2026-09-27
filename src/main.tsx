import React from "react";
import ReactDOM from "react-dom/client";
import AuthShell from "./AuthShell";
import "./styles.css";
import { ensureSeed } from "./db";

ensureSeed().then(()=>{
 ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><AuthShell/></React.StrictMode>);
 if("serviceWorker" in navigator)void registerServiceWorker();
});

async function registerServiceWorker(){
 try{
  const registration=await navigator.serviceWorker.register("./sw.js");
  const announce=()=>window.dispatchEvent(new Event("gym-pwa-update-available"));
  if(registration.waiting&&navigator.serviceWorker.controller)announce();
  registration.addEventListener("updatefound",()=>{
   const installing=registration.installing;if(!installing)return;
   installing.addEventListener("statechange",()=>{
    if(installing.state==="installed"&&navigator.serviceWorker.controller)announce();
   });
  });
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")void registration.update().catch(()=>{})});
 }catch{}
}
