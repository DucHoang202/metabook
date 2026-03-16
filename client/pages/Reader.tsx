import React, { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useParams } from "react-router-dom";
import { useEffect } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.js?url";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize,
  Send,
  Bot,
  User,
  BookOpen,
  ArrowLeft,
  Sparkles,
  MessageSquare,
  FileText,
  Moon,
  Sun,
  ChevronDown,
  ChevronUp,
  Minimize2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { request } from "http";

const API_URL = "https://metabookbe.metapress.ai";

interface ChatMessage {
  id: string;
  type: "user" | "ai";
  content: string | React.ReactNode;
  pageReferences?: number[];
  timestamp: Date;
  citations?: string[];
        isError?: Boolean;

}

//Interface gửi đến API
interface QueryRequest {
  question: string | React.ReactNode;
  book_id: string | null;
  k: number;
  target_chars: number;
  dry_run: boolean;
}

// Interface cho API response
interface QueryResponse {
  question: string;
  rewritten: string;
  answer: any;
  context: string;
  citations: any[];
  policy: {
    negative_rejection: boolean;
    best_score: number;
  };
}

const ReaderPage = () => {
  const { id } = useParams();
  (window as any).bookId = id;
  return (window as any).bookId;
}


interface BookInfo {
  title: string;
  author: string;
  totalPages: number;
  description: string;
}

const SAMPLE_BOOK: BookInfo = {
  title: "Nghệ Thuật Lãnh Đạo Hiện Đại",
  author: "Nguyễn Văn A, Trần Thị B",
  totalPages: 328,
  description: "Cuốn sách về phương pháp lãnh đạo tiên tiến trong thời đại số",
};

const PRESET_QUESTIONS = [
  "Tóm tắt chương 1",
  "Gợi ý phần nên đọc",
  "Điểm chính cuốn sách",
  "Tìm phát biểu quan trọng",
  "Các ví dụ thực tế",
  "Kết luận chính",
];

let SAMPLE_MESSAGES: ChatMessage[] = [
  {
    id: "1",
    type: "ai",
    content:
      'Chào bạn! Tôi đã phân tích toàn bộ nội dung cuốn sách. Bạn có thể hỏi tôi bất kỳ điều gì về nội dung sách, tôi sẽ trả lời và cung cấp trích dẫn cụ thể từ các trang liên quan.',
    timestamp: new Date(),
    citations: [],
          isError: false

  },
];
const emptyResponse: QueryResponse = {
  question: "",
  rewritten: "",
  answer: null,
  context: "",
  citations: [],
  policy: {
    negative_rejection: false,
    best_score: 0,
  },
};
(window as any).data = emptyResponse;
export default function Reader() {
  const [currentPage, setCurrentPage] 
  = useState(1);
  ReaderPage(); // Call ReaderPage to set bookId
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [zoomLevel, setZoomLevel] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(SAMPLE_MESSAGES);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isAiAssistantExpanded, setIsAiAssistantExpanded] = useState(true);
  const [showPresetQuestions, setShowPresetQuestions] = useState(true);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string>('');
      // const iframe = document.getElementById("pdfFrame") as HTMLIFrameElement;
      // const viewerWindow = (iframe.contentWindow as any);

  const pdfViewerRef = useRef<HTMLDivElement>(null);
    const [isIframeReady, setIsIframeReady] = useState(false);
useEffect(() => {
  if(chatRef.current) {
    const scrollContainer = chatRef.current.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }
}, [messages, isLoading]);

  const [pdfUrl, setPdfUrl] = useState('');

const fetchBooks = async () => {
  setIsLoading(true);
  try {
    const res = await fetch(API_URL +'/books', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json',
      }
    });

    const responseBook = await res.json();

    if (Array.isArray(responseBook)) {
      const responseBookMatch = responseBook.filter(item =>
        item.book_id?.toLowerCase().includes((window as any).bookId?.toLowerCase() || "")
      );
      (window as any).responseBook = responseBookMatch[0];
      console.log("name",  (window as any).responseBook?.pdf_url);
    } else {
      console.warn("Unexpected API format:", responseBook);
      (window as any).responseBook = [];
    }
  } catch (error) {
    console.error('Error fetching books:', error);
  } finally {
    setIsLoading(false);
  }
};

