import { json } from 'express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { TABLE_EXPORT_BODY_LIMIT } from './dto/table-export.dto';

/** Route (below the global prefix) that takes the larger body. */
export const TABLE_EXPORT_ROUTE = 'admin/export/table';

/**
 * JSON parser for the table export: the rows of a mask (B1 5.5.5) may be
 * larger than the default body limit of 100 kB. It is registered for this one
 * route before Nest's own parser, which then leaves the parsed body alone.
 *
 * The parser is wrapped in a function of its own on purpose: Nest looks for a
 * middleware named `jsonParser` and, if it finds one, registers no JSON
 * parser at all — every other route would then receive no body (the sign-in
 * included).
 */
export function tableExportBodyParser(): RequestHandler {
  const parse = json({ limit: TABLE_EXPORT_BODY_LIMIT });
  return function tableExportBody(req: Request, res: Response, next: NextFunction): void {
    parse(req, res, next);
  };
}
