
export interface Attachment {
  id: string;
  type: 'image' | 'file'; // 'file' includes PDF and text-based files
  mimeType: string;
  content: string; // Base64 for images/PDFs, plain text for code/text files
  name: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  attachments?: Attachment[];
  timestamp: number;
  isError?: boolean;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
}

export type ModelProvider = 'google' | 'openai' | 'deepseek' | 'xai';

export interface AIModel {
  id: string;
  name: string;
  description: string;
  provider: ModelProvider; // 区分服务商
  apiModel: string;        // 真实的 API Model ID
  systemInstruction?: string; 
  thinkingBudget?: number;
}

export interface ProxyNode {
  id: string;
  name: string;
  url: string;
  latency: number; // in ms, -1 means checking, Infinity means timeout/error
  isOk: boolean;
  isCustom?: boolean; 
}

// 这里配置的是各家官方真实的 API Model ID
export const AVAILABLE_MODELS: AIModel[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Google 最新极速模型，免费且强大',
    provider: 'google',
    apiModel: 'gemini-2.5-flash'
  },
  {
    id: 'gemini-3-pro',
    name: 'Gemini 3.0 Pro',
    description: 'Google 最强推理模型',
    provider: 'google',
    apiModel: 'gemini-3-pro-preview'
  },
  {
    id: 'deepseek-v3',
    name: 'DeepSeek V3 (真实版)',
    description: '深度求索 V3，国产之光，需配置 DeepSeek Key',
    provider: 'deepseek',
    apiModel: 'deepseek-chat'
  },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek R1 (推理版)',
    description: '深度求索推理模型，擅长数学代码',
    provider: 'deepseek',
    apiModel: 'deepseek-reasoner'
  },
  {
    id: 'grok-2',
    name: 'Grok 2 (xAI)',
    description: 'Elon Musk 的 AI，需配置 xAI Key',
    provider: 'xai',
    apiModel: 'grok-beta'
  },
  {
    id: 'gpt-4o',
    name: 'ChatGPT 4o',
    description: 'OpenAI 旗舰模型，需配置 OpenAI Key',
    provider: 'openai',
    apiModel: 'gpt-4o'
  },
  {
    id: 'flux-painter',
    name: 'Gemini 绘图版',
    description: 'Google 图像生成模型',
    provider: 'google',
    apiModel: 'gemini-2.5-flash-image'
  }
];
