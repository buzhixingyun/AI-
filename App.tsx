import React, { useState, useRef, useEffect } from 'react';
import { Message, AVAILABLE_MODELS, AIModel, Attachment, ProxyNode } from './types';
import { sendMessageToAI } from './services/gemini';
import ChatMessage from './components/ChatMessage';
import { SendIcon, ImageIcon, SparklesIcon, XMarkIcon, MicIcon, StopIcon, PaperClipIcon, DocumentIcon, Cog6ToothIcon, ClockIcon, LogoutIcon, TrashIcon, ArrowPathIcon, ChatBubbleLeftRightIcon, KeyIcon } from './components/Icons';

// --- Configuration Constants ---

const DEFAULT_API_KEY = ""; // 预留给 Google Gemini 的免费 Key

const INITIAL_PROXY_LIST: ProxyNode[] = [
  { id: 'p_direct', name: "直连模式 (需系统VPN)", url: "https://generativelanguage.googleapis.com", latency: -1, isOk: false },
  { id: 'p_cf_1', name: "公益节点 US-1 (Cloudflare)", url: "https://gemini-proxy.pages.dev", latency: -1, isOk: false },
  { id: 'p_cf_2', name: "公益节点 SG-1 (Vercel)", url: "https://gemini-openai-proxy.vercel.app", latency: -1, isOk: false },
  { id: 'p_custom_1', name: "社区节点 UK-1", url: "https://api.gemini.chatgpt.org.uk", latency: -1, isOk: false },
];

