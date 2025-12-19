// Error handling utilities for the application

import { useCallback, useState } from "react";

export interface AppError {
  message: string;
  code?: string;
  details?: unknown;
  retryable?: boolean;
}

export class ApiError extends Error implements AppError {
  code?: string;
  details?: unknown;
  retryable: boolean;

  constructor(
    message: string,
    code?: string,
    details?: unknown,
    retryable = false,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
    this.retryable = retryable;
  }
}

export class NetworkError extends Error implements AppError {
  retryable = true;

  constructor(message = "Network error occurred") {
    super(message);
    this.name = "NetworkError";
  }
}

export class AuthenticationError extends Error implements AppError {
  retryable = false;

  constructor(message = "Authentication failed") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class ValidationError extends Error implements AppError {
  retryable = false;
  details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = "ValidationError";
    this.details = details;
  }
}

// Error handling utility functions
export function handleApiError(error: unknown): AppError {
  // Handle fetch errors
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return new NetworkError(
      "Unable to connect to the server. Please check your internet connection.",
    );
  }

  // Handle HTTP errors
  if ((error as { status: number }).status) {
    switch ((error as { status: number }).status) {
      case 401:
        return new AuthenticationError(
          "Your session has expired. Please log in again.",
        );
      case 403:
        return new ApiError(
          "You do not have permission to perform this action.",
          "FORBIDDEN",
        );
      case 404:
        return new ApiError(
          "The requested resource was not found.",
          "NOT_FOUND",
        );
      case 429:
        return new ApiError(
          "Too many requests. Please try again later.",
          "RATE_LIMITED",
          null,
          true,
        );
      case 500:
        return new ApiError(
          "Server error occurred. Please try again later.",
          "SERVER_ERROR",
          null,
          true,
        );
      case 503:
        return new ApiError(
          "Service temporarily unavailable. Please try again later.",
          "SERVICE_UNAVAILABLE",
          null,
          true,
        );
      default:
        return new ApiError(
          `Request failed with status ${(error as { status: number }).status}`,
          "HTTP_ERROR",
          null,
          (error as { status: number }).status >= 500,
        );
    }
  }

  // Handle validation errors
  if (
    (error as Error).name === "ValidationError" ||
    (error as Error).message?.includes("validation")
  ) {
    return new ValidationError(
      (error as Error).message || "Validation failed",
      (error as Error & { details: string }).details,
    );
  }

  // Default error
  return new ApiError(
    (error as Error).message || "An unexpected error occurred",
    "UNKNOWN_ERROR",
  );
}

export function getErrorMessage(error: unknown): string {
  const appError = handleApiError(error);
  return appError.message;
}

export function isRetryableError(error: unknown): boolean {
  const appError = handleApiError(error);
  return appError.retryable || false;
}

// Retry utility with exponential backoff
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if it's not a retryable error
      if (!isRetryableError(error)) {
        throw error;
      }

      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Loading state management utility
export interface LoadingState {
  isLoading: boolean;
  error: string | null;
  retryCount: number;
}

export function createLoadingState(): LoadingState {
  return {
    isLoading: false,
    error: null,
    retryCount: 0,
  };
}

export function setLoading(state: LoadingState): LoadingState {
  return {
    ...state,
    isLoading: true,
    error: null,
  };
}

export function setError(state: LoadingState, error: unknown): LoadingState {
  return {
    ...state,
    isLoading: false,
    error: getErrorMessage(error),
  };
}

export function setSuccess(state: LoadingState): LoadingState {
  return {
    ...state,
    isLoading: false,
    error: null,
    retryCount: 0,
  };
}

export function incrementRetry(state: LoadingState): LoadingState {
  return {
    ...state,
    retryCount: state.retryCount + 1,
  };
}

// React hook for managing async operations with error handling
export function useAsyncOperation<T>() {
  const [state, setState] = useState<LoadingState & { data: T | null }>({
    isLoading: false,
    error: null,
    retryCount: 0,
    data: null,
  });

  const execute = useCallback(async (operation: () => Promise<T>) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await retryWithBackoff(operation, 2);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: null,
        data: result,
        retryCount: 0,
      }));
      return result;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: getErrorMessage(error),
        retryCount: prev.retryCount + 1,
      }));
      throw error;
    }
  }, []);

  const retry = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    execute,
    retry,
  };
}

// Note: React import would be needed for the hook above
// import React from 'react'
