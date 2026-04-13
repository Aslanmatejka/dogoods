/**
 * AI Agent — routes AI helper calls through the FastAPI backend at /api/ai/chat.
 * Used by FoodCard for recipe suggestions. Main chat uses aiChatService instead.
 */

const API_BASE = '/api/ai'

// Rate limiting (client-side courtesy throttle)
const rateLimitStore = new Map()

function checkRateLimit(clientId = 'default') {
    const now = Date.now()
    const timeWindow = 60000
    const maxRequests = 50

    if (!rateLimitStore.has(clientId)) {
        rateLimitStore.set(clientId, { requests: [], windowStart: now })
    }

    const clientData = rateLimitStore.get(clientId)
    clientData.requests = clientData.requests.filter(time => now - time < timeWindow)

    if (clientData.requests.length >= maxRequests) {
        throw new Error('Rate limit exceeded. Please try again later.')
    }
    clientData.requests.push(now)
}

// Circuit breaker pattern
class CircuitBreaker {
    constructor(failureThreshold = 5, resetTimeout = 60000) {
        this.failureThreshold = failureThreshold
        this.resetTimeout = resetTimeout
        this.failureCount = 0
        this.state = 'CLOSED'
        this.nextAttempt = Date.now()
    }

    async executeRequest(request) {
        if (this.state === 'OPEN') {
            if (Date.now() < this.nextAttempt) {
                throw new Error('Circuit breaker is OPEN')
            }
            this.state = 'HALF_OPEN'
        }

        try {
            const result = await request()
            this.onSuccess()
            return result
        } catch (error) {
            this.onFailure()
            throw error
        }
    }

    onSuccess() {
        this.failureCount = 0
        this.state = 'CLOSED'
    }

    onFailure() {
        this.failureCount++
        if (this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN'
            this.nextAttempt = Date.now() + this.resetTimeout
        }
    }
}

const circuitBreaker = new CircuitBreaker()

/**
 * Send a prompt to the backend AI chat endpoint.
 * Returns parsed JSON if the response is valid JSON, otherwise { content, type: 'text' }.
 */
async function invokeAIAgent(systemPrompt, userPrompt, options = {}) {
    const { retries = 2, clientId = 'default' } = options

    checkRateLimit(clientId)

    return circuitBreaker.executeRequest(async () => {
        let lastError = null
        for (let i = 0; i < retries; i++) {
            try {
                const controller = new AbortController()
                const timeout = setTimeout(() => controller.abort(), 30000)

                const response = await fetch(`${API_BASE}/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: `${systemPrompt}\n\nUser request: ${userPrompt}`,
                        user_id: 'agent-helper',
                    }),
                    signal: controller.signal,
                })
                clearTimeout(timeout)

                if (!response.ok) {
                    throw new Error(`Backend error: ${response.status}`)
                }

                const data = await response.json()
                const content = data.text || ''

                try {
                    return JSON.parse(content)
                } catch {
                    return { content, type: 'text' }
                }
            } catch (error) {
                lastError = error
                console.error(`Backend AI error (attempt ${i + 1}/${retries}):`, error)
                if (i < retries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
                }
            }
        }
        throw lastError
    })
}

/**
 * Get recipe suggestions for given ingredients.
 * Used by FoodCard component via useAI() hook.
 */
async function getRecipeSuggestions(ingredients) {
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
        throw new Error('Invalid ingredients format. Must provide a non-empty array.')
    }

    try {
        const systemPrompt = `You are a culinary expert. Suggest recipes using these ingredients: ${ingredients.join(', ')}. Focus on reducing food waste and using ingredients efficiently.`

        const response = await invokeAIAgent(systemPrompt, 'Suggest 3 recipes.')

        let parsedResponse
        if (typeof response === 'string') {
            try {
                parsedResponse = JSON.parse(response)
            } catch {
                parsedResponse = {
                    recipes: [{
                        name: 'Simple Recipe',
                        ingredients: ingredients,
                        instructions: response,
                        prepTime: 'N/A',
                        cookTime: 'N/A',
                        difficulty: 'N/A',
                        servings: 2,
                    }],
                }
            }
        } else {
            parsedResponse = response
        }

        if (!parsedResponse.recipes || !Array.isArray(parsedResponse.recipes)) {
            throw new Error('Invalid response format from AI agent')
        }

        return parsedResponse
    } catch (error) {
        console.error('Recipe suggestion error:', error)
        throw new Error('Unable to generate recipe suggestions. Please try again.')
    }
}

export {
    getRecipeSuggestions,
}
