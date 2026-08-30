import { randomUUID } from "node:crypto";

import { GenerationFailedError, InvalidCheckpointError } from "./errors.js";
import type { ResolvedStoryContext, StoryWorkspace } from "./workspace.js";
import type {
  AdvisoryStateSnapshot,
  NewCheckpointInput,
  RunMetadata,
  StoryCheckpoint,
} from "./types.js";

export interface GeneratedStory {
  readonly storyContent: string;
  readonly runMetadata?: RunMetadata;
  readonly stateSnapshot?: AdvisoryStateSnapshot;
}

export interface StoryAgent {
  generate(input: {
    readonly context: ResolvedStoryContext | null;
    readonly userIntent: string;
  }): unknown | Promise<unknown>;
}

export interface GenerationRequest {
  readonly userIntent: string;
  readonly fromNodeId?: string;
  readonly nodeId?: string;
}

export class StoryGenerationAdapter {
  constructor(
    private readonly workspace: StoryWorkspace,
    private readonly agent: StoryAgent,
  ) {}

  async generateCheckpoint(request: GenerationRequest): Promise<StoryCheckpoint> {
    const context = request.fromNodeId ? this.workspace.resolveContext(request.fromNodeId) : null;
    let result: unknown;
    try {
      result = await this.agent.generate({
        context,
        userIntent: request.userIntent,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new GenerationFailedError(`story generation failed: ${message}`);
    }

    const generated: unknown = typeof result === "string" ? { storyContent: result } : result;
    if (!isGeneratedStory(generated) || !generated.storyContent.trim()) {
      throw new GenerationFailedError("Agent returned empty story content");
    }

    const checkpointInput: NewCheckpointInput = {
      nodeId: request.nodeId ?? randomUUID(),
      userIntent: request.userIntent,
      storyContent: generated.storyContent,
      ...(generated.runMetadata === undefined ? {} : { runMetadata: generated.runMetadata }),
      ...(generated.stateSnapshot === undefined ? {} : { stateSnapshot: generated.stateSnapshot }),
    };
    try {
      return request.fromNodeId === undefined
        ? this.workspace.createRoot(checkpointInput)
        : this.workspace.continueFrom(request.fromNodeId, checkpointInput);
    } catch (error) {
      if (error instanceof InvalidCheckpointError) {
        throw new GenerationFailedError(`Agent returned an invalid story result: ${error.message}`);
      }
      throw error;
    }
  }
}

function isGeneratedStory(value: unknown): value is GeneratedStory {
  return (
    typeof value === "object" &&
    value !== null &&
    "storyContent" in value &&
    typeof value.storyContent === "string"
  );
}
