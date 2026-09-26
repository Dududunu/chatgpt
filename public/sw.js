const VERSION="gym-pwa-v6";
const APP_SHELL=["./","./index.html","./manifest.webmanifest","./icon.svg"];

self.addEventListener("install",event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(VERSION);
  await cache.addAll(APP_SHELL);
  try{
   const response=await fetch("./sw-assets.json",{cache:"no-store"});
   if(response.ok){const assets=await response.json();if(Array.isArray(assets)&&assets.every(asset=>typeof asset==="string"))await cache.addAll(assets)}
  }catch{}
  await self.skipWaiting();
 })());
});

self.addEventListener("activate",event=>{
 event.waitUntil(
  caches.keys()
   .then(keys=>Promise.all(keys.filter(key=>key!==VERSION).map(key=>caches.delete(key))))
   .then(()=>self.clients.claim())
 );
});

self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET") return;
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin) return;

 if(event.request.mode==="navigate"){
  event.respondWith(
   fetch(event.request)
    .then(response=>{
     const copy=response.clone();
     caches.open(VERSION).then(cache=>cache.put("./index.html",copy));
     return response;
    })
    .catch(()=>caches.match("./index.html"))
  );
  return;
 }

 event.respondWith(
  caches.match(event.request).then(cached=>{
   const network=fetch(event.request).then(response=>{
    if(response.ok){
     const copy=response.clone();
     caches.open(VERSION).then(cache=>cache.put(event.request,copy));
    }
    return response;
   }).catch(()=>cached);
   return cached||network;
  })
 );
});
