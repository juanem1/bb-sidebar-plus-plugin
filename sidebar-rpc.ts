import { defineRpcContract } from "@get-bb/plugin-sdk";
import { z } from "zod";
import { projectVisibilityResultSchema } from "./sidebar-preferences";

const projectIdInputSchema = z
  .object({
    projectId: z.string().min(1),
  })
  .strict();

export const sidebarRpcContract = defineRpcContract({
  getProjectVisibility: {
    input: z.null(),
    output: projectVisibilityResultSchema,
  },
  pinProject: {
    input: projectIdInputSchema,
    output: projectVisibilityResultSchema,
  },
  unpinProject: {
    input: projectIdInputSchema,
    output: projectVisibilityResultSchema,
  },
  hideProject: {
    input: projectIdInputSchema,
    output: projectVisibilityResultSchema,
  },
  showProject: {
    input: projectIdInputSchema,
    output: projectVisibilityResultSchema,
  },
});
