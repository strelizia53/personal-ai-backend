import { admin } from '../lib/supabase.js';
import { embedText } from '../lib/openai.js';

export default async function healthRoute(fastify) {
  fastify.get('/health', async (_request, reply) => {
    const checks = {};
    let allOk = true;

    const env = {
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
    const envOk = env.OPENAI_API_KEY && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY;
    checks.env = { ok: envOk, present: env };
    if (!envOk) allOk = false;

    if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { count, error } = await admin
          .from('messages')
          .select('*', { count: 'exact', head: true });
        if (error) throw error;
        checks.supabase_table = { ok: true, message_count: count };
      } catch (err) {
        allOk = false;
        checks.supabase_table = { ok: false, error: err.message };
      }

      try {
        const dummy = new Array(1536).fill(0);
        const { error } = await admin.rpc('match_messages', {
          query_embedding: dummy,
          match_session_id: '__healthcheck__',
          match_count: 1,
        });
        if (error) throw error;
        checks.supabase_rpc = { ok: true };
      } catch (err) {
        allOk = false;
        checks.supabase_rpc = { ok: false, error: err.message };
      }

      try {
        const testEmbedding = new Array(1536).fill(0);
        const { data, error } = await admin
          .from('messages')
          .insert({
            session_id: '__healthcheck__',
            role: 'system',
            content: 'health check',
            embedding: testEmbedding,
          })
          .select('id')
          .single();
        if (error) throw error;
        await admin.from('messages').delete().eq('id', data.id);
        checks.supabase_write = { ok: true };
      } catch (err) {
        allOk = false;
        checks.supabase_write = { ok: false, error: err.message };
      }
    } else {
      checks.supabase_table = { ok: false, error: 'env missing' };
    }

    if (env.OPENAI_API_KEY) {
      try {
        const v = await embedText('ping');
        checks.openai_embed = { ok: true, dim: v.length };
      } catch (err) {
        allOk = false;
        checks.openai_embed = { ok: false, error: err.message };
      }
    } else {
      checks.openai_embed = { ok: false, error: 'env missing' };
    }

    reply.code(allOk ? 200 : 503).send({
      status: allOk ? 'healthy' : 'degraded',
      checks,
    });
  });
}
