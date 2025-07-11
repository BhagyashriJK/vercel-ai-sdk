import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from "@aws-sdk/client-bedrock-agent-runtime";

export const maxDuration = 30;

const bedrockAgentClient = new BedrockAgentRuntimeClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    console.log("Received messages:", messages);

    const userMessage = messages[messages.length - 1]?.content || "";
    console.log("User message:", userMessage);

    const agentId = process.env.BEDROCK_AGENT_ID;
    const agentAliasId = process.env.BEDROCK_AGENT_ALIAS_ID || "TSTALIASID";

    if (!agentId) {
      throw new Error("BEDROCK_AGENT_ID environment variable is required");
    }

    const sessionId = "session-122132";

    const command = new InvokeAgentCommand({
      agentId,
      agentAliasId,
      sessionId,
      inputText: userMessage,
      enableTrace: true,
    });

    console.log("Invoking Bedrock Agent...");
    const response = await bedrockAgentClient.send(command);

    // Collect the full response first (since Bedrock Agent sends it as one chunk)
    let fullResponse = "";
    if (response.completion) {
      for await (const chunk of response.completion) {
        if (chunk.chunk?.bytes) {
          const text = new TextDecoder().decode(chunk.chunk.bytes);
          fullResponse += text;
        }
        if (chunk.trace) {
          console.log("trace", chunk.trace?.trace);
        }
      }
    }

    console.log(
      "Full response received, now streaming word by word:",
      fullResponse
    );

    // Now stream word by word to simulate real streaming
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Split into words for more natural streaming
          const words = fullResponse.split(" ");

          for (let i = 0; i < words.length; i++) {
            const word = words[i] + (i < words.length - 1 ? " " : "");
            console.log("Streaming word:", word);

            // Send each word in AI SDK data stream format
            controller.enqueue(encoder.encode(`0:${JSON.stringify(word)}\n`));

            // Realistic typing delay (100-200ms per word)
            await new Promise((resolve) => setTimeout(resolve, 150));
          }

          // Send end marker
          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "x-vercel-ai-data-stream": "v1",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Detailed error invoking Bedrock Agent:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        error: "Failed to invoke Bedrock Agent",
        details: errorMessage,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
