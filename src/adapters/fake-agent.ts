import type { GeneratedStory, StoryAgent } from "../core/agent.js";
import type { ResolvedStoryContext } from "../core/workspace.js";

export type FakeAgentOutput = GeneratedStory | string | Error | Record<string, unknown> | null;

export class FakeAgent implements StoryAgent {
  readonly calls: Array<{
    readonly context: ResolvedStoryContext | null;
    readonly userIntent: string;
  }> = [];

  private readonly outputs: unknown[];

  constructor(outputs: readonly FakeAgentOutput[]) {
    this.outputs = [...outputs];
  }

  async generate(input: {
    readonly context: ResolvedStoryContext | null;
    readonly userIntent: string;
  }): Promise<unknown> {
    this.calls.push(input);
    if (this.outputs.length === 0) {
      throw new Error("FakeAgent has no configured result");
    }
    const next = this.outputs.shift();
    if (next instanceof Error) {
      throw next;
    }
    return next;
  }
}
