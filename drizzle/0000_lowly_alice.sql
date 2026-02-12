CREATE TABLE "allowed_emails" (
	"email" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"url" text NOT NULL,
	"claimed_by_email" text,
	CONSTRAINT "referral_codes_code_unique" UNIQUE("code")
);
