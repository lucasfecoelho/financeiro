import type { NextFunction, Request, RequestHandler, Response } from "express";

export function asyncHandler(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (request, response, next) => {
    void handler(request, response, next).catch(next);
  };
}

export function serializeForJson(value: unknown) {
  return JSON.parse(
    JSON.stringify(value, (_key, nestedValue) => {
      if (
        nestedValue &&
        typeof nestedValue === "object" &&
        typeof nestedValue.toNumber === "function"
      ) {
        return nestedValue.toNumber();
      }

      return nestedValue;
    }),
  );
}
