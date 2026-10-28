import { MongoServerError } from 'mongodb';

/** A write broke a unique index, e.g. a second note with the same title. */
export function isDuplicateKeyError(error: unknown): boolean {
  return error instanceof MongoServerError && error.code === 11000;
}
