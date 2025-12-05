import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Message } from '../types';
import { BotIcon, UserIcon, DocumentIcon, ClipboardIcon, CheckIcon } from './Icons';

interface ChatMessageProps {
  message: Message;
}

const CodeBlock = ({ inline, className, children, ...props }: any) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (inline) {
    return (
      <code className="bg-white/10 text-indigo-200 px-1.5 py-0.5 rounded text-[85%] font-mono border border-white/5" {...props}>
        {children}
      </code>
    );
  }

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-white/10 bg-[#0d0d14] shadow-xl group">
      <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a24] border-b border-white/5">
        <div className="flex items-center gap-2">
            <div className="flex gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
            </div>
            {lang && <span className="ml-2 text-xs text-gray-400 font-mono lowercase opacity-0 group-hover:opacity-100 transition-opacity">{lang}</span>}
        </div>
        <button 
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-2 py-1 rounded-md"
        >
          {copied ? <CheckIcon /> : <ClipboardIcon />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={lang}
        PreTag="div"
        customStyle={{ margin: 0, padding: '1.25rem', background: 'transparent', fontSize: '0.9rem', lineHeight: '1.5' }}
        {...props}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    </div>
  );
};

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isBot = message.role === 'model';
  const isError = message.isError;
  const attachments = message.attachments || [];

  return (
    <div className={`flex w-full ${isBot ? 'justify-start' : 'justify-end'} mb-6 md:mb-8 group animate-fade-in`}>
      <div className={`flex max-w-[95%] md:max-w-[85%] gap-3 md:gap-4 ${isBot ? 'flex-row' : 'flex-row-reverse'}`}>
        
        {/* Avatar */}
        <div className={`
          flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center 
          ${isBot ? 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]' : 'bg-gray-700 shadow-md'}
          mt-1 ring-2 ring-white/5
        `}>
          {isBot ? <BotIcon /> : <UserIcon />}
        </div>

        {/* Content Bubble */}
        <div className={`
          flex flex-col gap-2 p-3.5 md:p-5 rounded-3xl shadow-lg min-w-0 backdrop-blur-sm
          ${isBot 
            ? 'glass-bubble text-gray-100 rounded-tl-none' 
            : 'bg-gradient-to-br from-blue-600 to-violet-600 text-white rounded-tr-none shadow-[0_4px_15px_rgba(79,70,229,0.25)] border border-white/10'
          }
          ${isError ? 'border-red-500/30 bg-red-900/10 text-red-200' : ''}
        `}>
          
          {/* Attachments Grid */}
          {attachments.length > 0 && (
            <div className={`grid gap-2 mb-2 ${attachments.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {attachments.map((att) => (
                <div key={att.id} className="overflow-hidden rounded-xl group/att relative border border-white/10">
                  {att.type === 'image' ? (
                    <div className="relative">
                      <img 
                        src={att.content} 
                        alt="User upload" 
                        className="max-h-64 w-full object-cover transition-transform duration-500 group-hover/att:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover/att:bg-black/10 transition-colors"></div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-black/20 hover:bg-black/30 transition-colors">
                      <div className="p-2 bg-white/10 rounded-lg text-white/90">
                        <DocumentIcon />
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-medium truncate w-full">{att.name}</span>
                        <span className="text-[10px] opacity-60 uppercase tracking-wider">{att.mimeType.split('/').pop()?.toUpperCase()} 文件</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Text Content (Markdown) */}
          <div className="markdown-body text-[15px] md:text-[16px] leading-7 font-normal break-words tracking-normal">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code: CodeBlock,
                table: ({node, ...props}) => (
                    <div className="overflow-x-auto my-4 rounded-xl border border-white/10 shadow-sm">
                        <table className="min-w-full text-sm text-left" {...props} />
                    </div>
                ),
                thead: ({node, ...props}) => <thead className="bg-white/5 text-xs uppercase text-gray-300 font-bold" {...props} />,
                tr: ({node, ...props}) => <tr className="hover:bg-white/5 transition-colors border-b border-white/5 last:border-0" {...props} />,
                
                a: ({node, ...props}) => <a className="text-blue-300 hover:text-white underline decoration-blue-400/50 hover:decoration-white transition-all underline-offset-2" target="_blank" rel="noopener noreferrer" {...props} />,
                p: ({node, ...props}) => <p className="mb-4 last:mb-0" {...props} />,
                ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-2 marker:text-indigo-400" {...props} />,
                ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-2 marker:text-indigo-400 font-medium" {...props} />,
                blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-indigo-500/50 pl-4 py-2 my-4 bg-indigo-900/10 rounded-r-lg text-indigo-100/80 italic" {...props} />,
                h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-8 mb-4 pb-2 border-b border-white/10 flex items-center gap-2" {...props} />,
                h2: ({node, ...props}) => <h2 className="text-xl font-bold mt-6 mb-3 text-white/90" {...props} />,
                h3: ({node, ...props}) => <h3 className="text-lg font-semibold mt-5 mb-2 text-white/90" {...props} />,
                hr: ({node, ...props}) => <hr className="my-6 border-white/10" {...props} />,
                img: ({node, ...props}) => <img className="rounded-xl max-w-full my-3 border border-white/10 shadow-lg" {...props} />
              }}
            >
              {message.text}
            </ReactMarkdown>
          </div>
          
          {/* Timestamp */}
          <div className={`text-[10px] opacity-40 mt-1 select-none font-medium flex gap-1 ${isBot ? 'flex-row' : 'flex-row-reverse'}`}>
            <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
