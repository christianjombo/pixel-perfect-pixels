import { createFileRoute } from '@tanstack/react-router';
export const Route=createFileRoute('/api/ai-chat')({server:{handlers:{POST:async({request})=>{const {handleAIChat}=await import('@/lib/ai/chat.server');return handleAIChat(request);}}}});
