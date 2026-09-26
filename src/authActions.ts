import { validateDeleteConfirmation,validateDisplayName } from "./accountLogic";

type AuthResult<T>={data:T;error:unknown|null};
type SignupInput={email:string;password:string;options:{emailRedirectTo:string;data:{display_name:string}}};

export async function signupWithDisplayName(name:string,email:string,password:string,redirectTo:string,signUp:(input:SignupInput)=>Promise<AuthResult<{session:unknown|null}>>){
 const error=validateDisplayName(name);if(error)throw new Error(error);
 if(password.length<8)throw new Error("Hasło musi zawierać co najmniej 8 znaków.");
 const response=await signUp({email:email.trim(),password,options:{emailRedirectTo:redirectTo,data:{display_name:name.trim()}}});
 if(response.error)throw response.error;
 return Boolean(response.data.session);
}

export async function loginWithPassword(email:string,password:string,signIn:(input:{email:string;password:string})=>Promise<AuthResult<unknown>>){
 const response=await signIn({email:email.trim(),password});if(response.error)throw response.error;
}

export async function requestPasswordReset(email:string,redirectTo:string,request:(email:string,options:{redirectTo:string})=>Promise<{error:unknown|null}>){
 if(!email.trim())throw new Error("Wpisz adres email.");
 const response=await request(email.trim(),{redirectTo});if(response.error)throw response.error;
}

export async function updatePassword(password:string,update:(input:{password:string})=>Promise<{error:unknown|null}>){
 if(password.length<8)throw new Error("Hasło musi zawierać co najmniej 8 znaków.");
 const response=await update({password});if(response.error)throw response.error;
}

export async function changePassword(email:string,currentPassword:string,newPassword:string,signIn:(input:{email:string;password:string})=>Promise<AuthResult<unknown>>,update:(input:{password:string})=>Promise<{error:unknown|null}>){
 const reauth=await signIn({email:email.trim(),password:currentPassword});if(reauth.error)throw reauth.error;
 await updatePassword(newPassword,update);
}

export async function deleteAccountFlow(confirmation:string,deleteRemote:(confirmation:"USUŃ")=>Promise<void>,clearLocal:()=>Promise<void>,signOut:()=>Promise<void>){
 if(!validateDeleteConfirmation(confirmation))throw new Error("Wpisz USUŃ, aby potwierdzić.");
 await deleteRemote("USUŃ");
 await clearLocal();
 await signOut();
}
