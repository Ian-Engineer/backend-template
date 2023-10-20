\c ianswensson;

DROP DATABASE IF EXISTS backend_template;

CREATE DATABASE backend_template;

\c backend_template;

CREATE TABLE public.users (
    id SERIAL PRIMARY KEY,
    email TEXT,
    password TEXT,
    created_at TIMESTAMP,
    first_name VARCHAR(200),
    last_name VARCHAR(200),
    date_of_birth DATE,
    gender TEXT,
    city TEXT,
    state TEXT,
    bio TEXT,
    profile_picture TEXT
);

CREATE TABLE public.user_sessions (
    user_id INTEGER,
    expiration_date TIMESTAMP,
    id TEXT
);

CREATE TABLE public.password_reset (
    token VARCHAR(200),
    expiration TIMESTAMP,
    email VARCHAR(200)
);

ALTER TABLE public.user_sessions ADD CONSTRAINT user_sessions_user_id_fk FOREIGN KEY (user_id) REFERENCES public.user(id);