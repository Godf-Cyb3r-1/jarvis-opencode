export interface JarvisConfig {
  brain: { model: string; fallbackModels: string[]; disableReasoning: boolean }
  maxSessions: number
  textOnly: true
  memory: { maxCardsInContext: number }
}

export const defaultJarvisConfig: JarvisConfig = {
  brain: {
    model: "opencode/deepseek-v4.1-flash-free",
    fallbackModels: [],
    disableReasoning: true,
  },
  maxSessions: 4,
  textOnly: true,
  memory: { maxCardsInContext: 3 },
}

export function validateJarvisConfig(config: JarvisConfig): JarvisConfig {
  if (!Number.isSafeInteger(config.maxSessions) || config.maxSessions < 1 || config.maxSessions > 4)
    throw new Error("jarvis.maxSessions must be an integer from 1 to 4")
  if (!config.brain.model.trim()) throw new Error("Jarvis brain model is required")
  if (config.textOnly !== true) throw new Error("This milestone is text-only")
  return config
}
