import { requireAuth, requireOwnerOrManager } from '../plugins/auth.js';
import { getDailyStats, getHourlyDistribution } from '../services/analyticsService.js';

export default async function analyticsRoutes(app) {

  // Get daily stats
  app.get('/stats/:restaurant_id', { preHandler: requireAuth }, async (request, reply) => {
    const { restaurant_id } = request.params;
    const { days } = request.query;
    const stats = await getDailyStats(restaurant_id, parseInt(days) || 7);
    return { stats };
  });

  // Get hourly distribution
  app.get('/hourly/:restaurant_id', { preHandler: requireAuth }, async (request, reply) => {
    const { restaurant_id } = request.params;
    const { days } = request.query;
    const distribution = await getHourlyDistribution(restaurant_id, parseInt(days) || 7);
    return { distribution };
  });
}
