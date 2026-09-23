/** Vitest serves any file as a string with the `?raw` suffix. */
declare module "*?raw" {
  const content: string;
  export default content;
}

/** Vite's `import.meta.glob`, used to read source files as text in tests. */
interface ImportMeta {
  glob<T>(
    pattern: string,
    options: { query: "?raw"; import: "default"; eager: true },
  ): Record<string, T>;
}
