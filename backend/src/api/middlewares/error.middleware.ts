import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
}

/**
 * Middleware centralizado de manejo de errores
 * Evita que los detalles internos lleguen al cliente en producción
 */
export function errorMiddleware(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const isProduction = process.env.NODE_ENV === 'production';

  console.error(`[ERROR] ${err.message}`, isProduction ? '' : err.stack);

  res.status(statusCode).json({
    error: {
      message: isProduction && statusCode === 500 ? 'Error interno del servidor' : err.message,
      ...(isProduction ? {} : { stack: err.stack }),
    },
  });
}
