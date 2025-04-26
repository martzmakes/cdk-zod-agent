import {
  HumanMessage,
  AIMessage,
  BaseMessageLike,
} from "@langchain/core/messages";
import { MessagesAnnotation } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatBedrockConverse } from "@langchain/aws";
import { fromSSO } from "@aws-sdk/credential-provider-sso";
import { RunnableConfig } from "@langchain/core/runnables";
import { heroClient } from "./package/client/client";

const generateTools = <T extends Record<string, any>>(client: T) => {
  return Object.keys(client)
    .map((key) => {
      const endpoint = client[key as keyof T];
      const requestSchema = endpoint.requestSchema;
      const pathParametersSchema = endpoint.pathParametersSchema;
      const combinedSchema = z.object({
        pathParameters: pathParametersSchema || z.object({}),
        body: requestSchema || z.null(),
      });

      const endpointTool = tool(
        async ({ pathParameters, body }: z.infer<typeof combinedSchema>) => {
          if (body) {
            Object.keys(body).forEach((key) => {
              if (Array.isArray(body[key]) && body[key].length === 0) {
                delete body[key];
              }
            });
          }
          if (requestSchema && requestSchema._type === "null") {
            body = null;
          }
          try {
            const data = await endpoint({
              pathParameters,
              body,
            });
            return JSON.stringify(data);
          } catch (err: any) {
            return `Error fetching: ${err.message}`;
          }
        },
        {
          name: endpoint.endpointName,
          description: endpoint.description,
          schema: combinedSchema,
        }
      );
      return endpointTool;
    })
    .filter((tool) => tool !== null);
};

const tools = [...generateTools(heroClient(process.env.API_ID!))];

const prompt = (
  state: typeof MessagesAnnotation.State,
  config: RunnableConfig
): BaseMessageLike[] => {
  const userName = config.configurable?.userName || "Human";
  const userId = config.configurable?.userId;
  const systemMsg = `You are a helpful assistant. Address the user as ${userName}.  Their userId is ${userId}.`;
  return [{ role: "system", content: systemMsg }, ...state.messages];
};

console.log(`Tools available: ${tools.map((t) => t.name).join(", ")}`);

const llm = new ChatBedrockConverse({
  region: process.env.AWS_DEFAULT_REGION || "us-east-1",
  credentials: fromSSO({ profile: process.env.AWS_PROFILE }), // you could also use fromEnv()
  // model: "amazon.nova-micro-v1:0", // nova micro did not work well
  model: "us.anthropic.claude-3-5-haiku-20241022-v1:0",
  temperature: 0.5,
});

export const agent = createReactAgent({
  llm,
  tools,
  prompt,
});

const main = async () => {
  try {
    // === Timing and tool call tracking ===
    const startTime = process.hrtime();

    const result = await agent.invoke(
      {
        messages: [new HumanMessage(`What can you do?`)],
      },
      {
        configurable: {
          userName: "Matt",
          userId: "9efe72ed-b182-46b1-bc96-f125b7042599",
        },
      }
    );

    const endTime = process.hrtime(startTime);
    const totalTimeMs = endTime[0] * 1e3 + endTime[1] / 1e6;

    // Log agent messages and count tool calls
    let toolCallCount = 0;

    for (const [i, msg] of result.messages.entries()) {
      if (msg._getType && msg._getType() === "human") {
        console.log(`\n[User]: ${msg.content}`);
      } else if (msg._getType && msg._getType() === "ai") {
        // Print agent's rationale/thoughts
        console.log(`\n[Agent]: ${msg.content}`);
        // Only access tool_calls if msg is an AIMessage
        const aiMsg = msg as AIMessage;
        if (Array.isArray(aiMsg.tool_calls) && aiMsg.tool_calls.length > 0) {
          toolCallCount += aiMsg.tool_calls.length;
          for (const call of aiMsg.tool_calls) {
            console.log(`[Tool Call]: ${JSON.stringify(call, null, 2)}`);
          }
        }
      } else {
        // Fallback for other message types
        console.log(`\n[Message]: ${JSON.stringify(msg, null, 2)}`);
      }
    }

    // === Token usage and cost summary ===
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    for (const msg of result.messages) {
      if (msg._getType && msg._getType() === "ai" && msg.response_metadata) {
        // Try all possible locations for token usage
        const aiMsg = msg as AIMessage;
        const usage =
          msg.response_metadata.tokenUsage ||
          msg.response_metadata.usage ||
          aiMsg.usage_metadata;
        if (usage) {
          // OpenAI style: { promptTokens, completionTokens }
          if (
            usage.promptTokens !== undefined &&
            usage.completionTokens !== undefined
          ) {
            totalPromptTokens += usage.promptTokens;
            totalCompletionTokens += usage.completionTokens;
          }
          // OpenAI style: { prompt_tokens, completion_tokens }
          else if (
            usage.prompt_tokens !== undefined &&
            usage.completion_tokens !== undefined
          ) {
            totalPromptTokens += usage.prompt_tokens;
            totalCompletionTokens += usage.completion_tokens;
          }
          // LangChain style: { input_tokens, output_tokens }
          else if (
            usage.input_tokens !== undefined &&
            usage.output_tokens !== undefined
          ) {
            totalPromptTokens += usage.input_tokens;
            totalCompletionTokens += usage.output_tokens;
          }
        }
      }
    }

    const inputCost = (totalPromptTokens / 1000) * 0.005; // $0.005 per 1K input tokens
    const outputCost = (totalCompletionTokens / 1000) * 0.015; // $0.015 per 1K output tokens
    const totalCost = inputCost + outputCost;

    console.log("\n=== Token Usage Summary ===");
    console.log(`Prompt tokens: ${totalPromptTokens}`);
    console.log(`Completion tokens: ${totalCompletionTokens}`);
    console.log(`Total tokens: ${totalPromptTokens + totalCompletionTokens}`);
    console.log(
      `Estimated cost: $${totalCost.toFixed(6)} (input: $${inputCost.toFixed(
        6
      )}, output: $${outputCost.toFixed(6)})`
    );

    // === Timing and tool call summary ===
    console.log("\n=== Timing & Tool Call Summary ===");
    console.log(`Total elapsed time: ${totalTimeMs.toFixed(2)} ms`);
    console.log(`Number of tool calls: ${toolCallCount}`);
  } catch (e) {
    console.error("Error invoking app:", e);
  }
};

// main();
