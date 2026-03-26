import { describe, it, expect } from "vitest";
import {
  BrokerApiError,
  BrokerAuthError,
  BrokerForbiddenError,
  BrokerNotFoundError,
  BrokerConflictError,
  BrokerValidationError,
  BrokerConnectionError,
} from "../../src/errors.js";

describe("BrokerApiError", () => {
  it("should_store_status_and_message", () => {
    const error = new BrokerApiError(500, "Internal server error");
    expect(error.status).toBe(500);
    expect(error.message).toBe("Internal server error");
    expect(error.name).toBe("BrokerApiError");
    expect(error.errorResponse).toBeNull();
  });

  it("should_store_error_response_when_provided", () => {
    const errorResponse = {
      code: "INTERNAL_ERROR",
      message: "Something went wrong",
      traceId: "abc-123",
      timestamp: "2026-01-01T00:00:00Z",
      details: {},
    };
    const error = new BrokerApiError(500, "fail", errorResponse);
    expect(error.errorResponse).toBe(errorResponse);
  });

  it("should_be_instance_of_Error", () => {
    const error = new BrokerApiError(500, "test");
    expect(error).toBeInstanceOf(Error);
  });
});

describe("BrokerAuthError", () => {
  it("should_default_to_401_and_auth_message", () => {
    const error = new BrokerAuthError();
    expect(error.status).toBe(401);
    expect(error.message).toBe("Authentication failed");
    expect(error.name).toBe("BrokerAuthError");
  });

  it("should_accept_custom_message", () => {
    const error = new BrokerAuthError("Token expired");
    expect(error.message).toBe("Token expired");
  });

  it("should_be_instance_of_BrokerApiError", () => {
    expect(new BrokerAuthError()).toBeInstanceOf(BrokerApiError);
  });
});

describe("BrokerForbiddenError", () => {
  it("should_default_to_403", () => {
    const error = new BrokerForbiddenError();
    expect(error.status).toBe(403);
    expect(error.name).toBe("BrokerForbiddenError");
  });
});

describe("BrokerNotFoundError", () => {
  it("should_default_to_404", () => {
    const error = new BrokerNotFoundError();
    expect(error.status).toBe(404);
    expect(error.name).toBe("BrokerNotFoundError");
  });
});

describe("BrokerConflictError", () => {
  it("should_default_to_409", () => {
    const error = new BrokerConflictError();
    expect(error.status).toBe(409);
    expect(error.name).toBe("BrokerConflictError");
  });
});

describe("BrokerValidationError", () => {
  it("should_default_to_400", () => {
    const error = new BrokerValidationError();
    expect(error.status).toBe(400);
    expect(error.name).toBe("BrokerValidationError");
  });
});

describe("BrokerConnectionError", () => {
  it("should_store_message_and_cause", () => {
    const cause = new TypeError("fetch failed");
    const error = new BrokerConnectionError("Connection refused", cause);
    expect(error.message).toBe("Connection refused");
    expect(error.cause).toBe(cause);
    expect(error.name).toBe("BrokerConnectionError");
  });

  it("should_be_instance_of_Error", () => {
    const error = new BrokerConnectionError("fail", null);
    expect(error).toBeInstanceOf(Error);
  });
});
