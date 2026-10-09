import { z } from "zod";

export const PROJECT_VISIBILITY_CHANNEL = "project-visibility-changed";
export const PROJECT_VISIBILITY_KV_KEY = "sidebar-plus:project-visibility";
export const PROJECT_VISIBILITY_STATE_VERSION = 2 as const;

export const projectIdSchema = z.string().min(1);
export const projectIdListSchema = z.array(projectIdSchema).superRefine((ids, context) => {
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", message: "Project IDs must not contain duplicates." });
  }
});

const membershipsSchema = z.object({
  revision: z.number().int().nonnegative(),
  pinnedProjectIds: projectIdListSchema,
  hiddenProjectIds: projectIdListSchema,
});

function validateMemberships(
  value: { pinnedProjectIds: readonly string[]; hiddenProjectIds: readonly string[] },
  context: z.RefinementCtx,
): void {
  const hidden: ReadonlySet<string> = new Set(value.hiddenProjectIds);
  if (value.pinnedProjectIds.some((id) => hidden.has(id))) {
    context.addIssue({ code: "custom", message: "Projects cannot be both pinned and hidden." });
  }
}

export const legacyVisibilityStateSchema = membershipsSchema.extend({
  version: z.literal(1),
}).strict().superRefine(validateMemberships);

export const projectVisibilityStateSchema = membershipsSchema.extend({
  version: z.literal(PROJECT_VISIBILITY_STATE_VERSION),
  projectOrder: projectIdListSchema,
  sorting: z.enum(["name", "manual"]),
  grouping: z.enum(["project", "none"]),
  showSearch: z.boolean(),
  collapsedProjectIds: projectIdListSchema,
}).strict().superRefine(validateMemberships);

export const projectVisibilityResultSchema = z.object({
  snapshot: projectVisibilityStateSchema,
}).strict();

export type ProjectVisibilityState = z.infer<typeof projectVisibilityStateSchema>;
export type ProjectVisibilityResult = z.infer<typeof projectVisibilityResultSchema>;

export function createInitialProjectVisibilityState(): ProjectVisibilityState {
  return {
    version: PROJECT_VISIBILITY_STATE_VERSION,
    revision: 0,
    pinnedProjectIds: [],
    hiddenProjectIds: [],
    projectOrder: [],
    sorting: "name",
    grouping: "project",
    showSearch: false,
    collapsedProjectIds: [],
  };
}

/** Validated v1 migration preserves visibility; malformed data is never reset. */
export function parseStoredPreferences(value: unknown): ProjectVisibilityState {
  const legacy = legacyVisibilityStateSchema.safeParse(value);
  if (legacy.success) {
    return { ...createInitialProjectVisibilityState(), ...legacy.data, version: 2 };
  }
  return projectVisibilityStateSchema.parse(value);
}
