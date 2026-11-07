import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { useRouter } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
const Context=createContext<{user:User|null;loading:boolean}>({user:null,loading:true});
export function AISessionProvider({children}:{children:ReactNode}){
 const [user,setUser]=useState<User|null>(null);const [loading,setLoading]=useState(true);const router=useRouter();const qc=useQueryClient();
 useEffect(()=>{let active=true;void supabase.auth.getUser().then(({data})=>{if(active){setUser(data.user);setLoading(false);}});const {data}=supabase.auth.onAuthStateChange((event,session)=>{if(!['SIGNED_IN','SIGNED_OUT','USER_UPDATED'].includes(event))return;setUser(session?.user??null);setLoading(false);if(event==='SIGNED_OUT'){qc.clear();}else{void qc.invalidateQueries();}void router.invalidate();});return()=>{active=false;data.subscription.unsubscribe();};},[router,qc]);
 return <Context.Provider value={{user,loading}}>{children}</Context.Provider>;
}
export const useAISession=()=>useContext(Context);
