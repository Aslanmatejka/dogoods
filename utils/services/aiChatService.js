import { getApiConfig } from '../config.js'
import { reportError } from '../helpers.js'
import dataService from '../dataService.js'

const SYSTEM_PROMPT = `You are Nouri, the AI assistant for DoGoods — a community food sharing platform by the All Good Living Foundation. You help people find food, share food, and reduce waste in their neighborhoods.

Your personality: warm, helpful, community-focused, practical. You speak simply and clearly. You celebrate small acts of generosity. You never judge anyone for needing food — food sharing is community care, not charity.

You can help with:
- Finding nearby food listings and distribution events
- Suggesting recipes from available or claimed items
- Food storage and safety tips
- Explaining how DoGoods works
- Answering questions in English and Spanish

IMPORTANT RULES:
- Never share other users' personal information
- Never make up food listings — only recommend the Find Food page
- For food safety questions, always err on the side of caution
- Keep responses concise (2-4 sentences for simple questions, more for recipes)
- Never recommend dumpster diving, expired food consumption, or unsafe food recovery
- If someone mentions a medical condition, advise them to consult a healthcare provider

If the user writes in Spanish, respond entirely in Spanish. Use informal 'tú' form.

DoGoods works like this:
1. SHARE: Donors post food listings with details and pickup info
2. FIND: Recipients browse nearby listings filtered by category, diet, distance
3. CLAIM: Recipients claim items — donor gets notified
4. PICKUP: Recipient picks up food at the listed location
5. COMMUNITY: Local communities organize distribution events

Website: dogoods.store | Tagline: Share food. Build community. Do good.`

class AIChatService {
  /**
   * Send a message to OpenAI directly
   */
  async sendMessage(message, { conversationHistory = [], userLocation = null } = {}) {
    try {
      const config = getApiConfig().OPENAI

      let systemContent = SYSTEM_PROMPT
      if (userLocation) {
        systemContent += `\n\nUser's approximate GPS location: ${userLocation.latitude}, ${userLocation.longitude}`
      }

      const messages = [
        { role: 'system', content: systemContent },
        ...conversationHistory.slice(-20).map(msg => ({
          role: msg.role,
          content: msg.message || msg.content,
        })),
        { role: 'user', content: message },
      ]

      const response = await fetch('/api/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.MODELS?.CHAT || 'gpt-4o-mini',
          messages,
          temperature: 0.7,
          max_tokens: 1500,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('OpenAI API error:', response.status, errorText)
        throw new Error(`AI service error: ${response.status}`)
      }

      const data = await response.json()
      const responseText = data.choices?.[0]?.message?.content || "I'm sorry, I couldn't process that. Please try again."

      return {
        response: responseText,
        toolResults: [],
        suggestedActions: [],
        error: null,
      }
    } catch (error) {
      console.error('AI chat service error:', error)
      reportError(error)
      throw error
    }
  }

  /**
   * Load conversation history for a user
   */
  async getHistory(userId, limit = 50) {
    try {
      return await dataService.getAIConversations(userId, limit)
    } catch (error) {
      console.error('Get AI history error:', error)
      reportError(error)
      return []
    }
  }

  /**
   * Clear all conversation history for a user
   */
  async clearHistory(userId) {
    try {
      return await dataService.deleteAIConversations(userId)
    } catch (error) {
      console.error('Clear AI history error:', error)
      reportError(error)
      throw error
    }
  }

  /**
   * Submit feedback (thumbs up/down) on an AI message
   */
  async submitFeedback(conversationId, userId, rating, comment = null) {
    try {
      return await dataService.saveAIFeedback(conversationId, userId, rating, comment)
    } catch (error) {
      console.error('Submit AI feedback error:', error)
      reportError(error)
      throw error
    }
  }

  /**
   * Get user's active reminders
   */
  async getReminders(userId) {
    try {
      return await dataService.getAIReminders(userId)
    } catch (error) {
      console.error('Get AI reminders error:', error)
      reportError(error)
      return []
    }
  }
}

const aiChatService = new AIChatService()
export default aiChatService
