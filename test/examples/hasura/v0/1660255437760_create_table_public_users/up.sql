CREATE TABLE "public"."users" ("id" text NOT NULL, "phone" text, "email" text, "name" text, PRIMARY KEY ("id") , UNIQUE ("id"));COMMENT ON TABLE "public"."users" IS E'WagerWire users';
