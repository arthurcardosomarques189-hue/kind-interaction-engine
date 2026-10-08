import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url=Deno.env.get("SUPABASE_URL")!, serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, anonKey=Deno.env.get("SUPABASE_ANON_KEY")!;
const providerUrl=Deno.env.get("DUBBING_PROVIDER_URL"), providerKey=Deno.env.get("DUBBING_PROVIDER_API_KEY");
const db=createClient(url,serviceKey);

Deno.serve(async(req)=>{
 if(req.method!=="POST") return new Response("Method not allowed",{status:405});
 const auth=req.headers.get("Authorization"); if(!auth) return Response.json({error:"Unauthorized"},{status:401});
 const userDb=createClient(url,anonKey,{global:{headers:{Authorization:auth}}});
 const {data:{user}}=await userDb.auth.getUser(); if(!user) return Response.json({error:"Unauthorized"},{status:401});
 if(!providerUrl||!providerKey) return Response.json({error:"DUBBING_PROVIDER_URL and DUBBING_PROVIDER_API_KEY are required"},{status:503});
 const b=await req.json() as {projectId?:string;sourceLanguage?:string;targetLanguage?:string};
 if(!b.projectId||!b.sourceLanguage||!b.targetLanguage) return Response.json({error:"projectId, sourceLanguage and targetLanguage are required"},{status:400});
 const {data:project}=await db.from("projects").select("id").eq("id",b.projectId).eq("user_id",user.id).maybeSingle();
 if(!project) return Response.json({error:"Project not found"},{status:404});
 const {data:job,error}=await db.from("cortes_dubbing_jobs").insert({user_id:user.id,project_id:b.projectId,source_language:b.sourceLanguage,target_language:b.targetLanguage,provider:"external-dubbing",status:"processing"}).select().single();
 if(error) return Response.json({error:error.message},{status:500});
 const r=await fetch(providerUrl,{method:"POST",headers:{Authorization:`Bearer ${providerKey}`,"Content-Type":"application/json"},body:JSON.stringify({job_id:job.id,project_id:b.projectId,source_language:b.sourceLanguage,target_language:b.targetLanguage})});
 if(!r.ok){const e=await r.text();await db.from("cortes_dubbing_jobs").update({status:"failed",error_message:e}).eq("id",job.id);return Response.json({error:"Dubbing provider rejected the request"},{status:502});}
 const result=await r.json();
 await db.from("cortes_dubbing_jobs").update({provider_job_id:result.job_id||result.id||null,status:result.status==="completed"?"completed":"processing",output_path:result.output_path||null}).eq("id",job.id);
 return Response.json({job_id:job.id,...result});
});
