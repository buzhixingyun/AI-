import React, { useState, useRef, useEffect } from 'react';
import { Message, AVAILABLE_MODELS, AIModel, Attachment, ProxyNode } from './types';
import { sendMessageToAI } from './services/gemini';
import ChatMessage from './components/ChatMessage';
import { SendIcon, ImageIcon, SparklesIcon, XMarkIcon, MicIcon, StopIcon, PaperClipIcon, DocumentIcon, Cog6ToothIcon, ClockIcon, LogoutIcon, TrashIcon, ArrowPathIcon, ChatBubbleLeftRightIcon, KeyIcon } from './components/Icons';

// --- Configuration Constants ---

const DEFAULT_API_KEY = ""; // 预留给 Google Gemini 的免费 Key

const INITIAL_PROXY_LIST: ProxyNode[] = [
  { id: 'p_cf_1', name: "公益节点 US-1 (Cloudflare)", url: "https://gemini-proxy.pages.dev", latency: -1, isOk: false },
  { id: 'p_cf_2', name: "公益节点 SG-1 (Vercel)", url: "https://gemini-openai-proxy.vercel.app", latency: -1, isOk: false },
  { id: 'p_direct', name: "直连模式 (需系统VPN)", url: "https://generativelanguage.googleapis.com", latency: -1, isOk: false },
  { id: 'p_custom_1', name: "社区节点 UK-1", url: "https://api.gemini.chatgpt.org.uk", latency: -1, isOk: false },
];

const DEFAULT_WELCOME_MSG: Message = {
    id: 'welcome',
    role: 'model',
    text: `👋 **你好！我是真正的全能 AI 聚合助手。**

我已经完全重构，现在**真实对接**各家厂商的官方 API，绝无虚假。

🌟 **支持的模型与配置：**

1.  **🔵 Google Gemini (免费保底)**
    *   无需配置，使用默认免费线路。
    *   支持 *Gemini 2.5 Flash / 3.0 Pro*。

2.  **🦄 DeepSeek (深度求索)**
    *   **真实调用官方 API**。
    *   *需在设置中填入 DeepSeek API Key*。
    *   支持 *V3* 和 *R1 (深度推理)*。

3.  **🧠 OpenAI & xAI**
    *   支持 *ChatGPT-4o* 和 *Grok*。
    *   *需自备 API Key*。

🚀 **现在，请在右上角设置中配置您的 Key，然后开始对话！**`,
    timestamp: Date.now()
};

