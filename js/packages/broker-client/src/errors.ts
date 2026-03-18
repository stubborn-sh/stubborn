import type { ErrorResponse } from "./types.js";

/** Base error for all broker API errors. */
export class BrokerApiError extends Error {
  readonly status: number;
  readonly errorResponse: ErrorResponse | null;

  constructor(status: number, message: string, errorResponse: ErrorResponse | null = null) {
    super(message);
    this.name = "BrokerApiError";
    this.status = status;
    this.errorResponse = errorResponse;
  }
}

/** 401 Unauthorized — invalid or missing credentials. */
export class BrokerAuthError extends BrokerApiError {
  constructor(
    message: string = "Authentication failed",
    errorResponse: ErrorResponse | null = null,
  ) {
    super(401, message, errorResponse);
    this.name = "BrokerAuthError";
  }
}

/** 403 Forbidden — insufficient permissions. */
export class BrokerForbiddenError extends BrokerApiError {
  constructor(
    message: string = "Insufficient permissions",
    errorResponse: ErrorResponse | null = null,
  ) {
    super(403, message, errorResponse);
    this.name = "BrokerForbiddenError";
  }
}

/** 404 Not Found — requested resource does not exist. */
export class BrokerNotFoundError extends BrokerApiError {
  constructor(message: string = "Resource not found", errorResponse: ErrorResponse | null = null) {
    super(404, message, errorResponse);
    this.name = "BrokerNotFoundError";
  }
}

/** 409 Conflict — resource already exists. */
export class BrokerConflictError extends BrokerApiError {
  constructor(
    message: string = "Resource already exists",
    errorResponse: ErrorResponse | null = null,
  ) {
    super(409, message, errorResponse);
    this.name = "BrokerConflictError";
  }
}

/** 400 Bad Request — validation error. */
export class BrokerValidationError extends BrokerApiError {
  constructor(message: string = "Validation failed", errorResponse: ErrorResponse | null = null) {
    super(400, message, errorResponse);
    this.name = "BrokerValidationError";
  }
}

/** Network or connection error. */
export class BrokerConnectionError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message);
    this.name = "BrokerConnectionError";
    this.cause = cause;
  }
}
