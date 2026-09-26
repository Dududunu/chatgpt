import React from "react";
import ReactDOM from "react-dom/client";
import AuthShell from "./AuthShell";
import "./styles.css";
import { ensureSeed } from "./db";

ensureSeed().then(()=>{
 ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><AuthShell/></React.StrictMode>);
 if("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(()=>{});
});
