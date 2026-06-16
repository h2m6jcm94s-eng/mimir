import '@fastify/rate-limit';

export const protectedRouteConfig = {
  rateLimit: {
    max: 1000,
    timeWindow: '1 minute' as const,
  },
};

export const strictRouteConfig = {
  rateLimit: {
    max: 60,
    timeWindow: '1 minute' as const,
  },
};
