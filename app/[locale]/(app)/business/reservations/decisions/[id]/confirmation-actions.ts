"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ConfirmationAccessState = { status: "idle" | "success" | "error"; message: string; confirmationPath?: string };
export const initialConfirmationAccessState: ConfirmationAccessState = { status: "idle", message: "" };
const value=(data:FormData,name:string)=>{const item=data.get(name);return typeof item==="string"?item.trim():""};
const fail=(message:string):ConfirmationAccessState=>({status:"error",message});
async function authenticatedClient(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();return user?supabase:null}

export async function generateConfirmationLink(_:ConfirmationAccessState,data:FormData):Promise<ConfirmationAccessState>{
 const supabase=await authenticatedClient();if(!supabase)return fail("Authentication required.");
 const reservationId=value(data,"reservation_id");if(!reservationId)return fail("Reservation is required.");
 const {data:rows,error}=await supabase.rpc("generate_reservation_confirmation_token",{p_reservation_id:reservationId});
 if(error)return fail(error.message);const token=(rows as {token:string}[]|null)?.[0]?.token;if(!token)return fail("Confirmation token was not returned.");
 revalidatePath("/[locale]/business/reservations/decisions/[id]","page");
 return {status:"success",message:"Confirmation link generated. Copy it now; the raw token is not stored.",confirmationPath:`/reservation/confirmation/${token}`};
}

export async function revokeConfirmationLink(_:ConfirmationAccessState,data:FormData):Promise<ConfirmationAccessState>{
 const supabase=await authenticatedClient();if(!supabase)return fail("Authentication required.");
 const tokenId=value(data,"token_id"),reason=value(data,"reason");if(!tokenId||!reason)return fail("A token and revocation reason are required.");
 const {error}=await supabase.rpc("revoke_reservation_confirmation_token",{p_token_id:tokenId,p_reason:reason});if(error)return fail(error.message);
 revalidatePath("/[locale]/business/reservations/decisions/[id]","page");return {status:"success",message:"Confirmation link revoked."};
}
