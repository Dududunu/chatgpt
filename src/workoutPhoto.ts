import { scaledPhotoDimensions, validateWorkoutPhotoInput } from "./workoutReview";

const JPEG_QUALITY=0.82;

function loadImageElement(file:Blob):Promise<HTMLImageElement>{
 return new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(file);
  const image=new Image();
  image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};
  image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Przeglądarka nie może otworzyć tego zdjęcia."))};
  image.src=url;
 });
}

async function decodeImage(file:Blob):Promise<ImageBitmap|HTMLImageElement>{
 if(typeof createImageBitmap==="function"){
  try{return await createImageBitmap(file,{imageOrientation:"from-image"})}
  catch{/* Try the regular browser image decoder below. */}
 }
 return loadImageElement(file);
}

function canvasBlob(canvas:HTMLCanvasElement,type:"image/webp"|"image/jpeg"):Promise<Blob|null>{
 return new Promise(resolve=>canvas.toBlob(resolve,type,JPEG_QUALITY));
}

/** Decode and redraw the selected image: this applies orientation and strips EXIF/GPS metadata. */
export async function compressWorkoutPhoto(file:File):Promise<Blob>{
 const input=await validateWorkoutPhotoInput(file);
 if(!input.ok)throw new Error(input.error);
 const image=await decodeImage(file);
 try{
  const width=image instanceof HTMLImageElement?image.naturalWidth:image.width;
  const height=image instanceof HTMLImageElement?image.naturalHeight:image.height;
  const dimensions=scaledPhotoDimensions(width,height,1600);
  const canvas=document.createElement("canvas");
  canvas.width=dimensions.width;
  canvas.height=dimensions.height;
  const context=canvas.getContext("2d");
  if(!context)throw new Error("Nie udało się przygotować zdjęcia.");
  context.drawImage(image,0,0,dimensions.width,dimensions.height);
  const webp=await canvasBlob(canvas,"image/webp");
  if(webp?.type==="image/webp")return webp;
  const jpeg=await canvasBlob(canvas,"image/jpeg");
  if(jpeg?.type==="image/jpeg")return jpeg;
  throw new Error("Nie udało się skompresować zdjęcia.");
 }finally{
  if("close" in image&&typeof image.close==="function")image.close();
 }
}
