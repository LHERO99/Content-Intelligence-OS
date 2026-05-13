CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"action" text NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text,
	"raw_payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "blacklist" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"keyword" text,
	"target_url" text,
	"type" text NOT NULL,
	"reason" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "config" (
	"tenant_id" text NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"description" text,
	"file_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "config_tenant_id_key_pk" PRIMARY KEY("tenant_id","key")
);
--> statement-breakpoint
CREATE TABLE "content_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"keyword_id" text,
	"logged_url" text,
	"action_type" text,
	"page_type" text,
	"editor_id" text,
	"time_created" timestamp with time zone DEFAULT now() NOT NULL,
	"time_changed" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_log_body" (
	"content_log_id" integer PRIMARY KEY NOT NULL,
	"content_body" text,
	"diff_summary" text
);
--> statement-breakpoint
CREATE TABLE "cost_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"page_type" text NOT NULL,
	"action_type" text NOT NULL,
	"agency_cost" numeric DEFAULT '0' NOT NULL,
	"overhead_cost" numeric DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text,
	"type" text DEFAULT 'feature' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'Open' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "keyword_map" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"keyword" text NOT NULL,
	"target_url" text NOT NULL,
	"search_volume" integer,
	"difficulty" integer,
	"status" text DEFAULT 'Backlog' NOT NULL,
	"editorial_deadline" date,
	"main_keyword" text DEFAULT 'N' NOT NULL,
	"article_count" integer,
	"avg_product_value" numeric,
	"policy" numeric,
	"priority_score" numeric,
	"ranking" integer,
	"action_type" text DEFAULT 'Erstellung',
	"page_type" text,
	"last_published" date
);
--> statement-breakpoint
CREATE TABLE "keyword_map_editors" (
	"keyword_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "keyword_map_editors_keyword_id_user_id_pk" PRIMARY KEY("keyword_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "keyword_ranking_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"keyword_id" text NOT NULL,
	"date" date NOT NULL,
	"ranking" integer
);
--> statement-breakpoint
CREATE TABLE "pricing_tiers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"monthly_price" numeric DEFAULT '0' NOT NULL,
	"yearly_price" numeric DEFAULT '0' NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_subscriptions" (
	"tenant_id" text PRIMARY KEY NOT NULL,
	"tier_id" text,
	"billing_cycle" text DEFAULT 'monthly' NOT NULL,
	"start_date" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "url_performance" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"target_url" text NOT NULL,
	"date" date NOT NULL,
	"gsc_clicks" integer,
	"gsc_impressions" integer,
	"position" numeric,
	"sistrix_vi" numeric
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"role" text DEFAULT 'Editor' NOT NULL,
	"password" text,
	"password_changed" boolean DEFAULT false
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blacklist" ADD CONSTRAINT "blacklist_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "config" ADD CONSTRAINT "config_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_log" ADD CONSTRAINT "content_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_log" ADD CONSTRAINT "content_log_keyword_id_keyword_map_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."keyword_map"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_log" ADD CONSTRAINT "content_log_editor_id_users_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_log_body" ADD CONSTRAINT "content_log_body_content_log_id_content_log_id_fk" FOREIGN KEY ("content_log_id") REFERENCES "public"."content_log"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_config" ADD CONSTRAINT "cost_config_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_requests" ADD CONSTRAINT "feature_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_requests" ADD CONSTRAINT "feature_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keyword_map" ADD CONSTRAINT "keyword_map_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keyword_map_editors" ADD CONSTRAINT "keyword_map_editors_keyword_id_keyword_map_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."keyword_map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keyword_map_editors" ADD CONSTRAINT "keyword_map_editors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keyword_ranking_history" ADD CONSTRAINT "keyword_ranking_history_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keyword_ranking_history" ADD CONSTRAINT "keyword_ranking_history_keyword_id_keyword_map_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."keyword_map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_tier_id_pricing_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."pricing_tiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "url_performance" ADD CONSTRAINT "url_performance_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_tenant_idx" ON "audit_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs" USING btree ("tenant_id","timestamp");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("tenant_id","action");--> statement-breakpoint
CREATE INDEX "blacklist_tenant_idx" ON "blacklist" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "blacklist_kw_lookup_idx" ON "blacklist" USING btree ("tenant_id","keyword");--> statement-breakpoint
CREATE INDEX "blacklist_url_lookup_idx" ON "blacklist" USING btree ("tenant_id","target_url");--> statement-breakpoint
CREATE INDEX "config_tenant_idx" ON "config" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "content_log_tenant_idx" ON "content_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "content_log_logged_url_idx" ON "content_log" USING btree ("logged_url");--> statement-breakpoint
CREATE INDEX "content_log_keyword_idx" ON "content_log" USING btree ("keyword_id");--> statement-breakpoint
CREATE INDEX "content_log_time_idx" ON "content_log" USING btree ("tenant_id","time_created");--> statement-breakpoint
CREATE INDEX "cost_config_tenant_idx" ON "cost_config" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "feature_requests_tenant_idx" ON "feature_requests" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "feature_requests_status_idx" ON "feature_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "feature_requests_type_idx" ON "feature_requests" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "keyword_map_keyword_url_tenant_idx" ON "keyword_map" USING btree ("keyword","target_url","tenant_id");--> statement-breakpoint
CREATE INDEX "keyword_map_tenant_idx" ON "keyword_map" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "keyword_map_url_idx" ON "keyword_map" USING btree ("target_url");--> statement-breakpoint
CREATE INDEX "keyword_map_status_idx" ON "keyword_map" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "keyword_map_priority_idx" ON "keyword_map" USING btree ("tenant_id","priority_score");--> statement-breakpoint
CREATE INDEX "keyword_map_main_kw_idx" ON "keyword_map" USING btree ("tenant_id","target_url","main_keyword");--> statement-breakpoint
CREATE INDEX "keyword_map_editors_user_idx" ON "keyword_map_editors" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "keyword_ranking_kw_date_tenant_idx" ON "keyword_ranking_history" USING btree ("keyword_id","date","tenant_id");--> statement-breakpoint
CREATE INDEX "keyword_ranking_tenant_idx" ON "keyword_ranking_history" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "keyword_ranking_date_idx" ON "keyword_ranking_history" USING btree ("tenant_id","date");--> statement-breakpoint
CREATE INDEX "keyword_ranking_kw_date_combined_idx" ON "keyword_ranking_history" USING btree ("tenant_id","keyword_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "url_performance_url_date_tenant_idx" ON "url_performance" USING btree ("target_url","date","tenant_id");--> statement-breakpoint
CREATE INDEX "url_performance_tenant_idx" ON "url_performance" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "url_performance_date_idx" ON "url_performance" USING btree ("tenant_id","date");--> statement-breakpoint
CREATE INDEX "url_performance_url_date_combined_idx" ON "url_performance" USING btree ("tenant_id","target_url","date");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_tenant_idx" ON "users" USING btree ("email","tenant_id");