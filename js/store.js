import { reactive, watch } from 'vue';

// --- 安全存储封装 ---
const safeStorage = {
    getItem(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    },
    setItem(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {}
    }
};

// 1. 初始化数据
const savedData = safeStorage.getItem('ai_phone_sessions');
const initialSessions = savedData ? JSON.parse(savedData) : [];

const defaultStickers = [];

// 数据迁移逻辑
let storedStickers = [];
try {
    const raw = safeStorage.getItem('ai_phone_stickers');
    storedStickers = raw ? JSON.parse(raw) : [];
} catch (e) {
    storedStickers = [];
}

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
    
    if (!s.settings.fontSize) s.settings.fontSize = 13;
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
    safeStorage.setItem('ai_phone_sessions', JSON.stringify(newVal));
}, { deep: true });

watch(() => store.stickers, (newVal) => {
    safeStorage.setItem('ai_phone_stickers', JSON.stringify(newVal));
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
    let fakePhotoContent = null; 
    
    let msgType = 'text';

    if (content.includes('[RECALL]')) {
        isRecall = true;
        originalContent = content.replace('[RECALL]', '').trim() || '(内容已撤回)';
        content = "对方撤回了一条消息"; 
    }

    const transMatch = content.match(/(\n\s*)?\[TRANSLATION\][:：]?\s*([\s\S]*)$/i);
    if (transMatch) {
        translation = transMatch[2].trim();
        content = content.replace(transMatch[0], '').trim();
    }

    const photoMatch = content.match(/\[PHOTO\s*:\s*(.*?)\]/i);
    if (photoMatch) {
        fakePhotoContent = photoMatch[1].trim();
        stickerUrl = 'https://i.postimg.cc/MHKmwm1N/tu-pian-yi-bei-xiao-mao-chi-diao.jpg';
        content = content.replace(photoMatch[0], '').trim();
        msgType = 'image'; 
    }

    const stickerMatch = content.match(/\[STICKER\s*:\s*(.*?)\]/);
    if (stickerMatch) {
        const potentialUrl = stickerMatch[1].trim();
        const isActive = (session.settings.activeStickerIds || []).includes(potentialUrl);
        
        if (isActive) {
            stickerUrl = potentialUrl;
            content = content.replace(stickerMatch[0], '').trim();
            if (!content) msgType = 'image'; 
        } else {
            content = content.replace(stickerMatch[0], '').trim();
        }
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

    if (!content && translation) {
        content = translation;
        translation = null; 
    }

    if (!content && quote) quote = null; 

    return { content, os, quote, isRecall, originalContent, stickerUrl, msgType, translation, fakePhotoContent };
};

// --- 更新消息 ---
const updateMessage = (session, index, parsed) => {
    // 确保消息对象存在，如果不存在则创建
    if (!session.messages[index]) {
        session.messages[index] = { role: 'assistant', content: '' };
    }
    const msg = session.messages[index];
    
    if (parsed.isRecall) {
        msg.role = 'system';
        msg.content = '对方撤回了一条消息';
        msg.isRecall = true;
        msg.originalContent = parsed.originalContent;
        delete msg.quote; delete msg.os; delete msg.image; delete msg.translation; delete msg.fakePhotoContent;
    } else {
        msg.type = parsed.msgType; 
        msg.content = parsed.content;
        
        if (parsed.stickerUrl) msg.image = parsed.stickerUrl;
        else if (msg.type !== 'image') delete msg.image;

        if (parsed.fakePhotoContent) msg.fakePhotoContent = parsed.fakePhotoContent;
        
        if (parsed.translation) msg.translation = parsed.translation;
        if (msg.showTranslation === undefined) msg.showTranslation = false;
        
        if (parsed.os) msg.os = parsed.os;
        
        if (parsed.quote) msg.quote = parsed.quote;
        else delete msg.quote;
    }
};

const buildSystemPrompt = (session) => {
    let prompt = "【重要指令】你正在进行角色扮演。请严格遵守人设。严禁跳出角色。\n\n";
    
    prompt += "【强制要求】\n";
    prompt += "1. **每一条回复**都必须包含【心声】，用来描写你的心理活动或潜台词。\n";
    prompt += "2. 心声必须放在回复的最开头，用【】包裹。\n";
    prompt += "3. 格式示例：【他居然这么说...】是的，没错。\n\n";

    if (!session.settings.enableLongText) {
        prompt += "【排版约束 - 气泡分割】\n";
        prompt += "1. 严禁发送一大段长文字。\n";
        prompt += "2. **必须**使用双换行符 `\\n\\n` 来分割不同的句子或观点。\n";
        prompt += "3. 每一个 `\\n\\n` 将会被前端识别为气泡的分割点，请利用这一点来模拟多条消息连发的效果。\n";
    }

    let allWorldbooks = [];
    try {
        const wbRaw = safeStorage.getItem('ai_phone_worldbooks_v2');
        allWorldbooks = wbRaw ? JSON.parse(wbRaw) : [];
    } catch(e) { allWorldbooks = []; }

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
            prompt += "【可用表情包】\n";
            prompt += "严禁编造链接。只能使用以下列表中的链接发送图片。\n";
            prompt += "发送格式: `[STICKER: 链接]`\n";
            activeStickers.forEach(s => {
                prompt += `- ${s.name}: ${s.url}\n`;
            });
            prompt += "\n";
        }
    }

    prompt += "【发送照片】\n";
    prompt += "如果你想发送一张自拍、风景照或物品照片，请使用格式：`[PHOTO: 照片内容的详细描述]`。\n";
    prompt += "例如：`[PHOTO: 一只正在晒太阳的橘猫]`。\n";
    prompt += "系统会自动将其转换为一张照片卡片。\n\n";

    prompt += "\n【交互模式指令】\n";
    if (session.settings.enableLongText) {
        prompt += "1. 当前为【长文/小说模式】，输出完整长段落。\n";
        if (session.settings.novelStyle) prompt += `2. 风格: ${session.settings.novelStyle}\n`;
    } else {
        prompt += "1. 当前为【即时聊天模式】，请模拟即时通讯软件。\n";
        prompt += "2. **Output pure text only.** Do NOT wrap your entire response in quotation marks.\n";
    }
    
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
export const createSession = (newSession) => { 
    if (!newSession.settings) newSession.settings = {};
    if (!newSession.settings.fontSize) newSession.settings.fontSize = 13;
    store.sessions.unshift(newSession); 
};
export const deleteSession = (id) => { const idx = store.sessions.findIndex(s => s.id === id); if (idx !== -1) store.sessions.splice(idx, 1); };
export const updateSession = (updatedSession) => { const idx = store.sessions.findIndex(s => s.id === updatedSession.id); if (idx !== -1) store.sessions[idx] = { ...updatedSession }; };

export const sendUserMessage = ({ sessionId, text, quote, image, type = 'text', fakePhotoContent = null }) => {
    const session = store.sessions.find(s => s.id === sessionId);
    if (!session) return;
    
    const newMsg = { 
        role: 'user', 
        type: type,
        content: text || '', 
        quote, 
        image: image || null,
        fakePhotoContent: fakePhotoContent, 
        showTranslation: false
    };

    session.messages.push(newMsg);
    session.lastMessage = newMsg.content || '[图片]';
    session.lastTime = Date.now();
};

export const generateAiMessage = async ({ sessionId, text, quote, image, type = 'text', fakePhotoContent = null }) => {
    const session = store.sessions.find(s => s.id === sessionId);
    if (!session) return;

    if (text || image) {
        sendUserMessage({ sessionId, text, quote, image, type, fakePhotoContent });
    }

    let profiles = [];
    try {
        const raw = safeStorage.getItem('ai_phone_profiles');
        profiles = raw ? JSON.parse(raw) : [];
    } catch(e) { profiles = []; }

    const activeId = safeStorage.getItem('ai_phone_active_id');
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
    
    // [重大修改] 不再预先创建气泡 (push)，而是记录当前应该插入的索引
    // 这样如果生成失败或者内容为空，就不会有任何气泡产生
    let currentMsgIndex = session.messages.length; 
    // 不需要 push 空消息了

    try {
        const history = session.messages.slice(-20, -1).map(m => {
            let content = m.content;
            if (m.fakePhotoContent) {
                content = `(发送了一张照片，内容是：${m.fakePhotoContent})`;
            }
            if (m.role === 'user' && m.quote) content = `(引用: "${m.quote.content}")\n${content}`;
            
            if (!m.fakePhotoContent && m.image && (m.image.startsWith('http') || m.image.startsWith('data:image'))) {
                return {
                    role: m.role,
                    content: [{ type: "text", text: content || "（发送了一张图片）" }, { type: "image_url", image_url: { url: m.image } }]
                };
            } else {
                return { role: m.role, content: content || '(空)' };
            }
        });

        const messagesPayload = [{ role: 'system', content: buildSystemPrompt(session) }, ...history];
        let baseUrl = config.baseUrl.replace(/\/$/, '');

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
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = ''; 

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.slice(6);
                        if (jsonStr.trim() === '[DONE]') break;
                        try {
                            const json = JSON.parse(jsonStr);
                            const content = json.choices[0].delta.content || '';
                            buffer += content;

                            let splitIndex = buffer.indexOf('\n\n');
                            while (splitIndex !== -1) {
                                const bubbleText = buffer.slice(0, splitIndex).trim();
                                buffer = buffer.slice(splitIndex + 2); 

                                if (bubbleText) {
                                    // 只有当有内容要写入时，才检查气泡是否存在
                                    // 如果当前索引还没气泡，就创建一个
                                    if (!session.messages[currentMsgIndex]) {
                                        session.messages.push({ role: 'assistant', content: '', os: '' });
                                    }
                                    
                                    const parsed = parseMessageContent(bubbleText, session);
                                    updateMessage(session, currentMsgIndex, parsed);
                                    
                                    // 准备下一个气泡位置
                                    currentMsgIndex++;
                                }
                                splitIndex = buffer.indexOf('\n\n');
                            }

                            // 实时预览剩余 buffer
                            if (buffer.trim()) {
                                if (!session.messages[currentMsgIndex]) {
                                    session.messages.push({ role: 'assistant', content: '', os: '' });
                                }
                                const parsed = parseMessageContent(buffer, session);
                                updateMessage(session, currentMsgIndex, parsed);
                            }

                        } catch (e) {}
                    }
                }
            }
            
            // 循环结束
            if (buffer.trim()) {
                if (!session.messages[currentMsgIndex]) {
                    session.messages.push({ role: 'assistant', content: '', os: '' });
                }
                const parsed = parseMessageContent(buffer, session);
                updateMessage(session, currentMsgIndex, parsed);
            }

        } else {
            // 非流式
            const data = await response.json();
            const fullText = data.choices[0].message.content || '';
            const parts = fullText.split('\n\n');
            
            parts.forEach((part, idx) => {
                if (!part.trim()) return; // 忽略空段落
                
                // 确保气泡存在
                if (!session.messages[currentMsgIndex]) {
                    session.messages.push({ role: 'assistant', content: '' });
                }
                
                const parsed = parseMessageContent(part, session);
                updateMessage(session, currentMsgIndex, parsed);
                currentMsgIndex++;
            });
        }

        const lastMsg = session.messages[session.messages.length - 1];
        if (lastMsg) {
            session.lastMessage = lastMsg.role === 'system' ? '[撤回消息]' : (lastMsg.content || '(无内容)');
        }
        
        if (store.currentViewingSessionId !== sessionId && lastMsg) {
            store.notification.title = session.name;
            store.notification.content = session.lastMessage;
            store.notification.avatar = session.avatar || generateAvatar(session.name, 'assistant');
            store.notification.sessionId = sessionId;
            store.notification.show = true;
            setTimeout(() => { store.notification.show = false; }, 4000);
        }

    } catch (e) {
        const errorText = `[连接失败] ${e.message}`;
        // 出错时才创建错误气泡
        if (!session.messages[currentMsgIndex]) {
             session.messages.push({ role: 'assistant', content: errorText });
        } else {
             session.messages[currentMsgIndex].content = errorText;
        }
        session.lastMessage = errorText;
    } finally {
        // [最后一道防线] 清理可能残留的空消息
        session.messages = session.messages.filter(m => {
            if (m.role === 'assistant') {
                const hasContent = m.content && m.content.trim();
                const hasImage = !!m.image;
                const hasOs = m.os && m.os.trim();
                if (!hasContent && !hasImage && !hasOs) return false;
            }
            return true;
        });
        
        session.isGenerating = false;
    }
};
