/** أنواع دنيا لمجلد الدوال حتى يتعرّف TypeScript في Cursor على Deno دون امتداد Deno. */
declare const Deno: {
  serve(handler: (request: Request) => Response | Promise<Response>): void
}
