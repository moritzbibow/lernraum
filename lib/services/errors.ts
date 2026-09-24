export type Issue = { path: string; message: string }

export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly issues: Issue[] = [],
  ) {
    super(message)
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Nicht gefunden.') {
    super(message, 404, 'not_found')
  }
}

export class ValidationError extends AppError {
  constructor(message: string, issues: Issue[] = []) {
    super(message, 400, 'validation_error', issues)
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'conflict')
  }
}
