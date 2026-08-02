"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

export type BriefingActionState={status:"idle"|"success"|"error";message:string};
const value=(data:FormData,name:string)=>{const item=data.get(name);return typeof item==="string"?item.trim():""};
async function authed(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();return user?supabase:null;}
export async function createBriefing(data:FormData){
 const supabase=await authed();if(!supabase)throw new Error("Authentication required.");
 const restaurantId=value(data,"restaurant_id"),serviceDate=value(data,"service_date"),servicePeriodId=value(data,"service_period_id")||null,locale=value(data,"locale")||"pt";
 if(!restaurantId||!serviceDate)throw new Error("Restaurant and service date are required.");
 const {data:id,error}=await supabase.rpc("create_pre_service_briefing",{p_restaurant_id:restaurantId,p_service_date:serviceDate,p_service_period_id:servicePeriodId});
 if(error)throw new Error(error.message);
 revalidatePath("/[locale]/business/briefings","layout");
 redirect(`/${locale}/business/briefings/${id}`);
}
export async function prepareBriefing(_:BriefingActionState,data:FormData):Promise<BriefingActionState>{
 const supabase=await authed();if(!supabase)return {status:"error",message:"Authentication required."};
 const id=value(data,"briefing_id");if(!id)return {status:"error",message:"Briefing is required."};
 const {error}=await supabase.rpc("prepare_pre_service_briefing",{p_briefing_id:id});
 if(error)return {status:"error",message:error.message};
 revalidatePath("/[locale]/business/briefings","layout");return {status:"success",message:"Briefing prepared from the current approved operational context."};
}
export async function addBriefingNote(_:BriefingActionState,data:FormData):Promise<BriefingActionState>{
 const supabase=await authed();if(!supabase)return {status:"error",message:"Authentication required."};
 const id=value(data,"briefing_id"),note=value(data,"note"),reservationId=value(data,"reservation_id")||null;
 if(!id||!note)return {status:"error",message:"Briefing and note are required."};
 const {error}=await supabase.rpc("add_pre_service_briefing_note",{p_briefing_id:id,p_note:note,p_reservation_id:reservationId});
 if(error)return {status:"error",message:error.message};
 revalidatePath("/[locale]/business/briefings","layout");return {status:"success",message:"Briefing note appended."};
}
export async function reviewBriefingItem(_:BriefingActionState,data:FormData):Promise<BriefingActionState>{
 const supabase=await authed();if(!supabase)return {status:"error",message:"Authentication required."};
 const id=value(data,"briefing_id"),itemType=value(data,"item_type"),itemKey=value(data,"item_key"),reservationId=value(data,"reservation_id")||null,reviewNote=value(data,"review_note")||null;
 if(!id||!itemType||!itemKey)return {status:"error",message:"Briefing item is required."};
 const {error}=await supabase.rpc("mark_pre_service_briefing_item_reviewed",{p_briefing_id:id,p_item_type:itemType,p_item_key:itemKey,p_reservation_id:reservationId,p_review_note:reviewNote});
 if(error)return {status:"error",message:error.message};
 revalidatePath("/[locale]/business/briefings","layout");return {status:"success",message:"Briefing item review recorded."};
}
export async function createHandoff(_:BriefingActionState,data:FormData):Promise<BriefingActionState>{
 const supabase=await authed();if(!supabase)return {status:"error",message:"Authentication required."};
 const id=value(data,"briefing_id"),targetType=value(data,"target_type"),targetUserId=value(data,"target_user_id")||null,message=value(data,"message")||null;
 if(!id||!targetType)return {status:"error",message:"Briefing and target are required."};
 const {error}=await supabase.rpc("create_pre_service_briefing_handoff",{p_briefing_id:id,p_target_type:targetType,p_target_user_id:targetUserId,p_message:message});
 if(error)return {status:"error",message:error.message};
 revalidatePath("/[locale]/business/briefings","layout");return {status:"success",message:"Staff handoff appended. No communication was sent."};
}
export async function acknowledgeHandoff(_:BriefingActionState,data:FormData):Promise<BriefingActionState>{
 const supabase=await authed();if(!supabase)return {status:"error",message:"Authentication required."};
 const id=value(data,"handoff_id"),note=value(data,"acknowledgement_note")||null;if(!id)return {status:"error",message:"Handoff is required."};
 const {error}=await supabase.rpc("acknowledge_pre_service_briefing_handoff",{p_handoff_id:id,p_acknowledgement_note:note});
 if(error)return {status:"error",message:error.message};
 revalidatePath("/[locale]/business/briefings","layout");return {status:"success",message:"Handoff acknowledgement appended."};
}
export async function closeBriefing(_:BriefingActionState,data:FormData):Promise<BriefingActionState>{
 const supabase=await authed();if(!supabase)return {status:"error",message:"Authentication required."};
 const id=value(data,"briefing_id"),reason=value(data,"reason");if(!id||!reason)return {status:"error",message:"Briefing and close reason are required."};
 const {error}=await supabase.rpc("close_pre_service_briefing",{p_briefing_id:id,p_reason:reason});
 if(error)return {status:"error",message:error.message};
 revalidatePath("/[locale]/business/briefings","layout");return {status:"success",message:"Briefing closed with an audit event."};
}
