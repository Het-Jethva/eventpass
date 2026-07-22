ALTER TABLE "admission_offer" ADD COLUMN "token_digest" text NOT NULL;--> statement-breakpoint
ALTER TABLE "admission_offer" ADD COLUMN "claimed_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "admission_offer_token_digest_unique" ON "admission_offer" USING btree ("token_digest");--> statement-breakpoint
ALTER TABLE "admission_offer" ADD CONSTRAINT "admission_offer_claimed_at_check" CHECK (("admission_offer"."status" = 'claimed' and "admission_offer"."claimed_at" is not null) or ("admission_offer"."status" <> 'claimed' and "admission_offer"."claimed_at" is null));