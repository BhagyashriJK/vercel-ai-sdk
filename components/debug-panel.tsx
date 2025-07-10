"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle, Settings } from "lucide-react"

export function DebugPanel() {
  const [testResult, setTestResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const testConfiguration = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/test-bedrock")
      const result = await response.json()
      setTestResult(result)
    } catch (error) {
      setTestResult({
        success: false,
        error: "Failed to test configuration",
        details: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto mb-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Debug Panel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={testConfiguration} disabled={isLoading}>
          {isLoading ? "Testing..." : "Test Bedrock Configuration"}
        </Button>

        {testResult && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {testResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              <Badge variant={testResult.success ? "default" : "destructive"}>
                {testResult.success ? "Success" : "Failed"}
              </Badge>
            </div>

            <div className="bg-gray-100 p-3 rounded text-sm">
              <pre>{JSON.stringify(testResult, null, 2)}</pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
