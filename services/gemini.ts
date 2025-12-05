
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Attachment, ModelProvider } from "../types";

// --- OpenAI Compatible Interface ---
interface OpenAICompletionResponse {
  id: string;
  choices: {
    message: {
      content: string;
      role: string;
    };
  }[];
}

/**
 * Generic function to call OpenAI-compatible APIs (DeepSeek, Grok, OpenAI)
 */
const callOpenAIStyleAPI = async (
    endpoint: string,
    apiKey: string,
    model: string,
    messages: any[],
    systemInstruction?: string
): Promise<string> => {
    
    // Prepare headers
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };

    // Prepare Payload
    // Inject system instruction as the first message if present
    let finalMessages = [...messages];
    if (systemInstruction) {
        finalMessages.unshift({ role: 'system', content: systemInstruction });
    }

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                model: model,
                messages: finalMessages,
                stream: false // For simplicity in this demo, strictly we should support stream
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`API Error (${response.status}): ${err}`);
        }

        const data: OpenAICompletionResponse = await response.json();
        return data.choices[0]?.message?.content || "";

    } catch (error: any) {
        console.error("OpenAI Style API Error:", error);
        throw new Error(error.message || "请求第三方 API 失败");
    }
};

/**
 * Unified Sender Function
 */
export const sendMessageToAI = async (
  modelId: string,
  provider: ModelProvider,
  prompt: string,
  history: any[], // Previous chat history context
  attachments: Attachment[] = [],
  systemInstruction?: string,
  thinkingBudget?: number,
  config?: { 
      googleKey?: string; 
      deepseekKey?: string; 
      openaiKey?: string; 
      xaiKey?: string;
      baseUrl?: string; // Currently active proxy URL for Google, or custom overrides
  }
): Promise<string> => {
  
  // 1. Google Gemini Provider
  if (provider === 'google') {
      const apiKey = config?.googleKey;
      if (!apiKey) throw new Error("请在设置中配置 Google API Key (或使用内置代理)");

      const clientOptions: any = { apiKey };
      if (config?.baseUrl) {
          let baseUrl = config.baseUrl.trim();
          if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
          clientOptions.baseUrl = baseUrl;
      }

      const ai = new GoogleGenAI(clientOptions);

      // Construct Request for Gemini
      const parts: any[] = [];
      for (const att of attachments) {
          if (att.mimeType.startsWith('image/') || att.mimeType === 'application/pdf') {
              const cleanBase64 = att.content.split(',')[1] || att.content;
              parts.push({ inlineData: { mimeType: att.mimeType, data: cleanBase64 } });
          } else {
              parts.push({ text: `\n[文件: ${att.name}]\n${att.content}\n` });
          }
      }
      if (prompt) parts.push({ text: prompt });

      // Gemini doesn't automatically take history in 'generateContent', usually needs 'chats.create'.
      // For this simplified stateless implementation, we are just sending the *current* prompt + attachments.
      // To support history with Gemini REST properly via this SDK in a stateless way involves simpler context packing or using ChatSession.
      // Here we pack simple history into the prompt for simplicity or use the prompt as is if we want to rely on the SDK's chat mode later.
      // *Correction*: To make it comparable to OpenAI logic below, we send the prompt. 
      // If we wanted full history, we'd need to convert `history` to Content objects.
      // Let's stick to single-turn + context for now or basic history packing.
      
      const genConfig: any = {};
      if (systemInstruction) genConfig.systemInstruction = systemInstruction;
      if (thinkingBudget) genConfig.thinkingConfig = { thinkingBudget };

      const response = await ai.models.generateContent({
          model: modelId,
          contents: { parts },
          config: genConfig
      });

      // Parse Response
      let finalOutput = "";
      const candidates = response.candidates;
      if (candidates?.[0]?.content?.parts) {
          for (const part of candidates[0].content.parts) {
              if (part.text) finalOutput += part.text;
              if (part.inlineData) {
                  const mime = part.inlineData.mimeType || 'image/png';
                  finalOutput += `\n\n![AI Image](data:${mime};base64,${part.inlineData.data})\n\n`;
              }
          }
      } else if (response.text) {
          finalOutput = response.text;
      }
      return finalOutput || "No content returned.";
  }

  // 2. DeepSeek Provider
  if (provider === 'deepseek') {
      const apiKey = config?.deepseekKey;
      if (!apiKey) throw new Error("请在设置中配置 DeepSeek API Key");
      
      // Convert history + current prompt to OpenAI format
      const messages = history.map(h => ({
          role: h.role === 'model' ? 'assistant' : 'user',
          content: h.text // Note: DeepSeek currently doesn't support Image inputs via API easily
      }));
      // Add current user prompt
      // Note: If attachments are present, we should warn user or append text content
      let content = prompt;
      if (attachments.length > 0) {
          content += "\n[用户上传了文件，但DeepSeek暂不支持直接文件读取，请忽略附件内容或要求用户粘贴文本]";
      }
      messages.push({ role: 'user', content });

      return await callOpenAIStyleAPI(
          'https://api.deepseek.com/chat/completions',
          apiKey,
          modelId,
          messages,
          systemInstruction
      );
  }

  // 3. OpenAI Provider
  if (provider === 'openai') {
      const apiKey = config?.openaiKey;
      if (!apiKey) throw new Error("请在设置中配置 OpenAI API Key");
      
      const messages = history.map(h => ({
          role: h.role === 'model' ? 'assistant' : 'user',
          content: h.text
      }));
      messages.push({ role: 'user', content: prompt }); // Simplified content, ignoring image attachments for standard chat

      // Note: OpenAI requires a proxy if called from browser due to CORS, 
      // OR user must use a Project Key that allows specific origins (rare).
      // We will try the direct endpoint, but it might fail without a proxy.
      // Use the user's custom base URL if they set one in the "Proxy" tab for OpenAI, 
      // otherwise default to official.
      const endpoint = 'https://api.openai.com/v1/chat/completions';
      
      return await callOpenAIStyleAPI(endpoint, apiKey, modelId, messages, systemInstruction);
  }

  // 4. xAI (Grok) Provider
  if (provider === 'xai') {
      const apiKey = config?.xaiKey;
      if (!apiKey) throw new Error("请在设置中配置 xAI (Grok) API Key");

      const messages = history.map(h => ({
        role: h.role === 'model' ? 'assistant' : 'user',
        content: h.text
      }));
      messages.push({ role: 'user', content: prompt });

      return await callOpenAIStyleAPI(
          'https://api.x.ai/v1/chat/completions',
          apiKey,
          modelId,
          messages,
          systemInstruction
      );
  }

  throw new Error(`未知的模型服务商: ${provider}`);
};
