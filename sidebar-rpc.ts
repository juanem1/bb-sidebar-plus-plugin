import { defineRpcContract } from "@get-bb/plugin-sdk";
import { z } from "zod";
import { projectIdSchema, projectVisibilityResultSchema } from "./sidebar-preferences";

const projectInput = z.object({ projectId: projectIdSchema }).strict();
const moveInput = z.object({ projectId: projectIdSchema, beforeProjectId: projectIdSchema.nullable() }).strict();

export const sidebarRpcContract = defineRpcContract({
  getProjectVisibility: { input: z.null(), output: projectVisibilityResultSchema },
  syncProjects: { input: z.null(), output: projectVisibilityResultSchema },
  pinProject: { input: projectInput, output: projectVisibilityResultSchema },
  unpinProject: { input: projectInput, output: projectVisibilityResultSchema },
  hideProject: { input: projectInput, output: projectVisibilityResultSchema },
  showProject: { input: projectInput, output: projectVisibilityResultSchema },
  moveProject: { input: moveInput, output: projectVisibilityResultSchema },
  movePinnedProject: { input: moveInput, output: projectVisibilityResultSchema },
  sortProjectsByName: { input: z.null(), output: projectVisibilityResultSchema },
  selectManualOrder: { input: z.null(), output: projectVisibilityResultSchema },
  setGrouping: { input: z.object({ grouping: z.enum(["project", "none"]) }).strict(), output: projectVisibilityResultSchema },
  setShowSearch: { input: z.object({ showSearch: z.boolean() }).strict(), output: projectVisibilityResultSchema },
  collapseProject: { input: projectInput, output: projectVisibilityResultSchema },
  expandProject: { input: projectInput, output: projectVisibilityResultSchema },
});
