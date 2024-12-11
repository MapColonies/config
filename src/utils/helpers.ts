export function deepFreeze<T>(obj: T): void {
  const propNames = Object.getOwnPropertyNames(obj);
  for (const name of propNames) {
    const value = obj[name as keyof T];
    if (typeof value === 'object' && value !== null) {
      deepFreeze(value);
    }
  }
  Object.freeze(obj);
}
