DROP DATABASE IF EXISTS backend_template;

CREATE DATABASE backend_template;

/c backend_template;

CREATE TABLE public.users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(200),
    password VARCHAR(200),
    created_at TIMESTAMP,
    firstName VARCHAR(200),
    lastName VARCHAR(200)
)

CREATE TABLE public.user_sessions (
    user_id INTEGER,
    expiration_date TIMESTAMP,
    id VARCHAR(200),
)

CREATE TABLE public.password_reset (
    token VARCHAR(200),
    expiration TIMESTAMP,
    email VARCHAR(200)
)

ALTER TABLE public.user_sessions ADD CONSTRAINT user_sessions_user_id_fk FOREIGN KEY (user_id) REFERENCES public.user(id);