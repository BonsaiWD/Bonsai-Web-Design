CREATE TYPE "public"."activity_visibility" AS ENUM('everyone', 'studio');--> statement-breakpoint
CREATE TYPE "public"."decision_source" AS ENUM('client', 'studio');--> statement-breakpoint
CREATE TYPE "public"."document_file_label" AS ENUM('original', 'client_signed', 'countersigned', 'other');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."file_purpose" AS ENUM('deliverable', 'contract', 'invoice', 'project_file');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'sent', 'payment_reported', 'paid', 'void');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('bitcoin', 'monero', 'litecoin', 'zelle', 'ach', 'venmo');--> statement-breakpoint
CREATE TYPE "public"."version_status" AS ENUM('in_review', 'approved', 'changes_requested', 'delivered', 'superseded', 'withdrawn');--> statement-breakpoint
CREATE SEQUENCE "public"."invoice_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"actor_id" text,
	"kind" text NOT NULL,
	"summary" text NOT NULL,
	"target" text,
	"visibility" "activity_visibility" DEFAULT 'everyone' NOT NULL,
	"email_to" text,
	"email_status" "email_status",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"requires_signature" boolean DEFAULT true NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_file" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"label" "document_file_label" NOT NULL,
	"uploaded_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_signature" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"file_sha256" text NOT NULL,
	"source" "decision_source" NOT NULL,
	"signer_id" text NOT NULL,
	"signer_email" text NOT NULL,
	"signed_name" text,
	"statement" text NOT NULL,
	"note" text,
	"ip_address" text,
	"user_agent" text,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contract_signature_contract_id_unique" UNIQUE("contract_id"),
	CONSTRAINT "contract_signature_evidence" CHECK (("contract_signature"."source" = 'client' AND "contract_signature"."signed_name" IS NOT NULL) OR ("contract_signature"."source" = 'studio' AND "contract_signature"."note" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "deliverable" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"milestone_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"latest_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliverable_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deliverable_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"title_snapshot" text NOT NULL,
	"link_url" text,
	"file_id" uuid,
	"note" text,
	"needs_approval" boolean NOT NULL,
	"status" "version_status" NOT NULL,
	"review_by" date,
	"shared_by" text NOT NULL,
	"shared_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by" text,
	"decision_source" "decision_source",
	"signed_name" text,
	"signer_email" text,
	"statement" text,
	"decision_note" text,
	"ip_address" text,
	"user_agent" text,
	CONSTRAINT "deliverable_version_number_unique" UNIQUE("deliverable_id","version"),
	CONSTRAINT "deliverable_version_has_content" CHECK ("deliverable_version"."link_url" IS NOT NULL OR "deliverable_version"."file_id" IS NOT NULL),
	CONSTRAINT "deliverable_version_decision_shape" CHECK (("deliverable_version"."status" IN ('approved', 'changes_requested')) = ("deliverable_version"."decided_at" IS NOT NULL AND "deliverable_version"."decided_by" IS NOT NULL AND "deliverable_version"."decision_source" IS NOT NULL AND "deliverable_version"."signer_email" IS NOT NULL AND "deliverable_version"."statement" IS NOT NULL)),
	CONSTRAINT "deliverable_version_decision_evidence" CHECK ("deliverable_version"."status" NOT IN ('approved', 'changes_requested') OR ("deliverable_version"."decision_source" = 'client' AND ("deliverable_version"."status" = 'changes_requested' OR "deliverable_version"."signed_name" IS NOT NULL)) OR ("deliverable_version"."decision_source" = 'studio' AND "deliverable_version"."decision_note" IS NOT NULL)),
	CONSTRAINT "deliverable_version_changes_have_note" CHECK ("deliverable_version"."status" <> 'changes_requested' OR "deliverable_version"."decision_note" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "file" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"purpose" "file_purpose" NOT NULL,
	"uploaded_by" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"storage_key" text NOT NULL,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"number" text DEFAULT 'BWD-' || lpad(nextval('invoice_number_seq')::text, 4, '0') NOT NULL,
	"title" text NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"issued_on" date,
	"due_on" date,
	"notes" text,
	"reported_method" "payment_method",
	"reported_reference" text,
	"reported_at" timestamp with time zone,
	"paid_on" date,
	"paid_method" "payment_method",
	"paid_reference" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_number_unique" UNIQUE("number"),
	CONSTRAINT "invoice_sent_has_dates" CHECK ("invoice"."status" = 'draft' OR ("invoice"."issued_on" IS NOT NULL AND "invoice"."due_on" IS NOT NULL)),
	CONSTRAINT "invoice_paid_has_details" CHECK ("invoice"."status" <> 'paid' OR ("invoice"."paid_on" IS NOT NULL AND "invoice"."paid_method" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "invoice_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(10, 2) DEFAULT 1 NOT NULL,
	"unit_amount_cents" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "invoice_item_quantity_positive" CHECK ("invoice_item"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"internal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestone_signoff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"milestone_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"source" "decision_source" NOT NULL,
	"signer_id" text NOT NULL,
	"signer_email" text NOT NULL,
	"initials" text,
	"statement" text NOT NULL,
	"note" text,
	"ip_address" text,
	"user_agent" text,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "milestone_signoff_milestone_id_unique" UNIQUE("milestone_id"),
	CONSTRAINT "milestone_signoff_evidence" CHECK (("milestone_signoff"."source" = 'client' AND "milestone_signoff"."initials" IS NOT NULL) OR ("milestone_signoff"."source" = 'studio' AND "milestone_signoff"."note" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "payment_method_setting" (
	"method" "payment_method" PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_read_state" (
	"user_id" text NOT NULL,
	"project_id" uuid NOT NULL,
	"messages_read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_read_state_user_id_project_id_pk" PRIMARY KEY("user_id","project_id")
);
--> statement-breakpoint
ALTER TABLE "milestone" ADD COLUMN "requires_signoff" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "company" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "last_sign_in_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_file" ADD CONSTRAINT "contract_file_contract_id_contract_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contract"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_file" ADD CONSTRAINT "contract_file_file_id_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."file"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_file" ADD CONSTRAINT "contract_file_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_signature" ADD CONSTRAINT "contract_signature_contract_id_contract_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contract"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_signature" ADD CONSTRAINT "contract_signature_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_signature" ADD CONSTRAINT "contract_signature_file_id_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."file"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_signature" ADD CONSTRAINT "contract_signature_signer_id_user_id_fk" FOREIGN KEY ("signer_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable" ADD CONSTRAINT "deliverable_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable" ADD CONSTRAINT "deliverable_milestone_id_milestone_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestone"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_version" ADD CONSTRAINT "deliverable_version_deliverable_id_deliverable_id_fk" FOREIGN KEY ("deliverable_id") REFERENCES "public"."deliverable"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_version" ADD CONSTRAINT "deliverable_version_file_id_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."file"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_version" ADD CONSTRAINT "deliverable_version_shared_by_user_id_fk" FOREIGN KEY ("shared_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_version" ADD CONSTRAINT "deliverable_version_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_signoff" ADD CONSTRAINT "milestone_signoff_milestone_id_milestone_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestone"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_signoff" ADD CONSTRAINT "milestone_signoff_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_signoff" ADD CONSTRAINT "milestone_signoff_signer_id_user_id_fk" FOREIGN KEY ("signer_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_read_state" ADD CONSTRAINT "project_read_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_read_state" ADD CONSTRAINT "project_read_state_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_project_id_created_at_idx" ON "activity" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "contract_project_id_idx" ON "contract" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "contract_file_contract_id_idx" ON "contract_file" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "deliverable_project_id_idx" ON "deliverable" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deliverable_version_one_in_review" ON "deliverable_version" USING btree ("deliverable_id") WHERE "deliverable_version"."status" = 'in_review';--> statement-breakpoint
CREATE INDEX "file_project_id_idx" ON "file" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "invoice_project_id_idx" ON "invoice" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "invoice_item_invoice_id_idx" ON "invoice_item" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "message_project_id_created_at_idx" ON "message" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "milestone_signoff_project_id_idx" ON "milestone_signoff" USING btree ("project_id");--> statement-breakpoint
-- ---------- Hand-written below this line: keep it when regenerating ----------
-- Guards for the portal's records. Shared versions keep their identity; a decided version,
-- a milestone sign-off and a contract signature can never be changed or deleted, except by
-- purge_project(), which exists to remove test data.
CREATE OR REPLACE FUNCTION portal_guard_deliverable_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF TG_OP = 'INSERT' THEN
		NEW.shared_at := now();
		RETURN NEW;
	END IF;
	IF TG_OP = 'DELETE' THEN
		IF current_setting('bonsai.purge', true) = 'on' THEN
			RETURN OLD;
		END IF;
		IF OLD.status IN ('approved', 'changes_requested') THEN
			RAISE EXCEPTION 'A version with a decision cannot be deleted' USING HINT = 'bonsai:record_locked';
		END IF;
		RETURN OLD;
	END IF;
	IF OLD.status IN ('approved', 'changes_requested', 'superseded', 'withdrawn') THEN
		RAISE EXCEPTION 'This version is part of the record and cannot change' USING HINT = 'bonsai:record_locked';
	END IF;
	IF NEW.id <> OLD.id OR NEW.deliverable_id <> OLD.deliverable_id OR NEW.version <> OLD.version
		OR NEW.shared_at <> OLD.shared_at OR NEW.shared_by <> OLD.shared_by
		OR NEW.title_snapshot <> OLD.title_snapshot OR NEW.needs_approval <> OLD.needs_approval THEN
		RAISE EXCEPTION 'These details of a shared version cannot change' USING HINT = 'bonsai:version_fixed';
	END IF;
	IF NEW.status <> OLD.status THEN
		IF NOT ((OLD.status = 'in_review' AND NEW.status IN ('superseded', 'approved', 'changes_requested', 'withdrawn'))
			OR (OLD.status = 'delivered' AND NEW.status = 'withdrawn')) THEN
			RAISE EXCEPTION 'A version cannot move from % to %', OLD.status, NEW.status USING HINT = 'bonsai:bad_transition';
		END IF;
		IF NEW.status IN ('approved', 'changes_requested') THEN
			NEW.decided_at := now();
		END IF;
	ELSIF NEW.decided_at IS DISTINCT FROM OLD.decided_at THEN
		RAISE EXCEPTION 'decided_at is set by the database' USING HINT = 'bonsai:version_fixed';
	END IF;
	RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION portal_guard_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF TG_OP = 'INSERT' THEN
		NEW.signed_at := now();
		RETURN NEW;
	END IF;
	IF TG_OP = 'DELETE' AND current_setting('bonsai.purge', true) = 'on' THEN
		RETURN OLD;
	END IF;
	RAISE EXCEPTION 'Rows in % are a permanent record', TG_TABLE_NAME USING HINT = 'bonsai:record_locked';
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION portal_guard_truncate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF current_setting('bonsai.purge', true) = 'on' THEN
		RETURN NULL;
	END IF;
	RAISE EXCEPTION '% holds permanent records and cannot be truncated', TG_TABLE_NAME USING HINT = 'bonsai:record_locked';
END
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS portal_guard ON "deliverable_version";
--> statement-breakpoint
CREATE TRIGGER portal_guard BEFORE INSERT OR UPDATE OR DELETE ON "deliverable_version"
	FOR EACH ROW EXECUTE FUNCTION portal_guard_deliverable_version();
--> statement-breakpoint
DROP TRIGGER IF EXISTS portal_guard ON "milestone_signoff";
--> statement-breakpoint
CREATE TRIGGER portal_guard BEFORE INSERT OR UPDATE OR DELETE ON "milestone_signoff"
	FOR EACH ROW EXECUTE FUNCTION portal_guard_record();
--> statement-breakpoint
DROP TRIGGER IF EXISTS portal_guard ON "contract_signature";
--> statement-breakpoint
CREATE TRIGGER portal_guard BEFORE INSERT OR UPDATE OR DELETE ON "contract_signature"
	FOR EACH ROW EXECUTE FUNCTION portal_guard_record();
--> statement-breakpoint
DROP TRIGGER IF EXISTS portal_guard_truncate ON "deliverable_version";
--> statement-breakpoint
CREATE TRIGGER portal_guard_truncate BEFORE TRUNCATE ON "deliverable_version"
	FOR EACH STATEMENT EXECUTE FUNCTION portal_guard_truncate();
--> statement-breakpoint
DROP TRIGGER IF EXISTS portal_guard_truncate ON "milestone_signoff";
--> statement-breakpoint
CREATE TRIGGER portal_guard_truncate BEFORE TRUNCATE ON "milestone_signoff"
	FOR EACH STATEMENT EXECUTE FUNCTION portal_guard_truncate();
--> statement-breakpoint
DROP TRIGGER IF EXISTS portal_guard_truncate ON "contract_signature";
--> statement-breakpoint
CREATE TRIGGER portal_guard_truncate BEFORE TRUNCATE ON "contract_signature"
	FOR EACH STATEMENT EXECUTE FUNCTION portal_guard_truncate();
--> statement-breakpoint
-- Removes a project and everything in it, records included. For test data only:
-- SELECT purge_project('<project id>'); then delete the test user if you like.
CREATE OR REPLACE FUNCTION purge_project(p uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
	PERFORM set_config('bonsai.purge', 'on', true);
	DELETE FROM "contract_signature" WHERE project_id = p;
	DELETE FROM "milestone_signoff" WHERE project_id = p;
	DELETE FROM "invoice" WHERE project_id = p;
	DELETE FROM "project" WHERE id = p;
	PERFORM set_config('bonsai.purge', 'off', true);
END
$$;
--> statement-breakpoint
INSERT INTO "payment_method_setting" ("method") VALUES ('bitcoin'), ('monero'), ('litecoin'), ('zelle'), ('ach'), ('venmo')
	ON CONFLICT ("method") DO NOTHING;
