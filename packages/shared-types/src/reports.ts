import { z } from 'zod';

export const ReportKind = z.enum(['security', 'cost', 'compliance']);
export type ReportKind = z.infer<typeof ReportKind>;

export const ReportStatus = z.enum(['ready', 'generating', 'scheduled']);
export type ReportStatus = z.infer<typeof ReportStatus>;

export const Report = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  kind: ReportKind,
  status: ReportStatus,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Report = z.infer<typeof Report>;

export const CreateReportRequest = Report.omit({
  id: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateReportRequest = z.infer<typeof CreateReportRequest>;

export const ListReportsQuery = z.object({
  q: z.string().optional(),
  kind: ReportKind.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListReportsQuery = z.infer<typeof ListReportsQuery>;

export const ListReportsResponse = z.object({
  data: z.array(Report),
});
export type ListReportsResponse = z.infer<typeof ListReportsResponse>;
