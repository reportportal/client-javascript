declare module 'proxy-from-env' {
  export function getProxyForUrl(url: string): string;
}

declare module 'ini' {
  type IniValue = string | boolean | null | IniValue[] | { [key: string]: IniValue };

  export function parse(str: string): Record<string, IniValue>;
  export function stringify(obj: Record<string, unknown>): string;
}