const App: React.FC = () => {
  // --- User & Auth State ---
  const [username, setUsername] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(true);
  const loginInputRef = useRef<HTMLInputElement>(null);

  // --- Chat State ---
  const [selectedModel, setSelectedModel] = useState<AIModel>(AVAILABLE_MODELS[0]);
  
  // Model switching state
  const [pendingModel, setPendingModel] = useState<AIModel | null>(null);
  const [showSwitchModal, setShowSwitchModal] = useState(false);

  const [modelHistories, setModelHistories] = useState<Record<string, Message[]>>({
      [AVAILABLE_MODELS[0].id]: [DEFAULT_WELCOME_MSG]
  });

  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isListening, setIsListening] = useState(false);
  
  // UI State
  const [showNetworkPanel, setShowNetworkPanel] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'network' | 'keys'>('keys'); // 'network' or 'keys'
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

  // Network State
  const [proxyList, setProxyList] = useState<ProxyNode[]>(INITIAL_PROXY_LIST);
  const [activeProxy, setActiveProxy] = useState<ProxyNode | null>(null);
  const [customNodeName, setCustomNodeName] = useState('');
  const [customNodeUrl, setCustomNodeUrl] = useState('');

  // API Keys State
  const [apiKeys, setApiKeys] = useState({
      google: '',
      deepseek: '',
      openai: '',
      xai: ''
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const currentMessages = modelHistories[selectedModel.id] || [];

  // --- Auth & Persistence Logic ---

  useEffect(() => {
    // 1. Check for User
    const storedUser = localStorage.getItem('nebula_username');
    if (storedUser) {
        setUsername(storedUser);
        setShowLogin(false);
        try {
            const savedHistory = localStorage.getItem(`nebula_history_${storedUser}`);
            if (savedHistory) setModelHistories(JSON.parse(savedHistory));
        } catch (e) { console.error(e); }
    }

    // 2. Load Custom Nodes
    try {
        const savedNodes = localStorage.getItem('nebula_custom_nodes');
        if (savedNodes) {
            const parsedNodes: ProxyNode[] = JSON.parse(savedNodes);
            setProxyList(prev => {
                const existingIds = new Set(prev.map(p => p.id));
                const uniqueNew = parsedNodes.filter(p => !existingIds.has(p.id));
                return [...prev, ...uniqueNew];
            });
        }
    } catch (e) { console.error(e); }

    // 3. Load API Keys
    try {
        const savedKeys = localStorage.getItem('nebula_api_keys');
        if (savedKeys) {
            setApiKeys(JSON.parse(savedKeys));
        }
    } catch (e) { console.error(e); }

  }, []);

  // Save history
  useEffect(() => {
    if (username && Object.keys(modelHistories).length > 0) {
        localStorage.setItem(`nebula_history_${username}`, JSON.stringify(modelHistories));
    }
  }, [modelHistories, username]);

  // Save Keys
  useEffect(() => {
     localStorage.setItem('nebula_api_keys', JSON.stringify(apiKeys));
  }, [apiKeys]);

  const handleLogin = (e?: React.FormEvent) => {
      e?.preventDefault();
      const name = loginInputRef.current?.value.trim();
      if (!name) return;
      setUsername(name);
      localStorage.setItem('nebula_username', name);
      setShowLogin(false);
      const savedHistory = localStorage.getItem(`nebula_history_${name}`);
      if (savedHistory) {
          try { setModelHistories(JSON.parse(savedHistory)); } catch(e) {}
      } else {
          setModelHistories({ [AVAILABLE_MODELS[0].id]: [DEFAULT_WELCOME_MSG] });
      }
  };

  const handleLogout = () => {
      if (confirm("确定要退出吗？")) {
          localStorage.removeItem('nebula_username');
          setUsername(null);
          setShowLogin(true);
          setShowHistoryPanel(false);
          setModelHistories({ [AVAILABLE_MODELS[0].id]: [DEFAULT_WELCOME_MSG] });
      }
  };

  const clearHistoryForModel = (modelId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (confirm("确定要清空该模型的聊天记录吗？")) {
          setModelHistories(prev => {
              const newState = { ...prev };
              delete newState[modelId];
              return newState;
          });
      }
  }

  // --- Network Logic ---

  const checkProxyLatency = async (proxy: ProxyNode): Promise<ProxyNode> => {
    const start = Date.now();
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); 
        await fetch(`${proxy.url}/v1beta/models?key=TEST`, { 
            method: 'GET', 
            mode: 'no-cors', 
            signal: controller.signal 
        });
        clearTimeout(timeoutId);
        const latency = Date.now() - start;
        return { ...proxy, latency, isOk: true };
    } catch (e) {
        return { ...proxy, latency: Infinity, isOk: false };
    }
  };

  const runNetworkCheck = async () => {
    const checks = proxyList.map(p => checkProxyLatency(p));
    const results = await Promise.all(checks);
    const sorted = results.sort((a, b) => {
        if (a.isOk && !b.isOk) return -1;
        if (!a.isOk && b.isOk) return 1;
        return a.latency - b.latency;
    });
    setProxyList(sorted);
    const currentIsBad = activeProxy && (!activeProxy.isOk || activeProxy.latency === Infinity);
    if (!activeProxy || currentIsBad) {
        const best = sorted.find(p => p.isOk);
        setActiveProxy(best || results[0]);
    } else {
        const updatedCurrent = sorted.find(p => p.id === activeProxy.id);
        if (updatedCurrent) setActiveProxy(updatedCurrent);
    }
  };

  useEffect(() => { runNetworkCheck(); }, []);

  const addCustomNode = async () => {
      if (!customNodeName.trim() || !customNodeUrl.trim()) return alert("请输入信息");
      let formattedUrl = customNodeUrl.trim();
      if (formattedUrl.endsWith('/')) formattedUrl = formattedUrl.slice(0, -1);
      if (!formattedUrl.startsWith('http')) formattedUrl = `https://${formattedUrl}`;

      const newNode: ProxyNode = {
          id: `custom_${Date.now()}`,
          name: customNodeName.trim(),
          url: formattedUrl,
          latency: -1,
          isOk: false,
          isCustom: true
      };
      const checkedNode = await checkProxyLatency(newNode);
      const newProxyList = [...proxyList, checkedNode];
      setProxyList(newProxyList);
      const customNodes = newProxyList.filter(p => p.isCustom);
      localStorage.setItem('nebula_custom_nodes', JSON.stringify(customNodes));
      setCustomNodeName('');
      setCustomNodeUrl('');
      if (checkedNode.isOk) {
          setActiveProxy(checkedNode);
          alert(`添加成功！延迟: ${checkedNode.latency}ms`);
      } else {
          alert("添加成功但测试失败。");
      }
  };

  const removeCustomNode = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (confirm("删除此节点？")) {
          const newList = proxyList.filter(p => p.id !== id);
          setProxyList(newList);
          localStorage.setItem('nebula_custom_nodes', JSON.stringify(newList.filter(p => p.isCustom)));
          if (activeProxy?.id === id) setActiveProxy(newList[0] || null);
      }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages, isLoading]);

  // --- Voice Input ---
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'zh-CN';
      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        const results = event.results as any;
        for (let i = event.resultIndex; i < results.length; ++i) {
          if (results[i].isFinal) finalTranscript += results[i][0].transcript;
        }
        if (finalTranscript) setInput(prev => prev + finalTranscript);
      };
      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  // --- Handlers ---

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModelId = e.target.value;
    const newModel = AVAILABLE_MODELS.find(m => m.id === newModelId);
    if (!newModel) return;

    const currentMsgs = (modelHistories[selectedModel.id] || []) as Message[];
    const hasContent = currentMsgs.length > 1;

    if (hasContent) {
        setPendingModel(newModel);
        setShowSwitchModal(true);
    } else {
        setSelectedModel(newModel);
    }
  };

  const handleConfirmSwitch = (shouldTransfer: boolean) => {
      if (!pendingModel) return;
      if (shouldTransfer) {
          const msgsToTransfer = [...(modelHistories[selectedModel.id] || [])];
          msgsToTransfer.push({
              id: 'sys_transfer_' + Date.now(),
              role: 'model',
              text: `--- 上下文已迁移 ---\n前文对话已导入。`,
              timestamp: Date.now()
          });
          setModelHistories(prev => ({ ...prev, [pendingModel.id]: msgsToTransfer }));
      }
      setSelectedModel(pendingModel);
      setPendingModel(null);
      setShowSwitchModal(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const filePromises = Array.from(files).map((file: File) => {
        return new Promise<Attachment>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
                resolve({
                    id: Math.random().toString(36) + Date.now().toString(), 
                    type: type,
                    mimeType: file.type || 'text/plain',
                    name: file.name,
                    content: reader.result as string
                });
            };
            if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                reader.readAsDataURL(file);
            } else {
                reader.readAsText(file);
            }
        });
    });
    const newAttachments = await Promise.all(filePromises);
    setAttachments(prev => [...prev, ...newAttachments]);
    if (type === 'image' && imageInputRef.current) imageInputRef.current.value = '';
    if (type === 'file' && fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleListening = () => {
    if (!recognitionRef.current) return alert("浏览器不支持");
    if (isListening) recognitionRef.current.stop();
    else { recognitionRef.current.start(); setIsListening(true); }
  };

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || isLoading) return;

    const currentModel = selectedModel;
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input.trim(),
      attachments: attachments.length > 0 ? [...attachments] : undefined,
      timestamp: Date.now()
    };

    // Optimistic UI update
    const prevHistory = modelHistories[currentModel.id] || [];
    setModelHistories(prev => ({...prev, [currentModel.id]: [...prevHistory, userMessage]}));
    
    setIsLoading(true);
    setInput('');
    setAttachments([]);
    if (isListening) recognitionRef.current?.stop();

    try {
      const responseText = await sendMessageToAI(
        currentModel.apiModel, 
        currentModel.provider,
        userMessage.text, 
        prevHistory, // Send previous history for context
        userMessage.attachments,
        currentModel.systemInstruction,
        currentModel.thinkingBudget,
        { 
            googleKey: apiKeys.google || DEFAULT_API_KEY, 
            deepseekKey: apiKeys.deepseek,
            openaiKey: apiKeys.openai,
            xaiKey: apiKeys.xai,
            baseUrl: activeProxy?.url 
        }
      );

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: Date.now()
      };
      setModelHistories(prev => ({...prev, [currentModel.id]: [...(prev[currentModel.id] || []), botMessage]}));

    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: `❌ **请求失败**: ${error instanceof Error ? error.message : "未知错误"}`,
        timestamp: Date.now(),
        isError: true
      };
      setModelHistories(prev => ({...prev, [currentModel.id]: [...(prev[currentModel.id] || []), errorMessage]}));
    } finally {
      setIsLoading(false);
    }
  };

  // --- Render ---

  if (showLogin) {
      return (
          <div className="flex flex-col h-screen supports-[height:100dvh]:h-[100dvh] bg-[#0f1117] text-gray-100 font-sans items-center justify-center relative overflow-hidden">
              <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse" />
              <div className="z-10 bg-[#161b22]/80 backdrop-blur-xl border border-gray-700/50 p-8 rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-fade-in">
                  <div className="flex flex-col items-center mb-8">
                      <div className="text-indigo-500 mb-4 scale-150"><SparklesIcon /></div>
                      <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">AI 全能助手</h1>
                  </div>
                  <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1 ml-1">昵称</label>
                          <input ref={loginInputRef} type="text" className="w-full bg-[#0d1117] border border-gray-700 text-white p-3 rounded-lg focus:outline-none focus:border-indigo-500 text-base" autoFocus />
                      </div>
                      <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-lg transition-all active:scale-95">进入工作台</button>
                  </form>
              </div>
          </div>
      )
  }

  return (
    <div className="flex flex-col h-screen supports-[height:100dvh]:h-[100dvh] bg-[#0f1117] text-gray-100 font-sans overflow-hidden">
      
      {/* Header */}
      <header className="flex items-center justify-between px-4 md:px-6 py-4 bg-[#161b22] border-b border-gray-800/60 z-10 shadow-lg shrink-0">
        <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto overflow-hidden">
          <button onClick={() => setShowHistoryPanel(true)} className="text-gray-400 hover:text-white p-2 -ml-2 rounded-lg hover:bg-gray-800"><ClockIcon /></button>
          <div className="text-indigo-500 hidden md:block"><SparklesIcon /></div>
          <div className="relative flex-1 md:flex-none min-w-0">
            <label className="text-[10px] text-gray-500 absolute -top-2.5 left-2 bg-[#161b22] px-1 hidden md:block">AI Model</label>
            <select value={selectedModel.id} onChange={handleModelChange} className="w-full md:w-64 appearance-none bg-[#0d1117] border border-gray-700 text-indigo-300 py-2 pl-3 md:pl-4 pr-8 md:pr-10 rounded-lg focus:outline-none text-sm font-medium cursor-pointer truncate">
              {AVAILABLE_MODELS.map(model => (
                <option key={model.id} value={model.id}>{model.name} ({model.provider})</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4 shrink-0 ml-2">
             <button onClick={() => { setSettingsTab('keys'); setShowNetworkPanel(true); }} className="flex items-center gap-1 md:gap-2 bg-[#0d1117] border border-gray-700/50 rounded-full px-2.5 md:px-3 py-1.5 hover:bg-gray-800 transition-colors">
                <span className="text-xs text-gray-400 font-mono hidden md:inline">设置</span>
                <Cog6ToothIcon />
             </button>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-y-auto custom-scrollbar relative">
        <div className="max-w-4xl mx-auto px-2 md:px-4 py-4 md:py-8">
          {currentMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-50 mt-20"><p>开始对话...</p></div>
          ) : (
            currentMessages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
          )}
          {isLoading && (
            <div className="flex justify-start mb-6 animate-fade-in">
                <div className="flex items-center gap-2 bg-gray-800/50 p-3 rounded-2xl border border-gray-700/50">
                    <span className="text-xs text-gray-400 ml-2">正在等待 {selectedModel.provider} 响应...</span>
                </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </main>

      {/* Input Area */}
      <footer className="bg-[#161b22] border-t border-gray-800/60 p-2 md:p-4 shrink-0">
        <div className="max-w-4xl mx-auto">
          {attachments.length > 0 && (
            <div className="flex gap-3 mb-3 overflow-x-auto pb-2 custom-scrollbar">
              {attachments.map((att) => (
                <div key={att.id} className="relative group flex-shrink-0">
                  <div className="h-14 w-14 md:h-16 md:w-16 rounded-lg overflow-hidden border border-indigo-500/30">
                      {att.type === 'image' ? <img src={att.content} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center"><DocumentIcon /></div>}
                  </div>
                  <button onClick={() => setAttachments(p => p.filter(a => a.id !== att.id))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"><XMarkIcon /></button>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex items-end gap-1 md:gap-2 bg-[#0d1117] border border-gray-700 rounded-xl p-1.5 md:p-2 shadow-inner">
            <button onClick={() => imageInputRef.current?.click()} className="p-2 md:p-3 text-gray-400 hover:text-indigo-400 shrink-0"><ImageIcon /></button>
            <input type="file" ref={imageInputRef} onChange={(e) => handleFileSelect(e, 'image')} accept="image/*" className="hidden" multiple />
            
            <button onClick={() => fileInputRef.current?.click()} className="p-2 md:p-3 text-gray-400 hover:text-indigo-400 shrink-0"><PaperClipIcon /></button>
            <input type="file" ref={fileInputRef} onChange={(e) => handleFileSelect(e, 'file')} accept=".pdf,.txt,.md,.js,.py" className="hidden" multiple />

            <button onClick={toggleListening} className={`p-2 md:p-3 rounded-lg shrink-0 ${isListening ? 'text-red-500 animate-pulse' : 'text-gray-400 hover:text-indigo-400'}`}>
               {isListening ? <StopIcon /> : <MicIcon />}
            </button>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
              placeholder={isListening ? "正在听..." : `发送消息...`}
              className="w-full bg-transparent text-gray-100 placeholder-gray-500 p-2.5 md:p-3 max-h-32 min-h-[44px] resize-none focus:outline-none custom-scrollbar text-base"
              rows={1}
            />
            <button onClick={handleSend} disabled={(!input.trim() && attachments.length === 0) || isLoading} className="p-2 md:p-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 shrink-0 active:scale-95 transition-transform">
              <SendIcon />
            </button>
          </div>
        </div>
      </footer>

      {/* Switch Context Modal */}
      {showSwitchModal && pendingModel && (
         <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <div className="bg-[#161b22] border border-gray-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
                 <div className="w-12 h-12 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4 mx-auto"><ChatBubbleLeftRightIcon /></div>
                 <h3 className="text-lg font-bold text-white mb-2">切换模型</h3>
                 <p className="text-sm text-gray-400 mb-6">从 {selectedModel.name} 切换到 {pendingModel.name}。<br/>保留上下文继续分析？</p>
                 <div className="flex flex-col gap-3">
                     <button onClick={() => handleConfirmSwitch(true)} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium active:scale-95 transition-transform"><ArrowPathIcon /> 保留并继续</button>
                     <button onClick={() => handleConfirmSwitch(false)} className="w-full py-3 bg-[#0d1117] text-gray-300 border border-gray-700 rounded-xl active:scale-95 transition-transform">新开对话</button>
                 </div>
             </div>
         </div>
      )}

      {/* History Sidebar */}
      {showHistoryPanel && (
          <div className="fixed inset-0 z-50 flex">
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowHistoryPanel(false)}></div>
              <div className="relative w-72 max-w-[85vw] bg-[#161b22] border-r border-gray-700 h-full shadow-2xl flex flex-col animate-slide-right">
                  <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#0d1117]">
                      <h3 className="font-semibold text-gray-200 flex items-center gap-2"><ClockIcon /> 历史会话</h3>
                      <button onClick={() => setShowHistoryPanel(false)} className="text-gray-500 hover:text-white"><XMarkIcon /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                      {Object.entries(modelHistories).map(([modelId, msgs]) => {
                          const messages = msgs as Message[];
                          const modelInfo = AVAILABLE_MODELS.find(m => m.id === modelId);
                          if (!modelInfo || !messages.length) return null;
                          const isActive = selectedModel.id === modelId;
                          return (
                              <div key={modelId} onClick={() => { setSelectedModel(modelInfo); setShowHistoryPanel(false); }} className={`group p-3 rounded-xl border cursor-pointer transition-all active:scale-95 ${isActive ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-[#0d1117] border-gray-700'}`}>
                                  <div className="flex justify-between items-start mb-1">
                                      <span className={`text-sm font-medium ${isActive ? 'text-indigo-300' : 'text-gray-300'}`}>{modelInfo.name}</span>
                                  </div>
                                  <p className="text-xs text-gray-500 truncate">{messages[messages.length - 1].text || '...'}</p>
                                  <button onClick={(e) => clearHistoryForModel(modelId, e)} className="absolute bottom-2 right-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100"><TrashIcon /></button>
                              </div>
                          )
                      })}
                  </div>
                  <div className="p-4 border-t border-gray-800 bg-[#0d1117]"><button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-2 bg-gray-800 text-gray-400 rounded-lg text-xs hover:text-red-400 active:scale-95 transition-transform"><LogoutIcon /> 退出登录</button></div>
              </div>
          </div>
      )}

      {/* Settings Panel */}
      {showNetworkPanel && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-gray-700 rounded-2xl w-[95%] max-w-lg p-0 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-[#0d1117]">
                 <h3 className="font-bold text-white flex items-center gap-2"><Cog6ToothIcon /> 设置中心</h3>
                 <button onClick={() => setShowNetworkPanel(false)} className="text-gray-400 hover:text-white"><XMarkIcon /></button>
            </div>
            
            {/* Tabs */}
            <div className="flex border-b border-gray-800 bg-[#161b22]">
                <button onClick={() => setSettingsTab('keys')} className={`flex-1 py-3 text-xs font-medium ${settingsTab === 'keys' ? 'text-indigo-400 border-b-2 border-indigo-500 bg-indigo-900/10' : 'text-gray-400 hover:bg-gray-800'}`}>🔑 模型密钥</button>
                <button onClick={() => setSettingsTab('network')} className={`flex-1 py-3 text-xs font-medium ${settingsTab === 'network' ? 'text-indigo-400 border-b-2 border-indigo-500 bg-indigo-900/10' : 'text-gray-400 hover:bg-gray-800'}`}>🌐 网络代理</button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
                {settingsTab === 'keys' ? (
                    <div className="space-y-6">
                        <div className="bg-yellow-900/20 border border-yellow-700/30 p-3 rounded-xl text-xs text-yellow-200/80 mb-4 leading-relaxed">
                            ⚠️ <strong>注意：</strong> 使用 DeepSeek, OpenAI, xAI 等厂商的模型需要您填入自己的 Key。
                            <br/>Web端直接调用可能存在跨域(CORS)限制，建议配合下方“网络代理”中的节点使用。
                        </div>

                        {/* Google */}
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-indigo-300">Google Gemini Key (免费)</label>
                            <input 
                                type="password" 
                                value={apiKeys.google} 
                                onChange={(e) => setApiKeys({...apiKeys, google: e.target.value})}
                                placeholder="留空则使用内置免费 Key"
                                className="w-full bg-[#0d1117] border border-gray-700 text-white p-3 rounded-lg text-base md:text-sm focus:border-indigo-500" 
                            />
                        </div>
                        
                        {/* DeepSeek */}
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-blue-300">DeepSeek Key (深度求索)</label>
                            <input 
                                type="password" 
                                value={apiKeys.deepseek} 
                                onChange={(e) => setApiKeys({...apiKeys, deepseek: e.target.value})}
                                placeholder="sk-..."
                                className="w-full bg-[#0d1117] border border-gray-700 text-white p-3 rounded-lg text-base md:text-sm focus:border-blue-500" 
                            />
                            <a href="https://platform.deepseek.com/" target="_blank" className="text-[10px] text-gray-500 hover:text-blue-400">➡️ 申请 DeepSeek Key</a>
                        </div>

                         {/* OpenAI */}
                         <div className="space-y-2">
                            <label className="text-xs font-medium text-green-300">OpenAI Key (ChatGPT)</label>
                            <input 
                                type="password" 
                                value={apiKeys.openai} 
                                onChange={(e) => setApiKeys({...apiKeys, openai: e.target.value})}
                                placeholder="sk-..."
                                className="w-full bg-[#0d1117] border border-gray-700 text-white p-3 rounded-lg text-base md:text-sm focus:border-green-500" 
                            />
                        </div>

                         {/* XAI */}
                         <div className="space-y-2">
                            <label className="text-xs font-medium text-white">xAI Key (Grok)</label>
                            <input 
                                type="password" 
                                value={apiKeys.xai} 
                                onChange={(e) => setApiKeys({...apiKeys, xai: e.target.value})}
                                placeholder="key..."
                                className="w-full bg-[#0d1117] border border-gray-700 text-white p-3 rounded-lg text-base md:text-sm focus:border-white" 
                            />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Node List Logic */}
                         <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">可用代理列表 (Base URL)</h4>
                            <button onClick={runNetworkCheck} className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 active:scale-95">⚡ 刷新测速</button>
                        </div>
                        <div className="space-y-2.5">
                            {proxyList.map((proxy) => (
                                <div key={proxy.id} onClick={() => setActiveProxy(proxy)} className={`flex items-center justify-between p-3 md:p-4 rounded-xl cursor-pointer border transition-all active:scale-[0.98] ${activeProxy?.id === proxy.id ? 'bg-indigo-600/10 border-indigo-500' : 'bg-[#0d1117] border-gray-800'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full shrink-0 ${proxy.isOk ? 'bg-green-500' : 'bg-red-500'}`} />
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="text-sm font-semibold text-gray-200 truncate">{proxy.name}</span>
                                            <span className="text-[10px] text-gray-500 truncate">{proxy.url}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className={`text-xs font-mono ${proxy.latency < 200 ? 'text-green-400' : 'text-yellow-400'}`}>{proxy.latency === -1 ? '...' : (proxy.latency === Infinity ? 'X' : proxy.latency + 'ms')}</span>
                                        {proxy.isCustom && <button onClick={(e) => removeCustomNode(proxy.id, e)} className="text-gray-600 hover:text-red-500 p-1"><XMarkIcon /></button>}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Add Node */}
                         <div className="bg-[#0d1117] border border-dashed border-gray-700 rounded-xl p-4 mt-4">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">添加自定义代理</h4>
                            <div className="grid gap-3">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <input type="text" placeholder="名称" value={customNodeName} onChange={(e) => setCustomNodeName(e.target.value)} className="col-span-1 bg-[#161b22] border border-gray-700 text-white text-xs p-2.5 rounded-lg text-base md:text-xs" />
                                    <input type="text" placeholder="URL (例如 https://api.openai-proxy.com)" value={customNodeUrl} onChange={(e) => setCustomNodeUrl(e.target.value)} className="col-span-1 md:col-span-2 bg-[#161b22] border border-gray-700 text-white text-xs p-2.5 rounded-lg text-base md:text-xs" />
                                </div>
                                <button onClick={addCustomNode} className="w-full py-2.5 bg-gray-800 text-gray-300 font-medium rounded-lg text-xs border border-gray-600 active:scale-95 transition-transform">+ 添加节点</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
