import { createClient } from '@supabase/supabase-js';

// Service role client — used for all DB operations on the backend.
// Bypasses RLS; we enforce user scoping in code via the validated user id.
export const admin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Validate a user's JWT. Returns the user object or null.
export async function getUserFromToken(accessToken) {
  if (!accessToken) return null;
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data?.user) return null;
  return data.user;
}

export async function retrieveMemories(embedding, userId, topK = 5) {
  const { data, error } = await admin.rpc('match_messages', {
    query_embedding: embedding,
    match_session_id: userId,
    match_count: topK,
  });
  if (error) {
    console.error('retrieveMemories error:', error);
    return [];
  }
  return data || [];
}

export async function saveMessage(userId, role, content, embedding) {
  const { error } = await admin.from('messages').insert({
    session_id: userId,
    role,
    content,
    embedding,
  });
  if (error) {
    console.error('saveMessage error:', error);
    throw new Error(error.message);
  }
}