useEffect(() => {
  fetchBooks();
}, []); // ✅ chỉ gọi 1 lần khi mount


SAMPLE_MESSAGES = [
  {
    id: "1",
    type: "ai",
    content:
      `Chào bạn! Tôi đã phân tích toàn bộ nội dung cuốn sách. Bạn có thể hỏi tôi bất kỳ điều gì về nội dung sách, tôi sẽ trả lời và cung cấp trích dẫn cụ thể từ các trang liên quan.`,
    timestamp: new Date(),
    isError: false
  
  },
];

const waitForPDFViewer = async (iframe: HTMLIFrameElement, timeout = 5000) => {
  const start = Date.now();
  return new Promise<any>((resolve, reject) => {
    const check = () => {
      const viewerWindow = (iframe.contentWindow as any);
      if (viewerWindow?.PDFViewerApplication) {
        resolve(viewerWindow.PDFViewerApplication);
      } else if (Date.now() - start > timeout) {
        reject("Timeout waiting for PDFViewerApplication");
      } else {
        setTimeout(check, 200);
      }
    };
    check();
  });
};
  // Tìm kiếm từ trong các trang PDF
async function searchPagesForTerm(term: string) {
   const iframe = document.getElementById("pdfFrame") as HTMLIFrameElement;
      const viewerWindow = (iframe.contentWindow as any);


      if (!viewerWindow.PDFViewerApplication) {
        return;
      }

      await viewerWindow.PDFViewerApplication.initializedPromise;
      
      viewerWindow.PDFViewerApplication.eventBus.dispatch("find", {
        type: "find",
        query: term,
        caseSensitive: false,
        highlightAll: true,
        findPrevious: false,
      });
    }



  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= SAMPLE_BOOK.totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleZoom = (direction: "in" | "out") => {
    setZoomLevel((prev) => {
      const newZoom = direction === "in" ? prev + 25 : prev - 25;
      return Math.max(50, Math.min(200, newZoom));
    });
  };


  //lấy sách trong nền
  async function extractText() {
     const iframe = document.getElementById("pdfFrame") as HTMLIFrameElement;
      const viewerWindow = (iframe.contentWindow as any);

  const pdf = viewerWindow.PDFViewerApplication.pdfDocument; // PDF hiện đang mở trong viewer
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {

    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    fullText += strings.join(" ") + "\n";
  }
  return fullText;
}
//lấy hai đoạn cạnh nhau
function getTwoSubsequentSentences(sentence1, sentence2, fullText) {
  //fullText = fullText.replace(/\s+/g, ' ').trim(); 
  sentence1 = sentence1.replace(/\s+/g, ""); 
  sentence2 = sentence2.replace(/\s+/g, ""); 

  const pattern =  sentence1 + sentence2;
  return fullText.includes(pattern);
}

  //tách context thành các đoạn nhỏ hơn
  const splitContext = (context: string) => {
    const cleaned = context.replace(/\(p\.None\)/g, "");
    const sentences = cleaned.split(/\n+/).map(s => s.trim()).filter(s => s.length > 0);
    return sentences;
  };
  
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

/**
 * @params
 * list: mảng các câu trích dẫn đã qua splitContext
 * @return mảng các trang đầu tiên chứa từng câu trích dẫn
 */
// async function getCitationsList(list: string[]) {
//   const iframe = document.getElementById("pdfFrame") as HTMLIFrameElement;
//   const viewerWindow = iframe.contentWindow as any;

//   if (!viewerWindow?.PDFViewerApplication) {
//     console.error("PDFViewerApplication chưa sẵn sàng");
//     return [];
//   }

//   await viewerWindow.PDFViewerApplication.initializedPromise;

//   const eventBus = viewerWindow.PDFViewerApplication.eventBus;
//   const findController = viewerWindow.PDFViewerApplication.findController;
//   const citationPages: number[] = [];

