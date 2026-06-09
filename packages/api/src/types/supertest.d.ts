/**
 * `supertest` v7 ships no type declarations and `@types/supertest` is not installed.
 * This ambient module keeps the default import usable in tests without a `require()` cast.
 */
declare module 'supertest';
