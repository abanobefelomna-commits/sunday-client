CREATE TABLE IF NOT EXISTS "friday_preparations" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "attendanceChecked" boolean NOT NULL DEFAULT false,
  "lessonTopic" text NOT NULL,
  "prepDate" date NOT NULL,
  "content" text NOT NULL,
  "submittedAt" timestamptz NOT NULL DEFAULT now(),
  "status" text NOT NULL DEFAULT 'submitted',
  UNIQUE ("userId", "prepDate")
);
