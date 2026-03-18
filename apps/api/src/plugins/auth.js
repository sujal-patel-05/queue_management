export async function requireAuth(request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
}

export async function requireOwnerOrManager(request, reply) {
  await requireAuth(request, reply);
  if (reply.sent) return;
  if (!['owner', 'manager'].includes(request.user.role)) {
    reply.status(403).send({ error: 'Insufficient permissions' });
  }
}

export async function requireKitchenOrAbove(request, reply) {
  await requireAuth(request, reply);
  if (reply.sent) return;
  if (!['owner', 'manager', 'staff', 'kitchen'].includes(request.user.role)) {
    reply.status(403).send({ error: 'Insufficient permissions' });
  }
}
