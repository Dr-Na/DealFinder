'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  MessageSquare, 
  Info, 
  Settings, 
  Plus, 
  Image as ImageIcon, 
  Send, 
  User, 
  Bot, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  TrendingUp,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Sun,
  Moon,
  Palette,
  History,
  LayoutDashboard,
  FileText,
  Zap,
  PanelLeftClose,
  MoreVertical,
  X,
  ZoomIn,
  Crown,
  ShoppingBag,
  LayoutGrid,
  Loader2,
  Share2,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ReactMarkdown from 'react-markdown';
import { getGeminiClient, ANALYSIS_SCHEMA, SEARCH_RESULTS_SCHEMA } from '@/lib/gemini';
import { Type, ThinkingLevel } from '@google/genai';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  analysis?: any;
};

type SearchResult = {
  id: string;
  title: string;
  price: string;
  platform: string;
  imageUrl: string;
  discount?: string;
  url: string;
};

type Theme = 'light' | 'dark';
type ColorTheme = {
  name: string;
  primary: string;
};

const COLOR_THEMES: ColorTheme[] = [
  { name: 'Emerald', primary: '#10b981' },
  { name: 'Indigo', primary: '#6366f1' },
  { name: 'Rose', primary: '#f43f5e' },
  { name: 'Amber', primary: '#f59e0b' },
  { name: 'Sky', primary: '#0ea5e9' },
  { name: 'Violet', primary: '#8b5cf6' },
];

