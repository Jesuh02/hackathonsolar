/**
 * Base ValueObject class - Shared Domain
 * Inmutable por definición - sin identidad, comparado por valor
 */
export abstract class ValueObject<T> {
  protected readonly props: T;

  constructor(props: T) {
    this.props = Object.freeze({ ...props as object }) as T;
  }

  equals(other: ValueObject<T>): boolean {
    if (!(other instanceof ValueObject)) return false;
    return JSON.stringify(this.props) === JSON.stringify(other.props);
  }

  getValue(): T {
    return this.props;
  }
}
