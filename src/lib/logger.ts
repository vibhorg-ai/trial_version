import pino, { type LoggerOptions } from 'pino';

const baseOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  base: { service: 'nextflow' },
  redact: ['req.headers.authorization', 'req.headers.cookie'],
};

export const logger = pino(baseOptions);

/** Convenience for logging at the route boundary. */
export function withRoute(route: string) {
  return logger.child({ route });
}
