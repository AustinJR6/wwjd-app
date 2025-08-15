export class AppError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export class BadRequest extends AppError {
  constructor(message = 'Bad Request') {
    super(message, 400);
  }
}

export class Unauthorized extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

export class Forbidden extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

export class NotFound extends AppError {
  constructor(message = 'Not Found') {
    super(message, 404);
  }
}
