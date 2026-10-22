/**
 * deno.d.ts
 *
 * Declarações mínimas do namespace Deno para o VS Code não mostrar
 * erros vermelhos em `Deno.serve()` e `Deno.env.get()`.
 *
 * Este ficheiro é apenas para IntelliSense local — em produção
 * (Supabase Edge Functions) o runtime Deno real é usado.
 *
 * Para uma experiência completa, instale a extensão VS Code:
 *   Nome: Deno
 *   Publisher: denoland
 *   ID: denoland.vscode-deno
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare namespace Deno {
  /** Variáveis de ambiente do runtime Deno */
  export interface Env {
    /** Lê uma variável de ambiente. Retorna undefined se não existir. */
    get(key: string): string | undefined;
    /** Define uma variável de ambiente. */
    set(key: string, value: string): void;
    /** Remove uma variável de ambiente. */
    delete(key: string): void;
    /** Retorna todas as variáveis de ambiente como objeto. */
    toObject(): Record<string, string>;
  }

  /** Objecto de acesso às variáveis de ambiente */
  export const env: Env;

  /** Opções do servidor HTTP */
  export interface ServeOptions {
    port?: number;
    hostname?: string;
    signal?: AbortSignal;
    onListen?: (params: { hostname: string; port: number }) => void;
  }

  /** Handler de pedido HTTP */
  export type ServeHandler = (
    request: Request,
    info?: { remoteAddr: { hostname: string; port: number; transport: string } }
  ) => Response | Promise<Response>;

  /**
   * Inicia um servidor HTTP (API moderna Supabase Edge Functions).
   * Substitui o antigo `import { serve } from "https://deno.land/std/http/server.ts"`.
   */
  export function serve(
    handler: ServeHandler,
    options?: ServeOptions
  ): void;

  /** Versão do runtime Deno */
  export const version: {
    deno: string;
    v8: string;
    typescript: string;
  };

  /** Termina o processo com o código fornecido */
  export function exit(code?: number): never;
}
