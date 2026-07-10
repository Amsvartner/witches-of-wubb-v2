/// <reference types="vite/client" />

declare module '*.csv' {
  const rows: Record<string, string>[];
  export default rows;
}
