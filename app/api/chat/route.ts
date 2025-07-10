import { BedrockAgentRuntimeClient, InvokeAgentCommand } from "@aws-sdk/client-bedrock-agent-runtime"

export const maxDuration = 30

// Initialize Bedrock Agent Runtime Client with better error handling
const bedrockAgentClient = new BedrockAgentRuntimeClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()
    console.log("Received messages:", messages)

    // Get the latest user message
    const userMessage = messages[messages.length - 1]?.content || ""
    console.log("User message:", userMessage)

    // Validate environment variables
    const agentId = process.env.BEDROCK_AGENT_ID
    const agentAliasId = process.env.BEDROCK_AGENT_ALIAS_ID || "TSTALIASID"
    const region = process.env.AWS_REGION

    console.log("Agent configuration:", { agentId, agentAliasId, region })

    if (!agentId) {
      throw new Error("BEDROCK_AGENT_ID environment variable is required")
    }

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error("AWS credentials are required")
    }

    // Generate a unique session ID
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    console.log("Session ID:", sessionId)

    const command = new InvokeAgentCommand({
      agentId,
      agentAliasId,
      sessionId,
      inputText: userMessage,
    })

    console.log("Invoking Bedrock Agent...")
    const response = await bedrockAgentClient.send(command)
    console.log("Agent response received")

    // Create a readable stream from the agent response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullResponse = ""

          if (response.completion) {
            for await (const chunk of response.completion) {
              console.log("Processing chunk:", chunk)

              if (chunk.chunk?.bytes) {
                const text = new TextDecoder().decode(chunk.chunk.bytes)
                fullResponse += text
                console.log("Chunk text:", text)

                // Send chunk in AI SDK compatible format
                const data = {
                  id: `chunk-${Date.now()}`,
                  object: "chat.completion.chunk",
                  created: Date.now(),
                  model: "bedrock-agent",
                  choices: [
                    {
                      index: 0,
                      delta: { content: text },
                      finish_reason: null,
                    },
                  ],
                }
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
              }
            }
          } else {
            console.log("No completion in response")
            // If no streaming completion, send a default message
            const fallbackText = "I received your message but couldn't generate a response."
            const data = {
              id: `chunk-${Date.now()}`,
              object: "chat.completion.chunk",
              created: Date.now(),
              model: "bedrock-agent",
              choices: [
                {
                  index: 0,
                  delta: { content: fallbackText },
                  finish_reason: null,
                },
              ],
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
          }

          console.log("Full response:", fullResponse)

          // Send final chunk
          const finalData = {
            id: `chunk-${Date.now()}`,
            object: "chat.completion.chunk",
            created: Date.now(),
            model: "bedrock-agent",
            choices: [
              {
                index: 0,
                delta: {},
                finish_reason: "stop",
              },
            ],
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalData)}\n\n`))
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          controller.close()
        } catch (streamError) {
          console.error("Streaming error:", streamError)
          controller.error(streamError)
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    console.error("Detailed error invoking Bedrock Agent:", error)

    // Return more detailed error information
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const errorDetails = {
      error: "Failed to invoke Bedrock Agent",
      details: errorMessage,
      timestamp: new Date().toISOString(),
      config: {
        hasAgentId: !!process.env.BEDROCK_AGENT_ID,
        hasCredentials: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
        region: process.env.AWS_REGION,
      },
    }

    return new Response(JSON.stringify(errorDetails), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
