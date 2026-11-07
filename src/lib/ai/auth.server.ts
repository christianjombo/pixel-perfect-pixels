import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
export async function authenticateAIRequest(request: Request) {
 const header=request.headers.get('authorization'); if(!header?.startsWith('Bearer ')) throw new Response('Sign in to use Griv AI.',{status:401});
 const token=header.slice(7); const url=process.env['SUPABASE_URL']; const key=process.env['SUPABASE_PUBLISHABLE_KEY']; if(!url || !key) throw new Response('Account service is not configured.',{status:503});
 const client=createClient<Database>(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:header},fetch:(input,init)=>{const h=new Headers(init?.headers);h.set('apikey',key);return fetch(input,{...init,headers:h});}}});
 const {data,error}=await client.auth.getUser(token); if(error || !data.user) throw new Response('Your session expired. Sign in again.',{status:401});
 return {client,user:data.user};
}
