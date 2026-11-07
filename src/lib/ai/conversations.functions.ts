import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { threadIdSchema, threadSchema, scopeSchema, uiMessageSchema } from './schemas';
import type { Json } from '@/integrations/supabase/types';
export const getAIWorkspace = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
 const { data, error } = await context.supabase.from('ai_workspaces').select('*').eq('owner_id', context.userId).single(); if(error) throw new Error('Your business workspace could not be loaded.');
 const { data: profile } = await context.supabase.from('profiles').select('*').eq('id',context.userId).single();
 return { workspace: data, profile };
});
export const listAIThreads = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(scopeSchema).handler(async ({ data, context }) => {
 const { data: rows, error } = await context.supabase.from('ai_threads').select('*').eq('user_id',context.userId).eq('environment',data.environment).order('pinned',{ascending:false}).order('updated_at',{ascending:false}).limit(100); if(error) throw new Error('Conversations could not be loaded.'); return rows;
});
export const createAIThread = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(threadSchema).handler(async ({ data, context }) => {
 const { data: workspace, error: scopeError } = await context.supabase.from('ai_workspaces').select('id').eq('owner_id',context.userId).single(); if(scopeError || !workspace) throw new Error('No authorized business workspace.');
 const { data: row, error } = await context.supabase.from('ai_threads').insert({ ...data, user_id:context.userId, workspace_id:workspace.id }).select('*').single(); if(error) throw new Error('Conversation could not be created.'); return row;
});
export const getAIThread = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(threadIdSchema).handler(async ({ data, context }) => {
 const { data: thread, error } = await context.supabase.from('ai_threads').select('*').eq('id',data.threadId).eq('user_id',context.userId).eq('environment',data.environment).single(); if(error || !thread) throw new Error('This conversation is unavailable in the selected account or environment.');
 const { data: messages, error: messagesError } = await context.supabase.from('ai_messages').select('*').eq('thread_id',thread.id).eq('user_id',context.userId).order('created_at',{ascending:true}).limit(200); if(messagesError) throw new Error('Conversation history could not be loaded.'); return { thread, messages };
});
export const updateAIThread = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(threadIdSchema.extend({ title: z.string().trim().min(1).max(120), pinned:z.boolean() })).handler(async ({ data, context }) => {
 const { error } = await context.supabase.from('ai_threads').update({ title:data.title, pinned:data.pinned }).eq('id',data.threadId).eq('user_id',context.userId).eq('environment',data.environment); if(error) throw new Error('Conversation could not be updated.'); return { ok:true };
});
export const deleteAIThread = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(threadIdSchema).handler(async ({ data, context }) => {
 const { error } = await context.supabase.from('ai_threads').delete().eq('id',data.threadId).eq('user_id',context.userId).eq('environment',data.environment); if(error) throw new Error('Conversation could not be deleted.'); return { ok:true };
});
export const saveStoppedAIMessage = createServerFn({ method:'POST' }).middleware([requireSupabaseAuth]).inputValidator(threadIdSchema.extend({ message:uiMessageSchema })).handler(async ({ data, context }) => {
 const { data: thread } = await context.supabase.from('ai_threads').select('id').eq('id',data.threadId).eq('environment',data.environment).eq('user_id',context.userId).single(); if(!thread || data.message.role !== 'assistant') throw new Error('Conversation unavailable.');
 const { error } = await context.supabase.from('ai_messages').upsert({ thread_id:thread.id,user_id:context.userId,sdk_id:data.message.id,role:'assistant',parts:data.message.parts as Json,metadata:{stopped:true} },{onConflict:'thread_id,sdk_id'}); if(error) throw new Error('The stopped response could not be saved.'); return {ok:true};
});
