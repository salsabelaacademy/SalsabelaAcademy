-- Additive indexes only; no user/data deletion and no automatic demo accounts.
CREATE INDEX IF NOT EXISTS lessons_student_starts_idx ON lessons(student_id, starts_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_sender_created_idx ON messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_recipient_created_idx ON messages(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_public_language_idx ON posts(status,language,created_at DESC);
CREATE INDEX IF NOT EXISTS applications_status_created_idx ON platform_applications(status,created_at DESC);
CREATE INDEX IF NOT EXISTS contact_fingerprint_created_idx ON contact_messages(fingerprint,created_at DESC);
CREATE INDEX IF NOT EXISTS attendance_student_date_idx ON attendance_records(student_id,session_date DESC);