//   for (const term of list) {
//     // Tìm kiếm từng term
//     await searchAndWaitForResult(term, eventBus, viewerWindow);
    
//     // Lấy trang đầu tiên có kết quả từ pageMatches
//     let firstPage = -1;
//     for (let pageIndex = 0; pageIndex < findController.pageMatches.length; pageIndex++) {
//       const matches = findController.pageMatches[pageIndex];
//       if (matches && matches.length > 0) {
//         firstPage = pageIndex + 1; // +1 vì pageIndex bắt đầu từ 0
//         break;
//       }
//     }
    
//     citationPages.push(firstPage);
//   }

//   return citationPages;
// }

// async function searchAndWaitForResult(
//   term: string,
//   eventBus: any,
//   viewerWindow: any
// ): Promise<void> {
//   return new Promise((resolve) => {
//     const onUpdate = (e: any) => {
//       // e.state: 0 = không tìm thấy, 1 = tìm thấy, 2 = đang tìm, 3 = wrapped
//       if (e.state === 0 || e.state === 1) {
//         eventBus.off("updatefindcontrolstate", onUpdate);
//         resolve();
//       }
//     };

//     eventBus.on("updatefindcontrolstate", onUpdate);

//     // Gửi sự kiện tìm kiếm
//     viewerWindow.PDFViewerApplication.eventBus.dispatch("find", {
//       type: "find",
//       query: term,
//       caseSensitive: false,
//       highlightAll: true,
//       findPrevious: false,
//     });
//   });
// }
async function getCitationsList(list: string[]) {
  const iframe = document.getElementById("pdfFrame") as HTMLIFrameElement;
  const viewerWindow = iframe.contentWindow as any;

  if (!viewerWindow?.PDFViewerApplication) {
    console.error("PDFViewerApplication chưa sẵn sàng");
    return [];
  }
  if (!Array.isArray(list) || list.length === 0) {
    return [];
  }
  await viewerWindow.PDFViewerApplication.initializedPromise;
   console.log("0/2")
  const eventBus = viewerWindow.PDFViewerApplication.eventBus;
  const findController = viewerWindow.PDFViewerApplication.findController;
  const citationPages: number[] = [];

  for (const term of list) {
    // Tìm kiếm từng term
    await searchAndWaitForResult(term, eventBus, viewerWindow);
    console.log("1/2")
    // Đợi đủ lâu để kết quả được cập nhật hoàn toàn
    await new Promise(resolve => setTimeout(resolve, 200));
    console.log("2/2")
    // Lấy trang đầu tiên có kết quả từ pageMatches
    let firstPage = -1;
    for (let pageIndex = 0; pageIndex < findController.pageMatches.length; pageIndex++) {
      const matches = findController.pageMatches[pageIndex];
      if (matches && matches.length > 0) {
        firstPage = pageIndex + 1;
        break;
      }
    }
    
    citationPages.push(firstPage);
  }

  return citationPages;
}

