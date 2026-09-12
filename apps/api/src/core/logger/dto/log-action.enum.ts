export enum LogAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  TOGGLE = 'TOGGLE',
  EXPORT = 'EXPORT',
  BACKUP = 'BACKUP',
  MAIL = 'MAIL',
  GET = 'GET', // Lists
  READ = 'READ', // One record opened (e.g. a Schiessplatz)
  AUTH = 'AUTH',
  IMPORT = 'IMPORT',
  //
  ERROR = 'ERROR',
}
