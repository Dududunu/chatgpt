export type UpdateNotice={message:string;canReload:boolean};

export function getUpdateNotice(hasActiveWorkout:boolean):UpdateNotice{
 return hasActiveWorkout
  ?{message:"Nowa wersja będzie gotowa po treningu.",canReload:false}
  :{message:"Dostępna jest nowa wersja.",canReload:true};
}

export function canActivateUpdate(hasActiveWorkout:boolean):boolean{
 return !hasActiveWorkout;
}

export function shouldReloadAfterControllerChange(activationRequested:boolean):boolean{
 return activationRequested;
}
