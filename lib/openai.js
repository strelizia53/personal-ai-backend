import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function embedText(text) {
  const res = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return res.data[0].embedding;
}

export async function streamChat(messages, systemPrompt) {
  return client.chat.completions.create({
    model: 'gpt-4.1',
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
  });
}