const DEFAULT_WELCOME_MSG: Message = {
    id: 'welcome',
    role: 'model',
    text: `## 👋 欢迎来到 Nebula AI \n\n我是你的**全能 AI 聚合助手**。这是一个纯前端运行的隐私优先应用，无需服务器中转，数据完全掌握在你手中。\n\n### ✨ 核心能力\n\n*   **💎 多模型矩阵**：一键切换 Google Gemini, DeepSeek, OpenAI, Grok 等顶级模型。\n*   **👁️ 超级多模态**：支持上传 **图片、PDF、代码** 进行深度分析。\n*   **🎨 AI 绘图**：选择 "Gemini 绘图版" 或直接说 "画一只..." 即可创作。\n*   **⚡ 网络隧道**：内置公益代理，直连全球 AI，无需繁琐配置。\n\n### 🚀 开始使用\n\n1.  点击右上角 **设置** 配置 API Key (或使用内置免费节点)。\n2.  上传文件或直接输入，开启你的创造力之旅！`,
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
          <div className="flex flex-col h-screen supports-[height:100dvh]:h-[100dvh] bg-[#050510] text-gray-100 font-sans items-center justify-center relative overflow-hidden">
              {/* Background Ambience */}
              <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] animate-blob" />
              <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px] animate-blob animation-delay-2000" />
              
              <div className="z-10 glass-panel p-8 md:p-12 rounded-3xl shadow-2xl w-full max-w-md mx-4 animate-slide-up flex flex-col items-center">
                  <div className="relative mb-8">
                      <div className="absolute inset-0 bg-indigo-500/50 blur-xl rounded-full"></div>
                      <div className="relative text-indigo-400 scale-[2.5]"><SparklesIcon /></div>
                  </div>
                  <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 mb-2 tracking-tight">Nebula AI</h1>
                  <p className="text-gray-400 text-sm mb-8 text-center font-light">您的全能智能助手，从这里开始</p>
                  
                  <form onSubmit={handleLogin} className="w-full space-y-5">
                      <div className="relative group">
                          <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl opacity-30 group-hover:opacity-100 transition duration-500 blur-sm"></div>
                          <input 
                            ref={loginInputRef} 
                            type="text" 
                            placeholder="输入昵称开启旅程..."
                            className="relative w-full bg-[#0b0c15] border border-white/10 text-white px-4 py-3.5 rounded-xl focus:outline-none focus:border-indigo-500/50 placeholder-gray-600 text-center tracking-wide" 
                            autoFocus 
                          />
                      </div>
                      <button type="submit" className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98] tracking-wide">
                        进入工作台
                      </button>
                  </form>
              </div>
          </div>
      )
  }

  return (
    // 使用 fixed inset-0 确保在移动端是真正的全屏，避免滚动溢出
    <div className="fixed inset-0 flex flex-col bg-[#050510] text-gray-100 font-sans overflow-hidden">
      
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-blue-900/10 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-900/10 rounded-full blur-[100px] animate-pulse" style={{animationDelay: '1s'}} />
      </div>

      {/* Header (Glassmorphism) */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 md:px-6 py-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-md bg-black/10 border-b border-white/5">
        <div className="flex items-center gap-3 w-full md:w-auto overflow-hidden">
          <button onClick={() => setShowHistoryPanel(true)} className="text-gray-400 hover:text-white p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors"><ClockIcon /></button>
          
          <div className="hidden md:flex items-center gap-2 text-indigo-400">
             <SparklesIcon />
             <span className="font-bold text-lg text-white/90 tracking-tight">Nebula</span>
          </div>

          <div className="h-6 w-[1px] bg-white/10 hidden md:block mx-1"></div>

          <div className="relative flex-1 md:flex-none min-w-0 max-w-[200px] md:max-w-xs group">
            <select value={selectedModel.id} onChange={handleModelChange} className="w-full appearance-none bg-white/5 border border-white/10 text-indigo-100 py-1.5 pl-3 pr-8 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500/50 text-sm font-medium cursor-pointer truncate transition-colors hover:bg-white/10">
              {AVAILABLE_MODELS.map(model => (
                <option key={model.id} value={model.id} className="bg-[#161b22] text-white">{model.name}</option>
              ))}
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-400 text-xs">▼</div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 shrink-0 ml-2">
             <div className="hidden md:flex items-center gap-2 text-xs text-gray-500 mr-2">
                <span className={`w-2 h-2 rounded-full ${activeProxy?.isOk ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`}></span>
                {activeProxy?.isOk ? `${activeProxy.latency}ms` : '断开'}
             </div>
             <button onClick={() => { setSettingsTab('keys'); setShowNetworkPanel(true); }} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 hover:bg-white/10 hover:border-indigo-500/30 transition-all group">
                <span className="text-xs text-gray-400 font-medium group-hover:text-indigo-300 transition-colors hidden md:inline">配置</span>
                <Cog6ToothIcon />
             </button>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-y-auto custom-scrollbar relative z-10 pt-16 md:pt-20">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 pb-32 md:pb-36">
          {currentMessages.length === 0 ? (
            <div className="h-[60vh] flex flex-col items-center justify-center text-center px-6 animate-fade-in">
                <div className="w-20 h-20 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-500/20 mb-6">
                    <span className="text-white scale-150"><SparklesIcon /></span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">准备好探索了吗？</h2>
                <p className="text-gray-400 max-w-sm">选择一个模型，输入任何问题，让 Nebula 为您提供答案。</p>
            </div>
          ) : (
            currentMessages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
          )}
          {isLoading && (
            <div className="flex justify-start mb-6 animate-fade-in">
                <div className="flex items-center gap-3 bg-white/5 px-4 py-3 rounded-2xl border border-white/5 backdrop-blur-sm">
                    <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-100"></span>
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-200"></span>
                    </div>
                    <span className="text-xs text-gray-400 font-medium tracking-wide">Nebula 正在思考...</span>
                </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </main>

      {/* Floating Input Area */}
      <footer className="absolute bottom-0 left-0 right-0 z-20 p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-[#050510] via-[#050510]/90 to-transparent pointer-events-none">
        <div className="max-w-4xl mx-auto pointer-events-auto">
          {attachments.length > 0 && (
            <div className="flex gap-3 mb-3 overflow-x-auto pb-2 custom-scrollbar px-1">
              {attachments.map((att) => (
                <div key={att.id} className="relative group flex-shrink-0 animate-slide-up">
                  <div className="h-16 w-16 md:h-20 md:w-20 rounded-xl overflow-hidden border border-indigo-500/30 shadow-lg bg-[#161b22]">
                      {att.type === 'image' ? <img src={att.content} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-gray-400"><DocumentIcon /></div>}
                  </div>
                  <button onClick={() => setAttachments(p => p.filter(a => a.id !== att.id))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"><XMarkIcon /></button>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex items-end gap-2 bg-[#1c1c2e]/80 backdrop-blur-xl border border-white/10 rounded-[2rem] p-2 pl-4 shadow-2xl relative overflow-hidden ring-1 ring-white/5 transition-all focus-within:ring-indigo-500/40 focus-within:bg-[#1c1c2e]/95">
             {/* Decor */}
             <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50"></div>

            <div className="flex gap-1 shrink-0 pb-1.5">
                <button onClick={() => imageInputRef.current?.click()} className="p-2 text-gray-400 hover:text-indigo-400 hover:bg-white/5 rounded-full transition-colors"><ImageIcon /></button>
                <input type="file" ref={imageInputRef} onChange={(e) => handleFileSelect(e, 'image')} accept="image/*" className="hidden" multiple />
                
                <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-indigo-400 hover:bg-white/5 rounded-full transition-colors"><PaperClipIcon /></button>
                <input type="file" ref={fileInputRef} onChange={(e) => handleFileSelect(e, 'file')} accept=".pdf,.txt,.md,.js,.py" className="hidden" multiple />
            </div>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
              placeholder={isListening ? "正在聆听..." : `发送消息给 ${selectedModel.name}...`}
              className="w-full bg-transparent text-gray-200 placeholder-gray-500 py-3.5 max-h-32 min-h-[50px] resize-none focus:outline-none custom-scrollbar text-[16px] leading-relaxed"
              rows={1}
            />

            <div className="flex gap-2 shrink-0 pb-1.5 pr-1.5">
                <button onClick={toggleListening} className={`p-2.5 rounded-full transition-all ${isListening ? 'bg-red-500/20 text-red-400 animate-pulse' : 'text-gray-400 hover:text-indigo-400 hover:bg-white/5'}`}>
                    {isListening ? <StopIcon /> : <MicIcon />}
                </button>
                
                <button onClick={handleSend} disabled={(!input.trim() && attachments.length === 0) || isLoading} className="p-2.5 rounded-full bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:bg-gray-700 active:scale-95 transition-all shadow-lg shadow-indigo-500/20">
                    <SendIcon />
                </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Switch Context Modal */}
      {showSwitchModal && pendingModel && (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
             <div className="glass-panel rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center animate-slide-up border border-white/10">
                 <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-300 flex items-center justify-center mb-5 mx-auto ring-1 ring-white/10"><ChatBubbleLeftRightIcon /></div>
                 <h3 className="text-xl font-bold text-white mb-2">切换思维模型</h3>
                 <p className="text-sm text-gray-400 mb-6 leading-relaxed">从 <strong>{selectedModel.name}</strong> 切换到 <strong>{pendingModel.name}</strong>。<br/>是否保留当前上下文记忆？</p>
                 <div className="flex flex-col gap-3">
                     <button onClick={() => handleConfirmSwitch(true)} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium active:scale-[0.98] transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2">
                        <ArrowPathIcon /> 保留并继续
                     </button>
                     <button onClick={() => handleConfirmSwitch(false)} className="w-full py-3.5 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-xl active:scale-[0.98] transition-all">
                        开启新对话
                     </button>
                 </div>
             </div>
         </div>
      )}

      {/* History Sidebar */}
      {showHistoryPanel && (
          <div className="fixed inset-0 z-50 flex">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setShowHistoryPanel(false)}></div>
              <div className="relative w-80 max-w-[85vw] glass-panel border-r border-white/10 h-full shadow-2xl flex flex-col animate-slide-right bg-[#0b0c15]/90">
                  <div className="p-5 border-b border-white/5 flex justify-between items-center pt-[calc(env(safe-area-inset-top)+1.5rem)]">
                      <h3 className="font-bold text-lg text-white flex items-center gap-2"><ClockIcon /> 时光机</h3>
                      <button onClick={() => setShowHistoryPanel(false)} className="text-gray-500 hover:text-white transition-colors"><XMarkIcon /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                      {Object.entries(modelHistories).map(([modelId, msgs]) => {
                          const messages = msgs as Message[];
                          const modelInfo = AVAILABLE_MODELS.find(m => m.id === modelId);
                          if (!modelInfo || !messages.length) return null;
                          const isActive = selectedModel.id === modelId;
                          return (
                              <div key={modelId} onClick={() => { setSelectedModel(modelInfo); setShowHistoryPanel(false); }} className={`group p-4 rounded-2xl border cursor-pointer transition-all active:scale-[0.98] relative overflow-hidden ${isActive ? 'bg-indigo-500/20 border-indigo-500/50' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                                  {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>}
                                  <div className="flex justify-between items-start mb-1.5">
                                      <span className={`text-sm font-semibold ${isActive ? 'text-indigo-300' : 'text-gray-200'}`}>{modelInfo.name}</span>
                                      <span className="text-[10px] text-gray-600 bg-black/20 px-1.5 py-0.5 rounded">{messages.length}</span>
                                  </div>
                                  <p className="text-xs text-gray-500 truncate leading-relaxed">{messages[messages.length - 1].text || '...'}</p>
                                  <button onClick={(e) => clearHistoryForModel(modelId, e)} className="absolute bottom-3 right-3 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 p-1.5 rounded-lg backdrop-blur-sm"><TrashIcon /></button>
                              </div>
                          )
                      })}
                  </div>
                  <div className="p-4 border-t border-white/5 bg-black/20 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                      <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-red-500/10 hover:text-red-400 border border-white/5 text-gray-400 rounded-xl text-sm transition-all active:scale-[0.98] group">
                          <LogoutIcon /> 
                          <span className="group-hover:text-red-400 transition-colors">退出登录</span>
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Settings Panel */}
      {showNetworkPanel && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel rounded-3xl w-[95%] max-w-lg p-0 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-slide-up bg-[#0e0e16]/95 border border-white/10">
            <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/[0.02]">
                 <h3 className="font-bold text-lg text-white flex items-center gap-2"><Cog6ToothIcon /> 全局设置</h3>
                 <button onClick={() => setShowNetworkPanel(false)} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"><XMarkIcon /></button>
            </div>
            
            {/* Tabs */}
            <div className="flex p-1 mx-5 mt-4 bg-black/40 rounded-xl border border-white/5">
                <button onClick={() => setSettingsTab('keys')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${settingsTab === 'keys' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>🔑 模型密钥</button>
                <button onClick={() => setSettingsTab('network')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${settingsTab === 'network' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>🌐 网络隧道</button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-6">
                {settingsTab === 'keys' ? (
                    <div className="space-y-5">
                        <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl flex gap-3">
                            <div className="text-yellow-400 text-lg">⚠️</div>
                            <div className="text-xs text-yellow-200/80 leading-relaxed">
                                <strong>提示：</strong> 除 Google Gemini (内置免费) 外，其他模型需配置您自己的官方 API Key。Web 端直接调用建议开启“网络隧道”以避免 CORS 问题。
                            </div>
                        </div>

                        {/* Google */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-indigo-300 uppercase tracking-wider ml-1">Google Gemini Key</label>
                            <input 
                                type="password" 
                                value={apiKeys.google} 
                                onChange={(e) => setApiKeys({...apiKeys, google: e.target.value})}
                                placeholder="留空则使用内置免费 Key"
                                className="w-full bg-black/30 border border-white/10 text-white p-3.5 rounded-xl text-sm focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder-gray-600" 
                            />
                        </div>
                        
                        {/* DeepSeek */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold text-blue-300 uppercase tracking-wider ml-1">DeepSeek Key</label>
                                <a href="https://platform.deepseek.com/" target="_blank" className="text-[10px] text-blue-400/80 hover:text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">获取 Key</a>
                            </div>
                            <input 
                                type="password" 
                                value={apiKeys.deepseek} 
                                onChange={(e) => setApiKeys({...apiKeys, deepseek: e.target.value})}
                                placeholder="sk-..."
                                className="w-full bg-black/30 border border-white/10 text-white p-3.5 rounded-xl text-sm focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder-gray-600" 
                            />
                        </div>

                         {/* OpenAI */}
                         <div className="space-y-2">
                            <label className="text-xs font-bold text-green-300 uppercase tracking-wider ml-1">OpenAI Key</label>
                            <input 
                                type="password" 
                                value={apiKeys.openai} 
                                onChange={(e) => setApiKeys({...apiKeys, openai: e.target.value})}
                                placeholder="sk-..."
                                className="w-full bg-black/30 border border-white/10 text-white p-3.5 rounded-xl text-sm focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20 transition-all placeholder-gray-600" 
                            />
                        </div>

                         {/* XAI */}
                         <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-300 uppercase tracking-wider ml-1">xAI (Grok) Key</label>
                            <input 
                                type="password" 
                                value={apiKeys.xai} 
                                onChange={(e) => setApiKeys({...apiKeys, xai: e.target.value})}
                                placeholder="key..."
                                className="w-full bg-black/30 border border-white/10 text-white p-3.5 rounded-xl text-sm focus:border-white/50 focus:ring-1 focus:ring-white/20 transition-all placeholder-gray-600" 
                            />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Node List Logic */}
                         <div className="flex justify-between items-end mb-2 px-1">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">可用节点 (Base URL)</h4>
                            <button onClick={runNetworkCheck} className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 active:scale-95 bg-indigo-500/10 px-2 py-1 rounded-md border border-indigo-500/20">⚡ 刷新测速</button>
                        </div>
                        <div className="space-y-3">
                            {proxyList.map((proxy) => (
                                <div key={proxy.id} onClick={() => setActiveProxy(proxy)} className={`flex items-center justify-between p-4 rounded-xl cursor-pointer border transition-all active:scale-[0.99] group ${activeProxy?.id === proxy.id ? 'bg-indigo-600/20 border-indigo-500/50 shadow-inner' : 'bg-black/20 border-white/5 hover:bg-white/5'}`}>
                                    <div className="flex items-center gap-3.5">
                                        <div className={`relative w-2.5 h-2.5 rounded-full shrink-0 ${proxy.isOk ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`}>
                                            {activeProxy?.id === proxy.id && <div className="absolute inset-0 rounded-full animate-ping opacity-75 bg-green-500"></div>}
                                        </div>
                                        <div className="flex flex-col overflow-hidden">
                                            <span className={`text-sm font-semibold truncate ${activeProxy?.id === proxy.id ? 'text-white' : 'text-gray-300'}`}>{proxy.name}</span>
                                            <span className="text-[10px] text-gray-500 truncate font-mono">{proxy.url}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className={`text-xs font-mono font-bold ${proxy.latency < 200 ? 'text-green-400' : 'text-yellow-400'}`}>{proxy.latency === -1 ? '...' : (proxy.latency === Infinity ? 'X' : proxy.latency + 'ms')}</span>
                                        {proxy.isCustom && <button onClick={(e) => removeCustomNode(proxy.id, e)} className="text-gray-600 hover:text-red-400 p-1.5 bg-white/5 rounded-md hover:bg-white/10 transition-colors"><XMarkIcon /></button>}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Add Node */}
                         <div className="bg-black/30 border border-dashed border-white/10 rounded-2xl p-5 mt-2">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2"><span className="text-lg">+</span> 添加自定义隧道</h4>
                            <div className="grid gap-3">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <input type="text" placeholder="别名" value={customNodeName} onChange={(e) => setCustomNodeName(e.target.value)} className="col-span-1 bg-[#0b0c15] border border-white/10 text-white text-xs p-3 rounded-xl focus:border-indigo-500/50 outline-none" />
                                    <input type="text" placeholder="URL (例如 https://api.openai-proxy.com)" value={customNodeUrl} onChange={(e) => setCustomNodeUrl(e.target.value)} className="col-span-1 md:col-span-2 bg-[#0b0c15] border border-white/10 text-white text-xs p-3 rounded-xl focus:border-indigo-500/50 outline-none" />
                                </div>
                                <button onClick={addCustomNode} className="w-full py-3 bg-white/5 hover:bg-white/10 text-gray-300 font-medium rounded-xl text-xs border border-white/5 active:scale-[0.98] transition-all">确认添加并测试</button>
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