export default function DealFinderApp() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sidebarInput, setSidebarInput] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [theme, setTheme] = useState<Theme>('dark');
  const [primaryColor, setPrimaryColor] = useState(COLOR_THEMES[0].primary);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [activeAnalysis, setActiveAnalysis] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showDetail, setShowDetail] = useState(true);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--primary', primaryColor);
  }, [primaryColor]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setSelectedImage(reader.result as string);
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  const sendMessage = async (text?: string) => {
    const messageText = text || input;
    if (!messageText && !selectedImage) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      image: selectedImage || undefined,
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSelectedImage(null);
    setIsTyping(true);

    try {
      const ai = getGeminiClient();
      
      const parts: any[] = [{ text: messageText }];
      if (userMsg.image) {
        parts.push({
          inlineData: {
            mimeType: "image/png",
            data: userMsg.image.split(',')[1],
          },
        });
      }

      // Logic: 
      // 1. If image -> gemini-3.1-pro-preview (Image understanding)
      // 2. If complex/thinking requested -> gemini-3.1-pro-preview + ThinkingLevel.HIGH
      // 3. If web search needed -> gemini-3-flash-preview + googleSearch
      
      const isComplex = messageText.length > 100 || messageText.toLowerCase().includes('phân tích') || messageText.toLowerCase().includes('so sánh');
      const isLocation = messageText.toLowerCase().includes('ở đâu') || messageText.toLowerCase().includes('gần đây') || messageText.toLowerCase().includes('địa chỉ');
      
      let modelName = "gemini-3-flash-preview";
      if (userMsg.image || isComplex) modelName = "gemini-3.1-pro-preview";
      if (isLocation) modelName = "gemini-2.5-flash";
      
      const config: any = {
        systemInstruction: `Bạn là "DealFinder AI" – Chiến lược gia mua sắm sắc sảo tại Việt Nam.
Sứ mệnh của bạn là giúp người dùng đưa ra quyết định mua sắm dựa trên dữ liệu thực tế, tránh hàng giả và tối ưu hóa chi phí.

[TƯ DUY CHIẾN LƯỢC]
1. Luôn ưu tiên: Giá sau cùng (Final Price) > Độ uy tín (Mall/Official) > Phản hồi thực tế.
2. Phát hiện rủi ro: Flag "RỦI RO CAO" nếu giá thấp bất thường (>30%), shop mới, hoặc review seeding.
3. Logic tính giá: [Giá gốc] - [Voucher Shop] - [Voucher Sàn] - [Voucher Thanh toán] - [Giảm xu] + [Phí ship].

Hãy trả về phản hồi dưới dạng JSON nếu có thể phân tích sản phẩm, hoặc text nếu là hội thoại thông thường.
Nếu phân tích sản phẩm, hãy tuân thủ schema đã định.`,
        responseMimeType: isLocation ? undefined : "application/json",
        responseSchema: isLocation ? undefined : ANALYSIS_SCHEMA,
      };

      if (modelName === "gemini-3.1-pro-preview") {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
      } else if (modelName === "gemini-2.5-flash") {
        config.tools = [{ googleMaps: {} }];
      } else {
        config.tools = [{ googleSearch: {} }];
      }

      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: "user", parts }],
        config
      });

      let analysis = null;
      let content = response.text || "";

      if (config.responseMimeType === "application/json") {
        try {
          analysis = JSON.parse(content);
          content = `Đã phân tích xong sản phẩm: **${analysis.productName}**. Xem chi tiết ở bảng bên phải.`;
        } catch (e) {
          console.error("Failed to parse JSON", e);
        }
      }
      
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: content,
        analysis: analysis,
      };

      setMessages(prev => [...prev, assistantMsg]);
      if (analysis) setActiveAnalysis(analysis);
    } catch (error) {
      console.error(error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Xin lỗi, tôi gặp lỗi khi phân tích dữ liệu. Vui lòng thử lại.",
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSidebarSearch = async () => {
    if (!sidebarInput) return;
    setIsSearching(true);
    try {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: `Tìm kiếm sản phẩm: ${sidebarInput}. Trả về danh sách các deal tốt nhất từ các sàn thương mại điện tử tại Việt Nam (Shopee, Lazada, Tiki).` }] }],
        config: {
          systemInstruction: "Bạn là chuyên gia tìm kiếm deal tại Việt Nam. Hãy tìm các sản phẩm thực tế từ Shopee, Lazada, Tiki. Trả về danh sách JSON theo schema. Chú ý: title phải đầy đủ, price phải có đơn vị đ hoặc VNĐ, platform phải là tên sàn (viết hoa), imageUrl phải là link ảnh thực tế nếu tìm được, url là link sản phẩm. Nếu không tìm thấy, trả về mảng rỗng.",
          responseMimeType: "application/json",
          responseSchema: SEARCH_RESULTS_SCHEMA,
          tools: [{ googleSearch: {} }]
        }
      });

      const text = response.text || "[]";
      const jsonStr = text.replace(/```json\n?|```/g, "").trim();
      const results = JSON.parse(jsonStr || "[]");
      setSearchResults(results.map((r: any, i: number) => ({ ...r, id: r.id || `res-${i}` })));
    } catch (error) {
      console.error("Sidebar search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden font-sans" onPaste={handlePaste}>
      {/* Sidebar - Cột 1 (NotebookLM Style) */}
      <AnimatePresence>
        {showSidebar && (
          <motion.aside 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-r border-border bg-sidebar flex flex-col overflow-hidden"
          >
            <div className="p-4 flex items-center justify-between shrink-0">
              <h2 className="text-sm font-medium text-text-p">Sản phẩm</h2>
              <button onClick={() => setShowSidebar(false)} className="text-text-s hover:text-text-p transition-colors">
                <PanelLeftClose size={18} />
              </button>
            </div>

            <div className="px-4 pb-4 space-y-4 shrink-0">
              <button 
                onClick={() => {
                  setMessages([]);
                  setSearchResults([]);
                }}
                className="w-full flex items-center justify-center gap-2 bg-card hover:bg-border text-text-p py-2.5 rounded-full text-sm font-medium transition-colors border border-border"
              >
                <Plus size={16} />
                Thêm sản phẩm
              </button>

              <div className="bg-main rounded-2xl p-3 border border-border space-y-3">
                <div className="flex items-center gap-2 text-text-s px-1">
                  <Search size={16} />
                  <input 
                    type="text" 
                    placeholder="Tìm kiếm sản phẩm..." 
                    className="bg-transparent border-none focus:ring-0 text-sm w-full p-0 placeholder-text-m"
                    value={sidebarInput}
                    onChange={(e) => setSidebarInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSidebarSearch();
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <button className="flex items-center gap-1 px-2 py-1 rounded-full bg-card text-[11px] text-text-p border border-border">
                      <LayoutGrid size={12} />
                      Web
                      <ChevronDown size={10} />
                    </button>
                    <button className="flex items-center gap-1 px-2 py-1 rounded-full bg-card text-[11px] text-text-p border border-border">
                      <TrendingUp size={12} />
                      Fast research
                      <ChevronDown size={10} />
                    </button>
                  </div>
                  <button 
                    onClick={() => handleSidebarSearch()}
                    className="w-7 h-7 rounded-full bg-card flex items-center justify-center text-text-s hover:bg-border"
                  >
                    {isSearching ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={16} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar">
              {searchResults.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-60">
                  <div className="w-12 h-12 flex items-center justify-center">
                    <FileText size={32} className="text-text-m" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-text-p">Sản phẩm đã lưu sẽ xuất hiện ở đây</p>
                    <p className="text-xs text-text-m leading-relaxed">
                      Nhấn Thêm sản phẩm ở trên hoặc tìm kiếm để thêm link sản phẩm, hình ảnh hoặc tệp văn bản.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {searchResults.map((result) => (
                    <button 
                      key={result.id}
                      onClick={() => sendMessage(`Phân tích deal này: ${result.title} tại ${result.platform} - ${result.url}`)}
                      className="w-full bg-card border border-border rounded-xl p-3 text-left hover:bg-border transition-all group relative overflow-hidden"
                    >
                      <div className="flex gap-3">
                        <div className="w-16 h-16 bg-white rounded-lg overflow-hidden shrink-0 border border-border">
                          <img src={result.imageUrl} alt={result.title} className="w-full h-full object-contain" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-text-s uppercase tracking-wider">{result.platform}</span>
                            {result.discount && (
                              <div className="flex items-center gap-1 text-[10px] text-red-500 font-bold">
                                <Tag size={10} />
                                {result.discount}
                              </div>
                            )}
                          </div>
                          <h4 className="text-[11px] font-medium text-text-p line-clamp-2 leading-tight">{result.title}</h4>
                          <p className="text-sm font-bold text-emerald-500">{result.price}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border space-y-2">
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-card text-sm text-text-s"
              >
                <Settings size={16} />
                <span>Cài đặt giao diện</span>
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Chat - Cột 2 */}
      <main className="flex-1 flex flex-col bg-main relative">
        <header className="h-14 border-b border-border/30 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {!showSidebar && (
              <button onClick={() => setShowSidebar(true)} className="p-2 hover:bg-card rounded-lg text-text-s">
                <ChevronRight size={20} />
              </button>
            )}
            <h2 className="font-medium text-text-p">Cuộc trò chuyện</h2>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                setMessages([]);
                setSearchResults([]);
              }}
              className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-card hover:bg-border rounded-full text-xs text-text-p border border-border transition-colors"
            >
              <Plus size={14} />
              Tạo tìm kiếm mới
            </button>
            <button className="p-2 hover:bg-card rounded-lg text-text-s">
              <Share2 size={20} />
            </button>
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-card rounded-lg text-text-s"
            >
              <Settings size={20} />
            </button>
            <button 
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2 hover:bg-card rounded-lg text-text-s"
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            {!showDetail && (
              <button onClick={() => setShowDetail(true)} className="p-2 hover:bg-card rounded-lg text-text-s">
                <Info size={20} />
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 max-w-md mx-auto">
              <div className="w-16 h-16 bg-card rounded-2xl flex items-center justify-center text-primary">
                <ShoppingBag size={32} />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-medium text-text-p">DealFinder AI</h1>
                <p className="text-sm text-text-s">
                  {searchResults.length} sản phẩm đang theo dõi. Hãy bắt đầu bằng cách thêm sản phẩm hoặc tìm kiếm deal.
                </p>
              </div>
              <button 
                onClick={() => sendMessage("Phân tích deal hot hôm nay")}
                className="px-6 py-2.5 bg-primary text-white rounded-full text-sm font-medium hover:opacity-90 transition-all"
              >
                Bắt đầu ngay
              </button>
            </div>
          )}

          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={cn(
                "flex gap-4 max-w-3xl mx-auto w-full",
                msg.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-card flex items-center justify-center text-primary shrink-0">
                  <Bot size={18} />
                </div>
              )}
              <div className={cn(
                "space-y-2 max-w-[85%]",
                msg.role === 'user' ? "flex flex-col items-end" : "flex flex-col items-start"
              )}>
                {msg.image && (
                  <div className="rounded-xl overflow-hidden border border-border bg-sidebar">
                    <img src={msg.image} alt="User upload" className="max-w-full h-auto max-h-64 object-contain" />
                  </div>
                )}
                <div className={cn(
                  "p-4 rounded-2xl text-[15px] leading-relaxed",
                  msg.role === 'user' ? "bg-card text-text-p" : "bg-transparent text-text-p"
                )}>
                  <div className="markdown-body">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
                
                {msg.analysis && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button 
                      onClick={() => sendMessage(`So sánh giá: ${msg.analysis.productName} vs sản phẩm tương tự`)}
                      className="px-3 py-1.5 rounded-full bg-card border border-border text-[11px] text-text-s hover:bg-border transition-colors flex items-center gap-1"
                    >
                      <Search size={12} />
                      So sánh giá
                    </button>
                    <button 
                      onClick={() => sendMessage(`So sánh uy tín các Shop đang bán ${msg.analysis.productName}`)}
                      className="px-3 py-1.5 rounded-full bg-card border border-border text-[11px] text-text-s hover:bg-border transition-colors flex items-center gap-1"
                    >
                      <ShieldCheck size={12} />
                      So sánh uy tín
                    </button>
                    <button 
                      onClick={() => sendMessage(`Phân tích rủi ro ẩn của ${msg.analysis.productName}`)}
                      className="px-3 py-1.5 rounded-full bg-card border border-border text-[11px] text-text-s hover:bg-border transition-colors flex items-center gap-1"
                    >
                      <AlertTriangle size={12} />
                      Phân tích rủi ro
                    </button>
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shrink-0">
                  <User size={18} />
                </div>
              )}
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-4 max-w-3xl mx-auto">
              <div className="w-8 h-8 rounded-lg bg-card flex items-center justify-center text-primary shrink-0">
                <Bot size={18} />
              </div>
              <div className="px-5 py-3.5 flex items-center gap-3 text-text-s">
                <Loader2 className="animate-spin" size={18} />
                <span className="text-sm">Đang suy nghĩ...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 bg-main">
          <div className="max-w-3xl mx-auto space-y-4">
            {selectedImage && (
              <div className="relative inline-block">
                <img src={selectedImage} className="h-20 w-20 object-cover rounded-lg border border-primary" />
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            <div className="relative flex items-center gap-2 bg-input-bg border border-border rounded-full px-4 py-2 focus-within:border-text-s transition-colors">
              <label className="p-2 hover:bg-border rounded-full cursor-pointer text-text-s transition-colors">
                <ImageIcon size={20} />
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
              <input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    sendMessage();
                  }
                }}
                placeholder="Bắt đầu nhập..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-[15px] text-text-p py-2 placeholder-text-s"
              />
              <button 
                onClick={() => sendMessage()}
                disabled={!input && !selectedImage}
                className="p-2 bg-text-p text-main rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:bg-white"
              >
                <Send size={18} />
              </button>
            </div>
            <p className="text-center text-[11px] text-text-m">
              DealFinder AI có thể đưa ra thông tin không chính xác; hãy kiểm tra kỹ giá và mã giảm giá trên sàn.
            </p>
          </div>
        </div>
      </main>

      {/* Detail Panel - Cột 3 */}
      <AnimatePresence>
        {showDetail && (
          <motion.aside 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 380, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-l border-border/30 bg-sidebar flex flex-col overflow-hidden shrink-0"
          >
            <div className="p-4 border-b border-border/30 flex items-center justify-between shrink-0">
              <h2 className="text-sm font-medium text-text-p flex items-center gap-2">
                <LayoutDashboard size={18} className="text-primary" />
                Chi tiết sản phẩm
              </h2>
              <button onClick={() => setShowDetail(false)} className="text-text-s hover:text-text-p transition-colors">
                <PanelLeftClose size={18} className="rotate-180" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {!activeAnalysis ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 opacity-50 text-text-s">
                  <Search size={48} />
                  <p className="text-sm">Chưa có sản phẩm nào được phân tích. Hãy bắt đầu bằng cách gửi link hoặc ảnh.</p>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                  {/* 1. Tổng quan */}
                  <section className="space-y-3">
                    <div className="aspect-square rounded-2xl bg-white border border-border overflow-hidden relative">
                      {activeAnalysis.imageUrl ? (
                        <img src={activeAnalysis.imageUrl} alt={activeAnalysis.productName} className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-text-m">
                          <ImageIcon size={48} />
                        </div>
                      )}
                      <div className={cn(
                        "absolute top-3 right-3 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        activeAnalysis.riskLevel === 'Thấp' ? "bg-emerald-500 text-white" : 
                        activeAnalysis.riskLevel === 'Trung bình' ? "bg-amber-500 text-white" : "bg-red-500 text-white"
                      )}>
                        Rủi ro: {activeAnalysis.riskLevel}
                      </div>
                    </div>
                    <h3 className="text-lg font-bold leading-tight text-text-p">{activeAnalysis.productName}</h3>
                    {activeAnalysis.purchaseUrl && (
                      <a 
                        href={activeAnalysis.purchaseUrl} 
                        target="_blank" 
                        className="flex items-center justify-center gap-2 w-full py-2 bg-primary/10 text-primary rounded-xl text-sm font-semibold hover:bg-primary/20 transition-colors"
                      >
                        Đến nơi bán <ExternalLink size={14} />
                      </a>
                    )}
                  </section>

                  {/* 2. Chi tiết giá */}
                  <section className="bg-card rounded-2xl border border-border p-4 space-y-3">
                    <h4 className="text-xs font-bold uppercase text-text-m tracking-widest">Phân tích giá (VNĐ)</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-text-s">Giá gốc</span>
                        <span className="font-mono text-text-p">{activeAnalysis.priceDetails.originalPrice}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-text-s flex items-center gap-1">
                          {activeAnalysis.priceDetails.shopVoucher ? <CheckCircle size={12} className="text-emerald-500" /> : <XCircle size={12} className="text-red-500" />}
                          Voucher Shop
                        </span>
                        <span className="font-mono text-emerald-500">-{activeAnalysis.priceDetails.shopVoucher || '0'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-text-s flex items-center gap-1">
                          {activeAnalysis.priceDetails.platformVoucher ? <CheckCircle size={12} className="text-emerald-500" /> : <XCircle size={12} className="text-red-500" />}
                          Voucher Sàn
                        </span>
                        <span className="font-mono text-emerald-500">-{activeAnalysis.priceDetails.platformVoucher || '0'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-text-s">Phí vận chuyển</span>
                        <span className="font-mono text-red-500">+{activeAnalysis.priceDetails.shippingFee || '0'}</span>
                      </div>
                      <div className="pt-2 border-t border-border flex justify-between items-center">
                        <span className="font-bold text-text-p">Giá cuối cùng</span>
                        <span className="text-xl font-display font-bold text-primary">{activeAnalysis.priceDetails.finalPrice}</span>
                      </div>
                    </div>
                  </section>

                  {/* 3. Độ uy tín */}
                  <section className="space-y-3">
                    <h4 className="text-xs font-bold uppercase text-text-m tracking-widest">Độ uy tín & Trạng thái</h4>
                    <div className="flex items-center gap-4">
                      <div className="relative w-16 h-16 flex items-center justify-center">
                        <svg className="w-full h-full -rotate-90">
                          <circle cx="32" cy="32" r="28" fill="transparent" stroke="currentColor" strokeWidth="4" className="text-border" />
                          <circle 
                            cx="32" cy="32" r="28" fill="transparent" stroke="var(--primary)" strokeWidth="4" 
                            strokeDasharray={175.9} 
                            strokeDashoffset={175.9 * (1 - activeAnalysis.reputation.score / 10)} 
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="absolute font-display font-bold text-lg text-text-p">{activeAnalysis.reputation.score}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-text-p">{activeAnalysis.reputation.status}</span>
                          {activeAnalysis.reputation.status.includes('Mall') && <ShieldCheck size={16} className="text-primary" />}
                        </div>
                        <p className="text-xs text-text-s">{activeAnalysis.reputation.reason}</p>
                      </div>
                    </div>
                  </section>

                  {/* 4. Review */}
                  <section className="space-y-3">
                    <h4 className="text-xs font-bold uppercase text-text-m tracking-widest">Phân tích Review</h4>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-1">
                        <p className="text-[10px] font-bold text-emerald-600 uppercase">Ưu điểm</p>
                        <ul className="text-xs space-y-1 text-text-s">
                          {activeAnalysis.reviews.pros.map((p: string, i: number) => (
                            <li key={i} className="flex items-start gap-1">
                              <span className="text-emerald-500 mt-0.5">•</span>
                              {p}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl space-y-1">
                        <p className="text-[10px] font-bold text-red-600 uppercase">Nhược điểm</p>
                        <ul className="text-xs space-y-1 text-text-s">
                          {activeAnalysis.reviews.cons.map((c: string, i: number) => (
                            <li key={i} className="flex items-start gap-1">
                              <span className="text-red-500 mt-0.5">•</span>
                              {c}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    {activeAnalysis.reviews.majorConcern && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex gap-2">
                        <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                        <div>
                          <p className="text-[10px] font-bold text-amber-600 uppercase">MAJOR CONCERN</p>
                          <p className="text-xs text-text-p">{activeAnalysis.reviews.majorConcern}</p>
                        </div>
                      </div>
                    )}
                  </section>

                  {/* 5. Kết luận */}
                  <section className="pt-4 border-t border-border">
                    <div className={cn(
                      "p-4 rounded-2xl border flex flex-col items-center text-center space-y-2",
                      activeAnalysis.conclusion.includes('Nên mua') ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30"
                    )}>
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center mb-1",
                        activeAnalysis.conclusion.includes('Nên mua') ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
                      )}>
                        {activeAnalysis.conclusion.includes('Nên mua') ? <CheckCircle size={24} /> : <XCircle size={24} />}
                      </div>
                      <h4 className="font-bold text-lg text-text-p">{activeAnalysis.conclusion.split('.')[0]}</h4>
                      <p className="text-xs text-text-s">{activeAnalysis.conclusion.split('.').slice(1).join('.')}</p>
                    </div>
                  </section>
                </div>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-background border border-border rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-display font-bold flex items-center gap-2">
                    <Palette size={24} className="text-primary" />
                    Cài đặt giao diện
                  </h3>
                  <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-secondary rounded-full">
                    <XCircle size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Chế độ hiển thị</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => setTheme('light')}
                        className={cn(
                          "flex items-center justify-center gap-2 p-3 rounded-xl border transition-all",
                          theme === 'light' ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-secondary"
                        )}
                      >
                        <Sun size={18} />
                        Sáng
                      </button>
                      <button 
                        onClick={() => setTheme('dark')}
                        className={cn(
                          "flex items-center justify-center gap-2 p-3 rounded-xl border transition-all",
                          theme === 'dark' ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-secondary"
                        )}
                      >
                        <Moon size={18} />
                        Tối
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Màu chủ đạo</p>
                    <div className="grid grid-cols-3 gap-2">
                      {COLOR_THEMES.map((t) => (
                        <button 
                          key={t.name}
                          onClick={() => setPrimaryColor(t.primary)}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-xl border transition-all text-xs",
                            primaryColor === t.primary ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"
                          )}
                        >
                          <span className="w-4 h-4 rounded-full" style={{ backgroundColor: t.primary }} />
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:opacity-90 transition-all"
                >
                  Lưu thay đổi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
