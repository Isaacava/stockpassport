export {};

declare global {
  interface NumberConstructor {
    /** Type-narrowing overload for finite numeric values used by strict portfolio calculations. */
    isFinite(value: unknown): value is number;
  }
}