async function searchAndWaitForResult(
  term: string,
  eventBus: any,
  viewerWindow: any
): Promise<void> {
  console.time(`⏱ searchAndWaitForResult("${term}")`);
  console.log("🔍 Bắt đầu tìm kiếm:", term);
  
  return new Promise((resolve, reject) => {
    const startDispatch = performance.now();
    let completed = false;
    
    // Timeout 5 giây
    const timeoutId = setTimeout(() => {
      if (!completed) {
        completed = true;
        eventBus.off("updatefindcontrolstate", onUpdate);
        console.log("⏰ Timeout sau 5s - Dừng tìm kiếm");
        console.timeEnd(`⏱ searchAndWaitForResult("${term}")`);
        resolve(); // hoặc reject(new Error("Search timeout")) nếu muốn báo lỗi
      }
    }, 5000);
    
    const onUpdate = (e: any) => {
      console.log("📡 Nhận sự kiện updatefindcontrolstate:", e.state);
      if (e.state === 0 || e.state === 1) {
        if (completed) return;
        completed = true;
        
        clearTimeout(timeoutId);
        const afterEvent = performance.now();
        console.log(
          `✅ Sự kiện hoàn tất sau ${(afterEvent - startDispatch).toFixed(2)}ms`
        );
        eventBus.off("updatefindcontrolstate", onUpdate);
        console.time("⏳ Đợi cập nhật pageMatches");
        setTimeout(() => {
          console.timeEnd("⏳ Đợi cập nhật pageMatches");
          console.timeEnd(`⏱ searchAndWaitForResult("${term}")`);
          resolve();
        }, 100);
      }
    };
    
    console.time("🕐 Gửi sự kiện find");
    eventBus.on("updatefindcontrolstate", onUpdate);
    viewerWindow.PDFViewerApplication.eventBus.dispatch("find", {
      type: "find",
      query: term,
      caseSensitive: false,
      highlightAll: true,
      findPrevious: false,
    });
    console.timeEnd("🕐 Gửi sự kiện find");
  });
}


  const handleSendMessage = async () => {
    const chat = document.getElementById("scrollMessages");
    if (!inputMessage.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "user",
      content: inputMessage,
      timestamp: new Date(),
      citations: [],
      isError: false,

    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);
      
    const requestBody: QueryRequest = {
      question: userMessage.content,
      book_id: (window as any).bookId,
      k: 30,
      target_chars: 6600,
      dry_run: false    
    };

          chat.scrollTop = chat.scrollHeight;
    try {
      
      const res = await fetch(API_URL + '/query', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      //Get data
      (window as any).responseData = await res.json();
      (window as any).data = (window as any).responseData as QueryResponse;
      console.log((window as any).data);

      // Split context into sentences
      (window as any).response = parseWrappedJson((window as any).data.answer);

      let citationsRaw: string[] = [];

      if ((window as any).response?.support?.quote) {
        citationsRaw = splitContext((window as any).response.support.quote);
      } 
      else if ((window as any).data?.citations?.length) {
        citationsRaw = (window as any).data.citations;
      }

      if (citationsRaw.length) {
        const awaitCitation = await searchCitation(citationsRaw);
        (window as any).responseCitations = awaitCitation;
      } else {
        (window as any).responseCitations = [];
      }
 
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError('Có lỗi xảy ra khi gọi API: ' + errorMessage);
      console.error('Error:', err);

      //Khung chat ai sẽ hiển thị lỗi
    // Hiển thị lỗi trong chat AI
const aiErrorResponse: ChatMessage = {
  id: (Date.now() + 1).toString(),
  type: "ai",
  content: (
    <div>
      ⚠️ Đã có lỗi xảy ra. Ấn để gửi lại{' '}
      <button 
        className="resendMessage font-normal underline text-blue-600 hover:text-blue-800 cursor-pointer"
        onClick={() => {
          const lastUserMessage = userMessage.content; // Tin nhắn người dùng cuối cùng
          if (lastUserMessage) {
            setInputMessage(lastUserMessage as string);
          }
        }}
      >
        Resend
      </button>
    </div>
  ),
  timestamp: new Date(),
  citations: [],
  isError: true
};

    setMessages((prev) => [...prev, aiErrorResponse]);
    setIsLoading(false);    
  } finally {
  
    }
        const citations = (window as any).responseCitations || [];

let waitForCitationsList: number[] = [];

if (citations.length) {
  waitForCitationsList = await getCitationsList(citations);
}

(window as any).pageCitations = waitForCitationsList;
       (window as any).pageCitations = waitForCitationsList;
      console.log("Page citations:", (window as any).pageCitations);
   //const awaitCitation = await searchCitation((window as any).responseCitationsRaw);
// Lọc responseCitations, chỉ giữ lại những phần tử có index tương ứng 
// trong pageCitations khác -1
(window as any).responseCitations = (window as any).responseCitations.filter(
  (_: any, index: number) => (window as any).pageCitations[index] !== -1
);

// Sau đó cũng lọc pageCitations để loại bỏ các giá trị -1
(window as any).pageCitations = (window as any).pageCitations.filter(
  (value: number) => value !== -1
);
    // Simulate AI response
    setTimeout(
      () => {
        const aiResponse: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: "ai",
          content: (window as any).response.answer,
          // pageReferences: Array.from({length: (window as any).responseCitations.length}, ),
          pageReferences: (window as any).pageCitations,
          timestamp: new Date(),
          citations: (window as any).responseCitations,
          isError: false
        };
        console.log("AI response:", aiResponse.pageReferences);
        setMessages((prev) => [...prev, aiResponse]);
        setIsLoading(false);
      
      },
      1500 + Math.random() * 1000,
    );
  };

