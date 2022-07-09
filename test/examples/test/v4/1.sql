# --- !Ups

CREATE SCHEMA IF NOT EXISTS hello;

CREATE TABLE hello.world (
    id serial PRIMARY KEY,
    email varchar(255) NOT NULL,
    pass varchar(255) NOT NULL
);

# --- !Downs

DROP SCHEMA hello CASCADE;
