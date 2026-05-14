CREATE TABLE "alert_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"metric" text NOT NULL,
	"operator" text NOT NULL,
	"threshold" numeric NOT NULL,
	"window_days" integer DEFAULT 7 NOT NULL,
	"notify_emails" text[] DEFAULT '{}' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_triggered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feature_requests" ADD COLUMN "planned_quarter" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alert_rules_tenant_idx" ON "alert_rules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "alert_rules_enabled_idx" ON "alert_rules" USING btree ("tenant_id","enabled");