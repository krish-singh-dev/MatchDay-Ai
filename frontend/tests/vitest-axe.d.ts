import 'vitest';

declare module 'vitest' {
  export interface Assertion<T = any> {
    toHaveNoViolations(): void;
  }
}
