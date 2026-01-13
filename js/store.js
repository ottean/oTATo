import { reactive, watch } from 'vue';

// 1. 初始化数据
const savedData = localStorage.getItem('ai_phone_sessions');
const initialSessions = savedData ? JSON.parse(savedData) : [];

// [修复] 使用网络短链接，彻底解决 Base64 导致的语法报错问题
const defaultStickers = [
    { 
        type: 'folder', 
        id: 'default_cat', 
        name: '猫猫', 
        children: [
            { type: 'image', url: 'https://media.giphy.com/media/MDJ9IbxxvDUQM/giphy.gif', name: 'Cat 1' },
            { type: 'image', url: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif', name: 'Cat 2' },
            { type: 'image', url: 'https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif', name: 'Cat 3' }
        ]
    },
    { type: 'image', url: 'https://media.giphy.com/media/C9x8gX02SnMIoAClTn/giphy.gif', name: 'Cat 4' },
    { type: 'image', url: 'https://media.giphy.com/media/3o7TKr3nzbh5WgCFxe/giphy.gif', name: 'Cat 5' },
    { type: 'image', url: 'https://media.giphy.com/media/OPU6wzx8JXHxi/giphy.gif', name: 'Cat 6' }
];

// 数据迁移逻辑
let storedStickers = JSON.parse(localStorage.getItem('ai_phone_stickers'));
if (Array.isArray(storedStickers)) {
    if (storedStickers.length > 0 && !storedStickers[0].type) {
        storedStickers = storedStickers.map(s => ({ type: 'image', ...s }));
    }
} else {
    storedStickers = defaultStickers;
}

// 异常状态重置
initialSessions.forEach(s => {
    if (!s.isGenerating) s.isGenerating = false; 
    if (!s.settings) s.settings = {};
    if (s.settings.enableLongText === undefined) s.settings.enableLongText = false;
    if (!s.settings.activeStickerIds) s.settings.activeStickerIds = []; 
    if (s.settings.enableTranslation === undefined) s.settings.enableTranslation = false;
});

// 2. 定义 Store
export const store = reactive({
    sessions: initialSessions,
    stickers: storedStickers,
    notification: { show: false, title: '', content: '', avatar: '', sessionId: null },
    targetSessionId: null,
    currentViewingSessionId: null 
});

// 3. 自动保存
watch(() => store.sessions, (newVal) => {
    localStorage.setItem('ai_phone_sessions', JSON.stringify(newVal));
}, { deep: true });

watch(() => store.stickers, (newVal) => {
    localStorage.setItem('ai_phone_stickers', JSON.stringify(newVal));
}, { deep: true });

// --- 头像生成器 ---
export const generateAvatar = (name, role) => {
    const safeName = (name || (role === 'user' ? 'Me' : 'AI')).trim();
    let text = '';
    if (/[\u4e00-\u9fa5]/.test(safeName)) {
        text = safeName.slice(-1);
    } else if (/^\d+$/.test(safeName)) {
        text = safeName.substring(0, 2); 
    } else if (safeName.length <= 2) {
        text = safeName.toUpperCase();
    } else {
        const parts = safeName.split(' ');
        if (parts.length > 1) {
            text = (parts[0][0] + parts[1][0]).toUpperCase(); 
        } else {
            text = safeName.slice(0, 2).toUpperCase(); 
        }
    }
    const bg = role === 'user' ? '#ffffff' : '#1a1a1a';
    const fg = role === 'user' ? '#1a1a1a' : '#ffffff';
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="50" fill="${bg}"/>
        <text x="50" y="50" dy=".35em" fill="${fg}" font-size="40" font-family="sans-serif" font-weight="bold" text-anchor="middle">
            ${text}
        </text>
    </svg>`;
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
};

// --- 辅助：获取激活的表情包 ---
const getActiveStickers = (allStickers, activeIds) => {
    let result = [];
    allStickers.forEach(item => {
        if (item.type === 'folder') {
            result = result.concat(getActiveStickers(item.children, activeIds));
        } else {
            if (activeIds.includes(item.url)) {
                result.push(item);
            }
        }
    });
    return result;
};

// --- 消息解析 ---
const parseMessageContent = (rawText, session) => {
    let content = rawText || '';
    let os = '';
    let quote = null;
    let isRecall = false;
    let originalContent = ''; 
    let stickerUrl = null; 
    let translation = null;
    
    let msgType = 'text';

    if (content.includes('[RECALL]')) {
        isRecall = true;
        originalContent = content.replace('[RECALL]', '').trim() || '(内容已撤回)';
        content = "对方撤回了一条消息"; 
    }

    // [修复] 解析翻译：支持中文冒号，忽略大小写
    const transMatch = content.match(/(\n\s*)?\[TRANSLATION\][:：]?\s*([\s\S]*)$/i);
    if (transMatch) {
        translation = transMatch[2].trim();
        // [关键修复] 移除翻译部分后，必须 trim() 去除正文末尾残留的换行符
        // 否则气泡底部会出现巨大的空白
        content = content.replace(transMatch[0], '').trim();
    }

    const stickerMatch = content.match(/\[STICKER\s*:\s*(.*?)\]/);
    if (stickerMatch) {
        stickerUrl = stickerMatch[1].trim();
        content = content.replace(stickerMatch[0], '').trim();
    }

    const statusMatch = content.match(/\[STATUS:(.*?)\]/);
    if (statusMatch) {
        session.status = statusMatch[1]; 
        if (!isRecall) content = content.replace(statusMatch[0], '');
    }

    const quoteMatch = content.match(/\[QUOTE:(.*?)\]/);
    if (quoteMatch) {
        quote = {
            name: session.settings.userName || '我',
            content: quoteMatch[1]
        };
        if (!isRecall) content = content.replace(quoteMatch[0], '');
    }

    const osMatch = content.match(/【(.*?)】/s);
    if (osMatch) {
        os = osMatch[1];
        if (!isRecall) content = content.replace(/【.*?】/s, '');
    } else if (content.includes('【')) {
        const parts = content.split('【');
        if (!isRecall) content = parts[0];
        os = parts[1] || '...';
    }

    if (!isRecall && msgType === 'text') content = content.trim();

    // [兜底] 如果正文为空但有翻译，说明 AI 格式错乱，直接把翻译当正文
    if (!content && translation) {
        content = translation;
        translation = null; 
    }

    if (!content && quote) quote = null; 

    return { content, os, quote, isRecall, originalContent, stickerUrl, msgType, translation };
};

// --- 更新消息 ---
const updateMessage = (session, index, parsed) => {
    if (!session.messages[index]) {
        session.messages[index] = { role: 'assistant', content: '' };
    }
    const msg = session.messages[index];
    if (parsed.isRecall) {
        msg.role = 'system';
        msg.content = '对方撤回了一条消息';
        msg.isRecall = true;
        msg.originalContent = parsed.originalContent;
        delete msg.quote; delete msg.os; delete msg.image; delete msg.translation;
    } else {
        msg.type = parsed.msgType; 
        msg.content = parsed.content;
        if (parsed.stickerUrl) msg.image = parsed.stickerUrl;
        
        if (parsed.translation) msg.translation = parsed.translation;
        if (msg.showTranslation === undefined) msg.showTranslation = false;
        
        msg.os = parsed.os;
        if (parsed.quote) msg.quote = parsed.quote;
        else delete msg.quote;
    }
};

const buildSystemPrompt = (session) => {
    let prompt = "【重要指令】你正在进行角色扮演。请严格遵守人设。严禁跳出角色。\n\n";
    
    const allWorldbooks = JSON.parse(localStorage.getItem('ai_phone_worldbooks_v2') || '[]');
    const activeWbIds = session.settings.activeWorldbooks || [];
    const activeBooks = allWorldbooks.filter(wb => wb.type === 'book' && activeWbIds.includes(wb.id));
    
    if (activeBooks.length > 0) {
        prompt += "【世界观与法则】\n";
        activeBooks.forEach(wb => { prompt += `- ${wb.title}: ${wb.content}\n`; });
        prompt += "\n";
    }
    
    if (session.settings.systemPrompt) prompt += `【Char设定】\n${session.settings.systemPrompt}\n\n`;
    if (session.settings.userPersona) prompt += `【User设定】\n${session.settings.userPersona}\n\n`;
    if (session.settings.longTermMemory) prompt += `【长期记忆】\n${session.settings.longTermMemory}\n\n`;
    if (session.settings.shortTermMemory) prompt += `【短期记忆】\n${session.settings.shortTermMemory}\n\n`;
    
    const activeStickerIds = session.settings.activeStickerIds || [];
    if (activeStickerIds.length > 0) {
        const activeStickers = getActiveStickers(store.stickers, activeStickerIds);
        if (activeStickers.length > 0) {
            prompt += "【可用表情包】\n发送格式: `[STICKER: 链接]`\n";
            activeStickers.forEach(s => {
                prompt += `- ${s.name}: ${s.url}\n`;
            });
            prompt += "\n";
        }
    }

    prompt += "\n【交互模式指令】\n";
    if (session.settings.enableLongText) {
        prompt += "1. 当前为【长文/小说模式】，输出完整长段落。\n";
        if (session.settings.novelStyle) prompt += `2. 风格: ${session.settings.novelStyle}\n`;
    } else {
        prompt += "1. 当前为【即时聊天模式】，请模拟即时通讯软件。\n";
        // [新增] 明确禁止双引号
        prompt += "2. **Output pure text only.** Do NOT wrap your entire response in quotation marks.\n";
    }
    
    // [更新] 双语 Prompt
    if (session.settings.enableTranslation) {
        prompt += "\n<DialogueRule>\n";
        prompt += "- All **spoken dialogues by {{char}}** must be written in Cantonese colloquial Chinese, with occasional Standard Chinese and English mixed in.\n";
        prompt += "- Each spoken line must be immediately followed by a Standard Chinese translation tag.\n";
        prompt += "- Do NOT use quotation marks around the main response.\n";
        prompt += "- Format example:\n";
        prompt += '  你喺度做乜呀？\n\n[TRANSLATION]: (你在干嘛呀？)\n';
        prompt += "- Inner monologues, narration, and environmental descriptions are **not bound** by this rule.\n";
        prompt += "</DialogueRule>\n";
    }

    prompt += "\n【通用功能】\n";
    prompt += "1. 引用: `[QUOTE:原文]`\n2. 状态: `[STATUS:状态名]`\n3. 撤回: `[RECALL]`\n4. 心声: 用【】包裹放在开头。\n";
    prompt += "5. 表情包: `[STICKER: 链接]`\n";
    prompt += "6. 如果用户发送了图片，请根据图片内容自然回复。\n";

    return prompt;
};

// --- Actions ---
export const createSession = (newSession) => { store.sessions.unshift(newSession); };
export const deleteSession = (id) => { const idx = store.sessions.findIndex(s => s.id === id); if (idx !== -1) store.sessions.splice(idx, 1); };
export const updateSession = (updatedSession) => { const idx = store.sessions.findIndex(s => s.id === updatedSession.id); if (idx !== -1) store.sessions[idx] = { ...updatedSession }; };

export const sendUserMessage = ({ sessionId, text, quote, image, type = 'text' }) => {
    const session = store.sessions.find(s => s.id === sessionId);
    if (!session) return;
    
    const newMsg = { 
        role: 'user', 
        type: type,
        content: text || '', 
        quote, 
        image: image || null,
        showTranslation: false
    };

    session.messages.push(newMsg);
    session.lastMessage = newMsg.content;
    session.lastTime = Date.now();
};

export const generateAiMessage = async ({ sessionId, text, quote, image, type = 'text' }) => {
    const session = store.sessions.find(s => s.id === sessionId);
    if (!session) return;

    if (text || image) {
        sendUserMessage({ sessionId, text, quote, image, type });
    }

    const profiles = JSON.parse(localStorage.getItem('ai_phone_profiles') || '[]');
    const activeId = localStorage.getItem('ai_phone_active_id');
    const config = profiles.find(p => p.id == activeId);

    if (!config || !config.apiKey) { 
        store.notification.title = '配置错误';
        store.notification.content = '未检测到 API Key';
        store.notification.avatar = generateAvatar('!', 'assistant'); 
        store.notification.show = true;
        setTimeout(() => { store.notification.show = false; }, 3000);
        return; 
    }

    session.isGenerating = true; 
    const startIndex = session.messages.length;
    session.messages.push({ role: 'assistant', content: '', os: '' });

    try {
        const history = session.messages.slice(-20, -1).map(m => {
            let content = m.content;
            if (m.role === 'user' && m.quote) content = `(引用: "${m.quote.content}")\n${content}`;
            if (m.image) {
                return {
                    role: m.role,
                    content: [{ type: "text", text: content || "（发送了一张图片）" }, { type: "image_url", image_url: { url: m.image } }]
                };
            } else {
                return { role: m.role, content: content };
            }
        });

        const messagesPayload = [{ role: 'system', content: buildSystemPrompt(session) }, ...history];
        let baseUrl = config.baseUrl.replace(/\/$/, '');

        // [修复] 强制流式开关：如果 config.stream 未定义或为 false，则关闭流式
        const isStream = config.stream === true; 

        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
            body: JSON.stringify({
                model: config.model || 'gpt-3.5-turbo',
                messages: messagesPayload,
                temperature: config.temperature || 0.7,
                stream: isStream, 
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            const errJson = await response.json();
            throw new Error(errJson.error?.message || response.status);
        }
        
        if (isStream) {
            // --- 流式处理逻辑 ---
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let fullStreamText = '';
            let rawBuffer = ''; 

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                rawBuffer += chunk;
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.slice(6);
                        if (jsonStr.trim() === '[DONE]') break;
                        try {
                            const json = JSON.parse(jsonStr);
                            const content = json.choices[0].delta.content || '';
                            fullStreamText += content;
                            
                            const parsed = parseMessageContent(fullStreamText, session);
                            updateMessage(session, startIndex, parsed);
                        } catch (e) {}
                    }
                }
            }
            
            // [兜底修复] 如果开启了流式，但没有解析到任何 SSE 数据
            if (!fullStreamText.trim() && rawBuffer.trim().startsWith('{')) {
                try {
                    const data = JSON.parse(rawBuffer);
                    const content = data.choices[0].message.content || '';
                    fullStreamText = content;
                    const parsed = parseMessageContent(fullStreamText, session);
                    updateMessage(session, startIndex, parsed);
                } catch(e) {}
            } else {
                const parsed = parseMessageContent(fullStreamText, session);
                updateMessage(session, startIndex, parsed);
            }

        } else {
            // --- 非流式处理逻辑 ---
            const data = await response.json();
            const fullText = data.choices[0].message.content || '';
            const parsed = parseMessageContent(fullText, session);
            updateMessage(session, startIndex, parsed);
        }

        const lastMsg = session.messages[session.messages.length - 1];
        session.lastMessage = lastMsg.role === 'system' ? '[撤回消息]' : (lastMsg.content || '(无内容)');
        
        if (store.currentViewingSessionId !== sessionId) {
            store.notification.title = session.name;
            store.notification.content = session.lastMessage;
            store.notification.avatar = session.avatar || generateAvatar(session.name, 'assistant');
            store.notification.sessionId = sessionId;
            store.notification.show = true;
            setTimeout(() => { store.notification.show = false; }, 4000);
        }

    } catch (e) {
        const errorText = `[连接失败] ${e.message}`;
        session.messages[startIndex].content = errorText;
        session.lastMessage = errorText;
    } finally {
        session.isGenerating = false;
    }
};
