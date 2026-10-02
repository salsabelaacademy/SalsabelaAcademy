CREATE TABLE IF NOT EXISTS academy_testimonials (
 id serial PRIMARY KEY,
 name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
 quote text NOT NULL CHECK (char_length(quote) BETWEEN 10 AND 2000),
 language text NOT NULL CHECK (language IN ('ar','en')),
 location text NOT NULL DEFAULT '' CHECK (char_length(location)<=100),
 consent boolean NOT NULL DEFAULT false,
 published boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (NOT published OR consent)
);
CREATE INDEX IF NOT EXISTS academy_testimonials_public_idx ON academy_testimonials(language,id DESC) WHERE published=true AND consent=true;
