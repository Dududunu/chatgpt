export function validateDisplayName(value:string):string|null{
 const name=value.trim();
 if(!name)return "Wpisz imię.";
 if(name.length<2||name.length>30)return "Imię musi mieć od 2 do 30 znaków.";
 return null;
}

export function validatePasswordChange(current:string,next:string,repeat:string):string|null{
 if(!current)return "Wpisz obecne hasło.";
 if(next.length<8)return "Nowe hasło musi mieć co najmniej 8 znaków.";
 if(next!==repeat)return "Nowe hasła nie są takie same.";
 return null;
}

export function validateDeleteConfirmation(value:string):boolean{return value.trim()==="USUŃ";}
