
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Message, Attachment } from '../types';
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
      <code className="bg-black/30 text-indigo-200 px-1.5 py-0.5 rounded text-[85%] font-mono" {...props}>
        {children}
      </code>
    );
  }

  return (
    <div className="my-4 rounded-lg overflow-hidden border border-gray-700 bg-[#1e1e1e] shadow-lg">
      <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-gray-700">
        <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
            </div>
            {lang && <span className="ml-2 text-xs text-gray-400 font-mono lowercase">{lang}</span>}
        </div>
        <button 
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
        >
          {copied ? <><CheckIcon /> Copied</> : <><ClipboardIcon /> Copy</>}
        </button>
      </div>
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={lang}
        PreTag="div"
        customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '0.9rem' }}
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
    <div className={`flex w-full ${isBot ? 'justify-start' : 'justify-end'} mb-6 group animate-fade-in`}>
      <div className={`flex max-w-[95%] md:max-w-[85%] gap-3 ${isBot ? 'flex-row' : 'flex-row-reverse'}`}>
        
        {/* Avatar */}
        <div className={`
          flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center 
          ${isBot ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-gray-700'}
          shadow-md mt-1
        `}>
          {isBot ? <BotIcon /> : <UserIcon />}
        </div>

        {/* Content Bubble */}
        <div className={`
          flex flex-col gap-2 p-4 rounded-2xl shadow-sm min-w-0
          ${isBot 
            ? 'bg-gray-800/80 border border-gray-700/50 rounded-tl-none text-gray-100' 
            : 'bg-indigo-600 text-white rounded-tr-none'
          }
          ${isError ? 'border-red-500/50 bg-red-900/20 text-red-200' : ''}
        `}>
          
          {/* Attachments Grid */}
          {attachments.length > 0 && (
            <div className={`grid gap-2 mb-2 ${attachments.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {attachments.map((att) => (
                <div key={att.id} className="overflow-hidden">
                  {att.type === 'image' ? (
                    <div className="rounded-lg overflow-hidden border border-gray-600/30">
                      <img 
                        src={att.content} 
                        alt="User upload" 
                        className="max-h-64 w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-black/20 border border-white/10">
                      <div className="p-2 bg-white/10 rounded-md text-white/80">
                        <DocumentIcon />
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-xs font-medium truncate w-full">{att.name}</span>
                        <span className="text-[10px] opacity-60 uppercase">{att.mimeType.split('/').pop()?.toUpperCase()} 文件</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Text Content (Markdown) */}
          <div className="markdown-body text-sm md:text-base leading-relaxed font-light break-words">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code: CodeBlock,
                // Custom renderer for tables to add horizontal scroll
                table: ({node, ...props}) => (
                    <div className="overflow-x-auto my-4 border border-gray-700 rounded-lg">
                        <table className="min-w-full text-sm text-left" {...props} />
                    </div>
                ),
                thead: ({node, ...props}) => <thead className="bg-gray-700/50 text-xs uppercase text-gray-300" {...props} />,
                tbody: ({node, ...props}) => <tbody className="divide-y divide-gray-700" {...props} />,
                tr: ({node, ...props}) => <tr className="hover:bg-gray-700/30 transition-colors" {...props} />,
                th: ({node, ...props}) => <th className="px-4 py-3 font-medium tracking-wider" {...props} />,
                td: ({node, ...props}) => <td className="px-4 py-3 whitespace-nowrap border-r border-gray-700 last:border-r-0" {...props} />,
                
                // Custom styling for other elements
                a: ({node, ...props}) => <a className="text-indigo-400 hover:text-indigo-300 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                p: ({node, ...props}) => <p className="mb-3 last:mb-0" {...props} />,
                ul: ({node, ...props}) => <ul className="list-disc pl-6 mb-3 space-y-1" {...props} />,
                ol: ({node, ...props}) => <ol className="list-decimal pl-6 mb-3 space-y-1" {...props} />,
                blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-indigo-500 pl-4 py-1 my-3 bg-gray-900/50 rounded-r text-gray-400 italic" {...props} />,
                h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-6 mb-4 pb-2 border-b border-gray-700" {...props} />,
                h2: ({node, ...props}) => <h2 className="text-xl font-bold mt-5 mb-3" {...props} />,
                h3: ({node, ...props}) => <h3 className="text-lg font-semibold mt-4 mb-2" {...props} />,
                img: ({node, ...props}) => <img className="rounded-lg max-w-full my-2 border border-gray-700" {...props} />
              }}
            >
              {message.text}
            </ReactMarkdown>
          </div>
          
          {/* Timestamp */}
          <div className={`text-[10px] opacity-40 mt-1 select-none ${isBot ? 'text-left' : 'text-right'}`}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
