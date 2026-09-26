export type AuthSyncStatus="syncing"|"synced"|"offline"|"error";

export function authErrorMessage(error:unknown):string{
 const message=error instanceof Error?error.message:String(error??"");
 const normalized=message.toLocaleLowerCase("en-US");
 if(normalized.includes("invalid login")||normalized.includes("invalid_credentials")||normalized.includes("invalid email or password"))return "Nieprawidłowy email lub hasło.";
 if(normalized.includes("email not confirmed"))return "Potwierdź adres email i spróbuj ponownie.";
 if(normalized.includes("already registered")||normalized.includes("user already exists"))return "Konto z tym adresem email już istnieje.";
 if(normalized.includes("password should be")||normalized.includes("weak password"))return "Hasło musi zawierać co najmniej 6 znaków.";
 if(normalized.includes("fetch")||normalized.includes("network")||normalized.includes("timeout"))return "Brak połączenia. Sprawdź internet i spróbuj ponownie.";
 return "Nie udało się wykonać tej czynności. Spróbuj ponownie za chwilę.";
}

export function syncStatusMessage(status:AuthSyncStatus):string{
 if(status==="synced")return "Zsynchronizowano";
 if(status==="syncing")return "Synchronizacja…";
 if(status==="offline")return "Offline · zmiany zapiszą się po odzyskaniu internetu.";
 return "Nie udało się zsynchronizować. Spróbuj ponownie.";
}

export async function signOutWithSync(
 isOnline:boolean,
 syncBeforeSignOut:()=>Promise<unknown>,
 signOut:()=>Promise<unknown>
):Promise<void>{
 if(isOnline){try{await syncBeforeSignOut()}catch{}}
 await signOut();
}
