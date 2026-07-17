-- Study Rooms: host-scheduled test auto-start.
-- When scheduled_start_at is set and reached (and a test is configured), the
-- room lazily flips from 'lobby' to 'in_test' on the next state read.
ALTER TABLE rooms.rooms ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ;