// Lỗi phản hồi AI
function AiResponseError(error  ) {
  return (
    <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded">
      {error}
      <div
        className="resendMessage cursor-pointer text-sm underline mt-2"
        onClick={() => setInputMessage(String(messages.at(-1)))}
      >
        Resend
      </div>
    </div>
  );
}

  //Tìm câu trong trích dẫn
  async function searchCitation(line) {
    const fullText = await extractText();
    const cleanText = fullText.replace(/\s+/g, ""); 
let i = 0;

      while (i < line.length - 1) { // -1 để tránh lỗi khi i+1 vượt mảng
        // Check câu hiện tại và câu tiếp theo
        let check = getTwoSubsequentSentences(line[i], line[i+1], cleanText);
        if (check) {
          // Gộp 2 câu thành 1
          line.splice(i, 2, line[i] + "\n" + line[i+1]);

          // Không tăng i, để kiểm tra tiếp câu mới vừa gộp với câu kế tiếp
        } else {
          i++; // chỉ tăng khi không gộp
        }
      }
 return line;
  }

  //Parse phản hồi
function parseWrappedJson(answerStr: string) {
  if (!answerStr || typeof answerStr !== "string") return null;

  try {
    let cleaned = answerStr.trim();

    // remove ```json ``` block
    cleaned = cleaned.replace(/```json\s*/i, "").replace(/```/g, "").trim();

    // nếu không bắt đầu bằng { thì tìm JSON trong text
    if (!cleaned.startsWith("{")) {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        cleaned = match[0];
      } else {
        return { answer: cleaned }; // chỉ là text
      }
    }

    return JSON.parse(cleaned);

  } catch (err) {
    console.error("Failed to parse wrapped JSON:", err);
    return { answer: answerStr }; // fallback
  }
}

  const handlePresetQuestion = async(question: string) => {
    const chat = document.getElementById("scrollMessages");
    let inputMessage = question;
    if (!inputMessage.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "user",
      content: inputMessage,
      timestamp: new Date(),
      citations: [],
      isError: false,

    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);
      
    const requestBody: QueryRequest = {
      question: userMessage.content,
      book_id: (window as any).bookId,
      k: 30,
      target_chars: 6600,
      dry_run: false    };

          chat.scrollTop = chat.scrollHeight;
    try {
      
      const res = await fetch(API_URL + '/query', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      //Get data
      (window as any).responseData = await res.json();
      (window as any).data = (window as any).responseData as QueryResponse;
      console.log((window as any).data);

      // Split context into sentences
      (window as any).response = parseWrappedJson((window as any).data.answer);

      let citationsRaw: any[] = [];

      if ((window as any).response?.support?.quote) {
        citationsRaw = splitContext((window as any).response.support.quote);
      }
      else if ((window as any).data?.citations?.length) {
        citationsRaw = (window as any).data.citations;
      }

      if (citationsRaw.length) {
        const awaitCitation = await searchCitation(citationsRaw);
        (window as any).responseCitations = awaitCitation;

        console.log("Response citations:", (window as any).responseCitations);
      }
 
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError('Có lỗi xảy ra khi gọi API: ' + errorMessage);
      console.error('Error:', err);

      //Khung chat ai sẽ hiển thị lỗi
    // Hiển thị lỗi trong chat AI
const aiErrorResponse: ChatMessage = {
  id: (Date.now() + 1).toString(),
  type: "ai",
  content: (
    <div>
      ⚠️ Đã có lỗi xảy ra. Ấn để gửi lại{' '}
      <button 
        className="resendMessage font-normal underline text-blue-600 hover:text-blue-800 cursor-pointer"
        onClick={() => {
          const lastUserMessage = userMessage.content; // Tin nhắn người dùng cuối cùng
          if (lastUserMessage) {
            setInputMessage(lastUserMessage as string);
          }
        }}
      >
        Resend
      </button>
    </div>
  ),
  timestamp: new Date(),
  citations: [],
  isError: true
};

    setMessages((prev) => [...prev, aiErrorResponse]);
    setIsLoading(false);    
  } 
         const waitForCitationsList = await getCitationsList((window as any).responseCitations);
       (window as any).pageCitations = waitForCitationsList;
      console.log("Page citations:", (window as any).pageCitations);
   //const awaitCitation = await searchCitation((window as any).responseCitationsRaw);
// Lọc responseCitations, chỉ giữ lại những phần tử có index tương ứng 
// trong pageCitations khác -1
(window as any).responseCitations = (window as any).responseCitations.filter(
  (_: any, index: number) => (window as any).pageCitations[index] !== -1
);

// Sau đó cũng lọc pageCitations để loại bỏ các giá trị -1
(window as any).pageCitations = (window as any).pageCitations.filter(
  (value: number) => value !== -1
);
    // Simulate AI response
    setTimeout(
      () => {
        const aiResponse: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: "ai",
          content: (window as any).response.answer,
          // pageReferences: Array.from({length: (window as any).responseCitations.length}, ),
          pageReferences: (window as any).pageCitations,
          timestamp: new Date(),
          citations: (window as any).responseCitations,
          isError: false
        };
        console.log("AI response:", aiResponse.pageReferences);
        setMessages((prev) => [...prev, aiResponse]);
        setIsLoading(false);
      
      },
      1500 + Math.random() * 1000,
    );
  
  };


  return (
    
    <div
      className={`reader-body min-h-screen transition-colors ${
        isDarkMode
          ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"
          : "bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50"
      }`}
    >
      {/* Header */}
      <header
        className={`backdrop-blur-sm border-b sticky top-0 z-50 ${
          isDarkMode
            ? "bg-gray-900/90 border-gray-700"
            : "bg-white/90 border-blue-100"
        }`}
      >
        <div className="container mx-auto px-4 lg:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 lg:gap-4 min-w-0 flex-1">
            <Link
              to="/"
              className={`flex items-center gap-2 transition-colors flex-shrink-0 ${
                isDarkMode
                  ? "text-gray-300 hover:text-blue-400"
                  : "text-gray-600 hover:text-blue-600"
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Quay lại</span>
            </Link>
            <Separator orientation="vertical" className="h-6 hidden sm:block" />
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <h1
                  className={`font-semibold truncate text-sm lg:text-base ${
                    isDarkMode ? "text-gray-100" : "text-gray-900"
                  }`}
                >
                  {(window as any).responseBook?.title || "Không có dữ liệu"}
                </h1>
                <p
                  className={`text-xs lg:text-sm truncate ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  {(window as any).responseBook?.author || "Khuyết danh"}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={
                isDarkMode
                  ? "text-gray-300 hover:text-white"
                  : "text-gray-600 hover:text-gray-900"
              }
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>
            <div
              className={`flex items-center gap-2 text-xs lg:text-sm flex-shrink-0 ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>
                {currentPage}/{SAMPLE_BOOK.totalPages}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-80px)]">
        {/* PDF Viewer Panel */}
        
 <iframe
  className="pdfFrame"
  id="pdfFrame"
  ref={iframeRef}
  title="PDF Viewer"
  src={`/pdfjs-build/web/viewer.html?file=${(window as any).responseBook?.pdf_url}`}
  width="100%"
  height="800px"
/>
 {/* AI Chat Panel */}
        <div
          className={`flex flex-col backdrop-blur-sm transition-all duration-300 ${
            isAiAssistantExpanded ? "w-96" : "w-8"
          } ${isDarkMode ? "bg-gray-800/70" : "bg-white/70"}`}
        >
          {/* Chat Header */}
          <div
            className={`backdrop-blur-sm border-b transition-all duration-300 ${
              isAiAssistantExpanded ? "p-4" : "p-2"
            } ${
              isDarkMode
                ? "bg-gray-800/80 border-gray-700"
                : "bg-white/80 border-blue-100"
            }`}
          >
            <div className="flex items-center justify-between">
              {isAiAssistantExpanded ? (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3
                        className={`font-semibold ${isDarkMode ? "text-gray-100" : "text-gray-900"}`}
                      >
                        AI Reading Assistant
                      </h3>
                      <p
                        className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}
                      >
                        Hỏi đáp về nội dung sách
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAiAssistantExpanded(false)}
                    className={
                      isDarkMode
                        ? "text-gray-300 hover:text-white"
                        : "text-gray-600 hover:text-gray-900"
                    }
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAiAssistantExpanded(true)}
                  className={`w-full h-full flex items-center justify-center ${isDarkMode ? "text-gray-300 hover:text-white" : "text-gray-600 hover:text-gray-900"}`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4 " id="scrollMessages" ref={chatRef}>
            {/* Preset Questions */}
            {
              <div
                className={`mb-4 p-3 rounded-lg border ${isDarkMode ? "bg-gray-800 border-gray-700" : "bg-blue-50 border-blue-200"}`}
              >
                <p
                  className={`text-sm font-medium mb-3 ${isDarkMode ? "text-gray-200" : "text-gray-800"}`}
                >
                  💡 Câu hỏi gợi ý - Click để hỏi ngay:
                </p>
                <div className="flex flex-wrap gap-2">
                  {PRESET_QUESTIONS.map((question, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className={`text-xs h-8 px-3 transition-all hover:scale-105 ${
                        isDarkMode
                          ? "border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-purple-500"
                          : "border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-purple-400"
                      }`}
                      onClick={() => handlePresetQuestion(question)}
                    >
                      {question}
                    </Button>
                    
                  ))}

                </div>
              </div>
            }
{/* Message body */}
            <div className="space-y-4 ">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.type === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.type === "ai" && (
   <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
    message.isError 
      ? 'bg-gradient-to-r from-red-600 to-orange-600' 
      : 'bg-gradient-to-r from-purple-600 to-pink-600'
  }`}>
    {message.isError ? (
      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6z" />
      </svg>
    )}
  </div>
                  )}

                  <div
                    className={`max-w-[75%] ${message.type === "user" ? "order-1" : "order-2"}`}
                  >
                    <div
                      className={`rounded-lg p-3 text-sm ${
                        message.type === "user"
                          ? "bg-blue-600 text-white"
                          : "bg-white border border-gray-200"
                      }`}
                    >
                      <div className="whitespace-pre-wrap">
                        {message.content}
                      </div>
        
                      {/* Tham khảo */}
                      {message.pageReferences && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <p className="text-xs text-gray-600 mb-1">
                            Tham khảo:
                          </p>
        
                          <div className="flex flex-wrap gap-1">
                            {message.citations?.map(
                              (sentence: string, index: number) => (
                                <Button
                                  key={index}
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-5 px-1"
                                  onClick={() => searchPagesForTerm(sentence)}

                                >
                                {message.pageReferences[index] ? `Trang ${message.pageReferences[index]}` : 'N/A'}
                              </Button>
                              )
                            )}
                          </div>
                        
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 px-2">
                      {message.timestamp.toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>

                  {message.type === "user" && (
                    <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-6 h-6 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3 h-3 text-white" />
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 animate-pulse text-purple-600" />
                      <span className="text-sm text-gray-600">
                        Đang phân tích...
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Message Input */}
          <div className="p-4 bg-white/80 backdrop-blur-sm border-t border-blue-100">
            <div className="flex gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Hỏi về nội dung sách..."
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                className="flex-1"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
