import { admin, getUserFromToken } from '../lib/supabase.js';

export default async function historyRoute(fastify) {
  fastify.get('/history', async (request, reply) => {
    const auth = request.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    const user = await getUserFromToken(token);
    if (!user) {
      reply.code(401).send({ error: 'unauthorized' });
      return;
    }

    const limit = Math.min(Number(request.query?.limit) || 100, 500);

    const { data, error } = await admin
      .from('messages')
      .select('role, content, created_at')
      .eq('session_id', user.id)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      reply.code(500).send({ error: error.message });
      return;
    }

    reply.send({ messages: (data || []).reverse() });
  });
}
