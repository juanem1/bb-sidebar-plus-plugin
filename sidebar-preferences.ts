import { z } from "zod";

export const PROJECT_VISIBILITY_CHANNEL = "project-visibility-changed";
export const PROJECT_VISIBILITY_KV_KEY = "sidebar-plus:project-visibility";
export const PROJECT_VISIBILITY_STATE_VERSION = 1 as const;

const projectIdSchema = z.string().min(1);

function hasDuplicateProjectIds(projectIds: readonly string[]): boolean {
  return new Set(projectIds).size !== projectIds.length;
}

const projectIdListSchema = z.array(projectIdSchema).superRefine((value, context) => {
  if (hasDuplicateProjectIds(value)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Project ID lists must not contain duplicates.",
    });
  }
});

export const projectVisibilityStateSchema = z
  .object({
    version: z.literal(PROJECT_VISIBILITY_STATE_VERSION),
    revision: z.number().int().nonnegative(),
    pinnedProjectIds: projectIdListSchema,
    hiddenProjectIds: projectIdListSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const hiddenProjectIds = new Set(value.hiddenProjectIds);
    for (const projectId of value.pinnedProjectIds) {
      if (hiddenProjectIds.has(projectId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Project ${projectId} cannot be both pinned and hidden.`,
        });
      }
    }
  });

export const projectVisibilityResultSchema = z
  .object({
    snapshot: projectVisibilityStateSchema,
  })
  .strict();

export const projectVisibilityActionSchema = z.enum([
  "pin",
  "unpin",
  "hide",
  "show",
]);

export const projectVisibilitySignalSchema = z
  .object({
    action: projectVisibilityActionSchema,
    projectId: projectIdSchema,
    snapshot: projectVisibilityStateSchema,
  })
  .strict();

export type ProjectVisibilityAction = z.infer<typeof projectVisibilityActionSchema>;
export type ProjectVisibilityResult = z.infer<typeof projectVisibilityResultSchema>;
export type ProjectVisibilitySignal = z.infer<typeof projectVisibilitySignalSchema>;
export type ProjectVisibilityState = z.infer<typeof projectVisibilityStateSchema>;

export const projectVisibilitySnapshotSchema = projectVisibilityStateSchema;

export function createInitialProjectVisibilityState(): ProjectVisibilityState {
  return {
    version: PROJECT_VISIBILITY_STATE_VERSION,
    revision: 0,
    pinnedProjectIds: [],
    hiddenProjectIds: [],
  };
}
