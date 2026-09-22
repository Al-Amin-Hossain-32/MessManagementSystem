import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { StatusCodes } from 'http-status-codes';
import { AppError, ValidationError } from '../lib/errors';
import { logger } from '../lib/logger';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // ─── Zod Validation Errors ───────────────────────────────────────────────────
  if (err instanceof ZodError) {
    const details: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const path = issue.path.join('.');
      if (!details[path]) details[path] = [];
      details[path].push(issue.message);
    }
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details,
      },
    });
    return;
  }

  // ─── Known Application Errors ────────────────────────────────────────────────
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error(
        { err, req: { method: req.method, url: req.url, ip: req.ip } },
        'Non-operational error',
      );
    }
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
      },
    });
    return;
  }

  // ─── Prisma Errors ────────────────────────────────────────────────────────────
  if (err && typeof err === 'object' && 'code' in err) {
    const prismaErr = err as { code: string; meta?: { target?: string[] } };

    if (prismaErr.code === 'P2002') {
      // Unique constraint violation
      const field = prismaErr.meta?.target?.join(', ') ?? 'field';
      res.status(StatusCodes.CONFLICT).json({
        success: false,
        error: {
          code: 'DUPLICATE_ENTRY',
          message: `A record with this ${field} already exists`,
        },
      });
      return;
    }

    if (prismaErr.code === 'P2025') {
      // Record not found
      res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'The requested record was not found',
        },
      });
      return;
    }
  }
  // ─── Unknown / Unexpected Errors ─────────────────────────────────────────────
  logger.error(
    { err, req: { method: req.method, url: req.url, ip: req.ip } },
    'Unexpected error',
  );

  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.method} ${req.url} not found`,
    },
  });
}
