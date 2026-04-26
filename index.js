import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import chatRoute from './routes/chat.js';
import healthRoute from './routes/health.js';
import historyRoute from './routes/history.js';

const fastify = Fastify({ logger: true });

await fastify.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

fastify.get('/', async () => ({ ok: true, service: 'personal-ai' }));

await fastify.register(healthRoute);
await fastify.register(historyRoute);
await fastify.register(chatRoute);

const port = Number(process.env.PORT) || 3000;
fastify.listen({ port, host: '0.0.0.0' }).catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
