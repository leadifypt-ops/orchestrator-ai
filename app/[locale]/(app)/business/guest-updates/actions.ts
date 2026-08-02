"use server";

import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";

export type GuestUpdateActionState={status:"idle"|"success"|"error";message:string};
export const initialGuestUpdateState:GuestUpdateActionState={status:"idle",message:""};
const value=(data:FormData,name:string)=>{const item=data.get(name);return typeof item==="string"?item.trim():""};
export async function reviewGuestUpdate(_:GuestUpdateActionState,data:FormData):Promise<GuestUpdateActionState>{
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 if(!user)return {status:"error",message:"Authentication required."};
 const submissionId=value(data,"submission_id"),action=value(data,"review_action"),reason=value(data,"reason");
 if(!submissionId)return {status:"error",message:"Guest update is required."};
 if(action==="dismissed"&&!reason)return {status:"error",message:"A dismissal reason is required."};
 if(reason.length>2000)return {status:"error",message:"Review note is too long."};
 const {error}=await supabase.rpc("review_guest_submission",{p_submission_id:submissionId,p_action:action,p_reason:reason||null});
 if(error)return {status:"error",message:error.message};
 revalidatePath("/[locale]/business/guest-updates","layout");
 revalidatePath("/[locale]/business/reservations/decisions/[id]","page");
 revalidatePath("/[locale]/business/reservations/communications","page");
 return {status:"success",message:action==="converted_to_communication_task"?"Guest update converted to a communication draft. Nothing was sent.":"Guest update review recorded."};
}
