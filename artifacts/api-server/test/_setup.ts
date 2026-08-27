// Loaded via `node --import` before any test module. The @workspace/db package
// throws at import time if DATABASE_URL is unset; the pool itself connects
// lazily, so a throwaway URL is enough for unit tests that never hit the DB.
process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:5432/test";
process.env.NODE_ENV ||= "test";
