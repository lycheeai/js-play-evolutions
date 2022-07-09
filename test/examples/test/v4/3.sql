# --- !Ups

INSERT INTO hello.world (id, email, pass) VALUES (2, 'test', 'test');

# --- !Downs

DELETE FROM hello.world WHERE id = 2;
