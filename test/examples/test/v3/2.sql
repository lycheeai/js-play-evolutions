# --- !Ups

INSERT INTO hello.world (id, email, pass) VALUES (1, 'test', 'test');

# --- !Downs

DELETE FROM hello.world;
