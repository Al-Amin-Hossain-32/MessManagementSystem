import { StatusCodes } from 'http-status-codes';

// ─── Base Application Error ───────────────────────────────────────────────────

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, string[]>;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational = true,
    details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── HTTP Error Subclasses ────────────────────────────────────────────────────

export class BadRequestError extends AppError {
  constructor(message: string, details?: Record<string, string[]>) {
    super(message, StatusCodes.BAD_REQUEST, 'BAD_REQUEST', true, details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, string[]>) {
    super(message, StatusCodes.UNPROCESSABLE_ENTITY, 'VALIDATION_ERROR', true, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, StatusCodes.UNAUTHORIZED, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, StatusCodes.FORBIDDEN, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, StatusCodes.NOT_FOUND, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, StatusCodes.CONFLICT, 'CONFLICT');
  }
}

export class UnprocessableError extends AppError {
  constructor(message: string, code = 'UNPROCESSABLE') {
    super(message, StatusCodes.UNPROCESSABLE_ENTITY, code);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, StatusCodes.TOO_MANY_REQUESTS, 'RATE_LIMIT_EXCEEDED');
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'An unexpected error occurred') {
    super(message, StatusCodes.INTERNAL_SERVER_ERROR, 'INTERNAL_SERVER_ERROR', false);
  }
}

// ─── Domain-Specific Errors ───────────────────────────────────────────────────

export class TenantAccessError extends AppError {
  constructor(message = 'Access to this resource is not permitted') {
    super(message, StatusCodes.FORBIDDEN, 'TENANT_ACCESS_DENIED');
  }
}

export class SelfApprovalError extends AppError {
  constructor(action: string) {
    super(
      `Self-approval is not permitted for: ${action}`,
      StatusCodes.FORBIDDEN,
      'SELF_APPROVAL_DENIED',
    );
  }
}

export class SubscriptionLimitError extends AppError {
  constructor(resource: string) {
    super(
      `Your current plan does not allow adding more ${resource}. Please upgrade your subscription.`,
      StatusCodes.PAYMENT_REQUIRED,
      'SUBSCRIPTION_LIMIT_EXCEEDED',
    );
  }
}

export class SubscriptionFeatureError extends AppError {
  constructor(feature: string) {
    super(
      `This feature (${feature}) is not available on your current plan.`,
      StatusCodes.PAYMENT_REQUIRED,
      'SUBSCRIPTION_FEATURE_NOT_AVAILABLE',
    );
  }
}

export class ActiveMembershipConflictError extends AppError {
  constructor() {
    super(
      'You already have an active membership in another Mess. Please leave your current Mess before joining a new one.',
      StatusCodes.CONFLICT,
      'ACTIVE_MEMBERSHIP_CONFLICT',
    );
  }
}

export class ImmutableRecordError extends AppError {
  constructor(record: string) {
    super(
      `${record} cannot be modified. Use the correction/adjustment workflow instead.`,
      StatusCodes.FORBIDDEN,
      'IMMUTABLE_RECORD',
    );
  }
}

export class AccountingPeriodClosedError extends AppError {
  constructor() {
    super(
      'This accounting period is closed. Modifications require the post-close adjustment workflow.',
      StatusCodes.FORBIDDEN,
      'ACCOUNTING_PERIOD_CLOSED',
    );
  }
}

export class DuplicateTransactionError extends AppError {
  constructor() {
    super(
      'A payment with this transaction reference already exists.',
      StatusCodes.CONFLICT,
      'DUPLICATE_TRANSACTION',
    );
  }
}
