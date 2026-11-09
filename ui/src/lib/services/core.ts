import { APP_CONFIG } from "@/config/app";
import { todayIn } from "../date";
import { getTenantData } from "../store/db";
import type { ISODate } from "../types";

/** Error raised by services when a business rule rejects an operation. */
export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string = "validation_error",
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export function fail(message: string, code?: string): never {
  throw new ServiceError(message, code);
}

/** Simulates network latency so loading states are exercised. */
export function latency(ms: number = APP_CONFIG.mockLatencyMs) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function nowIso() {
  return new Date().toISOString();
}

export function tenantToday(tenantId: string): ISODate {
  return todayIn(getTenantData(tenantId).settings.locale.timezone);
}
