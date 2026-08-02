"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type DecisionState={status:"idle"|"success"|"error";message:string};
export const initialDecisionState:DecisionState={status:"idle",message:""};
const value=(data:FormData,name:string)=>{const item=data.get(name);return typeof item==="string"?item.trim():""};
async function decide(kind:"accept"|"reject"|"pending",_:DecisionState,data:FormData):Promise<DecisionState>{
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser();
 if(!user)return {status:"error",message:"Authentication required."};
 const reservationId=value(data,"reservation_id"),reason=value(data,"reason"),notes=value(data,"internal_notes");
 if(!reservationId)return {status:"error",message:"Reservation is required."};
 if((kind==="reject"||kind==="pending")&&!reason)return {status:"error",message:"A reason is required."};
 if(reason.length>1000||notes.length>2000)return {status:"error",message:"Reason or notes are too long."};
 const call=kind==="accept"
  ? supabase.rpc("accept_reservation",{p_reservation_id:reservationId,p_internal_notes:notes||null})
  : kind==="reject"
   ? supabase.rpc("reject_reservation",{p_reservation_id:reservationId,p_rejection_reason:reason,p_internal_notes:notes||null})
   : supabase.rpc("return_reservation_to_pending",{p_reservation_id:reservationId,p_reason:reason});
 const {error}=await call; if(error)return {status:"error",message:error.message};
 revalidatePath("/[locale]/business/reservations/decisions","layout");
 revalidatePath("/[locale]/business/reservations/[id]","page");
 return {status:"success",message:kind==="accept"?"Reservation accepted.":kind==="reject"?"Reservation rejected.":"Reservation returned to pending review."};
}
export const acceptReservation=decide.bind(null,"accept");
export const rejectReservation=decide.bind(null,"reject");
export const returnReservationToPending=decide.bind(null,"pending");
