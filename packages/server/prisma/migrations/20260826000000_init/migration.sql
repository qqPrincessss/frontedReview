-- CreateEnum
CREATE TYPE "review_status" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "severity" AS ENUM ('ERROR', 'WARNING', 'INFO');
CREATE TYPE "review_run_status" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "parse_status" AS ENUM ('SUCCEEDED', 'FALLBACK', 'FAILED');
CREATE TYPE "feedback_rating" AS ENUM ('UP', 'DOWN');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "diff_content" TEXT NOT NULL,
    "language" VARCHAR(30),
    "branch_from" VARCHAR(255),
    "branch_to" VARCHAR(255),
    "summary" TEXT,
    "overall_score" SMALLINT,
    "dimension_scores" JSONB,
    "highlights" JSONB,
    "status" "review_status" NOT NULL DEFAULT 'PENDING',
    "error_code" VARCHAR(80),
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reviews_overall_score_check" CHECK ("overall_score" IS NULL OR "overall_score" BETWEEN 0 AND 100)
);

CREATE TABLE "review_issues" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "ordinal" SMALLINT NOT NULL,
    "file_path" VARCHAR(500) NOT NULL,
    "line_range" VARCHAR(50),
    "severity" "severity" NOT NULL,
    "dimension" VARCHAR(50) NOT NULL,
    "what" TEXT NOT NULL,
    "why" TEXT NOT NULL,
    "suggestion" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_issues_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "review_issues_ordinal_check" CHECK ("ordinal" >= 1)
);

CREATE TABLE "review_runs" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "attempt_no" SMALLINT NOT NULL,
    "provider" VARCHAR(30) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "prompt_version" VARCHAR(100),
    "parameters" JSONB,
    "status" "review_run_status" NOT NULL DEFAULT 'PENDING',
    "parse_status" "parse_status",
    "raw_response" TEXT,
    "error_code" VARCHAR(80),
    "error_message" TEXT,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "latency_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "review_runs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "review_runs_attempt_no_check" CHECK ("attempt_no" >= 1),
    CONSTRAINT "review_runs_input_tokens_check" CHECK ("input_tokens" IS NULL OR "input_tokens" >= 0),
    CONSTRAINT "review_runs_output_tokens_check" CHECK ("output_tokens" IS NULL OR "output_tokens" >= 0),
    CONSTRAINT "review_runs_latency_ms_check" CHECK ("latency_ms" IS NULL OR "latency_ms" >= 0)
);

CREATE TABLE "review_feedback" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "rating" "feedback_rating" NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "reviews_user_id_created_at_idx" ON "reviews"("user_id", "created_at" DESC);
CREATE INDEX "reviews_status_created_at_idx" ON "reviews"("status", "created_at");
CREATE UNIQUE INDEX "review_issues_review_id_ordinal_key" ON "review_issues"("review_id", "ordinal");
CREATE INDEX "review_issues_review_id_severity_idx" ON "review_issues"("review_id", "severity");
CREATE INDEX "review_issues_review_id_dimension_idx" ON "review_issues"("review_id", "dimension");
CREATE UNIQUE INDEX "review_runs_review_id_attempt_no_key" ON "review_runs"("review_id", "attempt_no");
CREATE INDEX "review_runs_review_id_created_at_idx" ON "review_runs"("review_id", "created_at");
CREATE INDEX "review_runs_status_created_at_idx" ON "review_runs"("status", "created_at");
CREATE UNIQUE INDEX "review_feedback_review_id_user_id_key" ON "review_feedback"("review_id", "user_id");
CREATE INDEX "review_feedback_user_id_created_at_idx" ON "review_feedback"("user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "reviews"
ADD CONSTRAINT "reviews_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "review_issues"
ADD CONSTRAINT "review_issues_review_id_fkey"
FOREIGN KEY ("review_id") REFERENCES "reviews"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "review_runs"
ADD CONSTRAINT "review_runs_review_id_fkey"
FOREIGN KEY ("review_id") REFERENCES "reviews"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "review_feedback"
ADD CONSTRAINT "review_feedback_review_id_fkey"
FOREIGN KEY ("review_id") REFERENCES "reviews"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "review_feedback"
ADD CONSTRAINT "review_feedback_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
