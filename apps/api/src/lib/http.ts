import type { NextFunction, Request, Response } from "express";

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: { message: error.message } });
    return;
  }
  if (error instanceof Error && error.name === "ZodError") {
    res.status(400).json({ error: { message: "Request validation failed" } });
    return;
  }
  console.error("Unhandled API error", error);
  res.status(500).json({ error: { message: "An unexpected error occurred" } });
}
