import { embedText, streamChat } from '../lib/openai.js';
import { getUserFromToken, retrieveMemories, saveMessage } from '../lib/supabase.js';

const SYSTEM_BASE = `You are a warm, attentive personal companion and therapist for the user. You speak conversationally, with empathy and patience. You listen carefully, reflect feelings, ask gentle questions, and offer thoughtful perspective when useful. You never lecture. You never moralize. You meet the user where they are.

You have access to memories from previous conversations with this user. Weave them in naturally — do not list them or announce that you "remember" things mechanically. Use them the way a trusted friend would: as quiet context that informs how you respond.`;

function buildSystemPrompt(memories) {
  if (!memories || memories.length === 0) return SYSTEM_BASE;
  const memoryBlock = memories
    .map((m) => `- (${m.role}) ${m.content}`)
    .join('\n');
  return `${SYSTEM_BASE}\n\nRelevant memories from past conversations with this user:\n${memoryBlock}`;
}

export default async function chatRoute(fastify) {
  fastify.post('/chat', async (request, reply) => {
    const auth = request.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    const user = await getUserFromToken(token);
    if (!user) {
      reply.code(401).send({ error: 'unauthorized' });
      return;
    }
    const userId = user.id;

    const { message } = request.body || {};
    if (!message) {
      reply.code(400).send({ error: 'message is required' });
      return;
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no',
    });

    let userEmbedding;
    try {
      userEmbedding = await embedText(message);
    } catch (err) {
      console.error('embed error:', err);
      reply.raw.write(`data: [ERROR] embedding failed\n\n`);
      reply.raw.end();
      return;
    }

    const memories = await retrieveMemories(userEmbedding, userId, 5);
    const systemPrompt = buildSystemPrompt(memories);

    let assistantText = '';
    try {
      const stream = await streamChat(
        [{ role: 'user', content: message }],
        systemPrompt
      );
      for await (const part of stream) {
        const delta = part.choices?.[0]?.delta?.content || '';
        if (delta) {
          assistantText += delta;
          reply.raw.write(`data: ${JSON.stringify(delta)}\n\n`);
        }
      }
    } catch (err) {
      console.error('stream error:', err);
      reply.raw.write(`data: [ERROR] stream failed\n\n`);
      reply.raw.end();
      return;
    }

    reply.raw.write('data: [DONE]\n\n');
    reply.raw.end();

    try {
      await saveMessage(userId, 'user', message, userEmbedding);
      if (assistantText) {
        const assistantEmbedding = await embedText(assistantText);
        await saveMessage(userId, 'assistant', assistantText, assistantEmbedding);
      }
    } catch (err) {
      console.error('persistence error:', err);
    }
  });
}
