-- Optional private account details for admin and student. Preserve all existing records.
CREATE TABLE IF NOT EXISTS account_details (
 user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 date_of_birth date,
 city varchar(100) NOT NULL DEFAULT '',
 bio varchar(1000) NOT NULL DEFAULT '',
 phone varchar(30) NOT NULL DEFAULT '',
 country varchar(100) NOT NULL DEFAULT '',
 timezone varchar(80) NOT NULL DEFAULT 'UTC',
 preferred_language varchar(2) NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en','ar')),
 updated_at timestamp NOT NULL DEFAULT now(),
 CHECK (date_of_birth IS NULL OR date_of_birth >= DATE '1900-01-01')
);
