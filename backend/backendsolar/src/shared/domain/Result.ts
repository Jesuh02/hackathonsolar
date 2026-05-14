/**
 * Result pattern - manejo funcional de errores sin excepciones
 * Principio: Open/Closed - extensible sin modificar
 */
export class Result<T> {
  private readonly _isSuccess: boolean;
  private readonly _error: string | null;
  private readonly _value: T | null;

  private constructor(isSuccess: boolean, error: string | null, value: T | null) {
    this._isSuccess = isSuccess;
    this._error = error;
    this._value = value;
  }

  get isSuccess(): boolean {
    return this._isSuccess;
  }

  get isFailure(): boolean {
    return !this._isSuccess;
  }

  get error(): string {
    if (this._isSuccess) throw new Error('No error on success result');
    return this._error!;
  }

  get value(): T {
    if (!this._isSuccess) throw new Error('No value on failure result');
    return this._value!;
  }

  static ok<T>(value: T): Result<T> {
    return new Result<T>(true, null, value);
  }

  static fail<T>(error: string): Result<T> {
    return new Result<T>(false, error, null);
  }
}
