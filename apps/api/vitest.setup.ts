import 'reflect-metadata';

process.env['APP_ENV'] = 'test';
process.env['API_SECRET'] = 'test';
process.env['APP_SECRET'] = 'test';
// The galaxy ReplayGuard wants an AES-encrypted nonce header per request
// (X-TOKEN-ASGARD, set by the auth-ui interceptor). Its own switch turns it
// off for the supertest HTTP specs; the guard stays in the chain.
process.env['API_AUTH_GUARD_REPLAY_DISABLED'] = '1';
