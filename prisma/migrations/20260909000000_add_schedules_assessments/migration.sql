-- ============================================================
-- G3 — AVALIAÇÕES E HORÁRIOS (add_schedules_assessments)
-- ------------------------------------------------------------
-- 1) Renomeia o modelo Evaluation  -> Assessment  (tabela assessments)
--    e EvaluationGrade             -> Grade       (tabela grades)
--    preservando TODOS os dados existentes (ALTER TABLE RENAME).
-- 2) Renomeia coluna evaluationId -> assessmentId em grades.
-- 3) Renomeia constraints e índices para manter nomes coerentes.
-- 4) Adiciona constraints CHECK de QUALIDADE DE DADOS:
--    - assessments: weight > 0, maxScore > 0
--    - grades:      0 <= score <= 100
--    - schedules:   startTime < endTime  (HH:mm zero-padded -> comparação lexicográfica válida)
--    - results:     average entre 0 e 100 (ou NULL)
-- ============================================================

-- 1) Tabelas
ALTER TABLE "evaluations" RENAME TO "assessments";
ALTER TABLE "evaluation_grades" RENAME TO "grades";

-- 2) Coluna de ligação Grade -> Assessment
ALTER TABLE "grades" RENAME COLUMN "evaluationId" TO "assessmentId";

-- 3) Chaves primárias
ALTER TABLE "assessments" RENAME CONSTRAINT "evaluations_pkey" TO "assessments_pkey";
ALTER TABLE "grades" RENAME CONSTRAINT "evaluation_grades_pkey" TO "grades_pkey";

-- 4) Foreign keys de assessments
ALTER TABLE "assessments" RENAME CONSTRAINT "evaluations_schoolId_fkey" TO "assessments_schoolId_fkey";
ALTER TABLE "assessments" RENAME CONSTRAINT "evaluations_academicYearId_fkey" TO "assessments_academicYearId_fkey";
ALTER TABLE "assessments" RENAME CONSTRAINT "evaluations_termId_fkey" TO "assessments_termId_fkey";
ALTER TABLE "assessments" RENAME CONSTRAINT "evaluations_classId_fkey" TO "assessments_classId_fkey";
ALTER TABLE "assessments" RENAME CONSTRAINT "evaluations_subjectId_fkey" TO "assessments_subjectId_fkey";
ALTER TABLE "assessments" RENAME CONSTRAINT "evaluations_teacherId_fkey" TO "assessments_teacherId_fkey";

-- 5) Foreign keys de grades
ALTER TABLE "grades" RENAME CONSTRAINT "evaluation_grades_evaluationId_fkey" TO "grades_assessmentId_fkey";
ALTER TABLE "grades" RENAME CONSTRAINT "evaluation_grades_studentId_fkey" TO "grades_studentId_fkey";

-- 6) Índices de assessments
ALTER INDEX "evaluations_schoolId_idx" RENAME TO "assessments_schoolId_idx";
ALTER INDEX "evaluations_academicYearId_idx" RENAME TO "assessments_academicYearId_idx";
ALTER INDEX "evaluations_termId_idx" RENAME TO "assessments_termId_idx";
ALTER INDEX "evaluations_classId_idx" RENAME TO "assessments_classId_idx";
ALTER INDEX "evaluations_subjectId_idx" RENAME TO "assessments_subjectId_idx";
ALTER INDEX "evaluations_teacherId_idx" RENAME TO "assessments_teacherId_idx";
ALTER INDEX "evaluations_date_idx" RENAME TO "assessments_date_idx";
ALTER INDEX "evaluations_status_idx" RENAME TO "assessments_status_idx";
ALTER INDEX "evaluations_schoolId_classId_idx" RENAME TO "assessments_schoolId_classId_idx";
ALTER INDEX "evaluations_schoolId_subjectId_idx" RENAME TO "assessments_schoolId_subjectId_idx";
ALTER INDEX "evaluations_schoolId_teacherId_idx" RENAME TO "assessments_schoolId_teacherId_idx";

-- 7) Índices de grades
ALTER INDEX "evaluation_grades_studentId_idx" RENAME TO "grades_studentId_idx";
ALTER INDEX "evaluation_grades_evaluationId_idx" RENAME TO "grades_assessmentId_idx";
ALTER INDEX "evaluation_grades_evaluationId_studentId_key" RENAME TO "grades_assessmentId_studentId_key";

-- 8) QUALIDADE DE DADOS — constraints CHECK
ALTER TABLE "assessments"
  ADD CONSTRAINT "check_assessment_weight_positive" CHECK ("weight" > 0),
  ADD CONSTRAINT "check_assessment_max_score_positive" CHECK ("maxScore" > 0);

ALTER TABLE "grades"
  ADD CONSTRAINT "check_grade_score_range" CHECK ("score" >= 0 AND "score" <= 100);

ALTER TABLE "schedules"
  ADD CONSTRAINT "check_schedule_time_range" CHECK ("startTime" < "endTime");

ALTER TABLE "results"
  ADD CONSTRAINT "check_result_average_range" CHECK ("average" IS NULL OR ("average" >= 0 AND "average" <= 100));