export function createAuthHook(apiKey) {
  return async function authHook(request, reply) {
    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing Authorization header' });
    }
    const token = authHeader.slice(7);
    if (token !== apiKey) {
      return reply.code(403).send({ error: 'Invalid API key' });
    }
  };
}
