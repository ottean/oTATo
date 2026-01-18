import { reactive, watch } from 'vue';

const safeStorage = {
    getItem(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
    setItem(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }
};

const savedData = safeStorage.getItem('ai_phone_sessions');
const initialSessions = savedData ? JSON.parse(savedData) : [];
const defaultStickers = [];

let storedStickers = [];
try { storedStickers = JSON.parse(safeStorage.getItem('ai_phone_stickers') || '[]'); } catch (e) { storedStickers = []; }
if (Array.isArray(storedStickers)) {
    if (storedStickers.length > 0 && !storedStickers[0].type) storedStickers = storedStickers.map(s => ({ type: 'image', ...s }));
} else storedStickers = defaultStickers;

initialSessions.forEach(s => {
    s.isGenerating = false; 
    if (!s.settings) s.settings = {};
    if (!s.settings.fontSize) s.settings.fontSize = 13;
    if (s.settings.enableLongText === undefined) s.settings.enableLongText = false;
    if (!s.settings.activeStickerIds) s.settings.activeStickerIds = []; 
    if (s.settings.enableTranslation === undefined) s.settings.enableTranslation = false;
});

export const store = reactive({
    sessions: initialSessions,
    stickers: storedStickers,
    notification: { show: false, title: '', content: '', avatar: '', sessionId: null },
    targetSessionId: null,
    currentViewingSessionId: null 
});

watch(() => store.sessions, (n) => safeStorage.setItem('ai_phone_sessions', JSON.stringify(n)), { deep: true });
watch(() => store.stickers, (n) => safeStorage.setItem('ai_phone_stickers', JSON.stringify(n)), { deep: true });

export const generateAvatar = (name, role) => {
    const n = (name || (role === 'user' ? 'Me' : 'AI')).trim();
    let t = n.length <= 2 ? n : n.slice(0, 2);
    if (/[\u4e00-\u9fa5]/.test(n)) t = n.slice(-1);
    const bg = role === 'user' ? '#ffffff' : '#1a1a1a';
    const fg = role === 'user' ? '#1a1a1a' : '#ffffff';
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="${bg}"/><text x="50" y="50" dy=".35em" fill="${fg}" font-size="40" font-family="sans-serif" font-weight="bold" text-anchor="middle">${t.toUpperCase()}</text></svg>`)));
};

const getActiveStickers = (list, ids) => {
    let res = [];
    list.forEach(i => {
        if (i.type === 'folder') res = res.concat(getActiveStickers(i.children, ids));
        else if (ids.includes(i.url)) res.push(i);
    });
    return res;
};

const parseMessageContent = (rawText, session) => {
    let content = rawText || '';
    let os = '', quote = null, isRecall = false, originalContent = '', stickerUrl = null, translation = null, fakePhotoContent = null, msgType = 'text', transfer = null;

    if (content.includes('[RECALL]')) {
        isRecall = true; originalContent = content.replace('[RECALL]', '').trim(); content = "对方撤回了一条消息";
    }

    const transMatch = content.match(/(\n\s*)?\[TRANSLATION\][:：]?\s*([\s\S]*)$/i);
    if (transMatch) { translation = transMatch[2].trim(); content = content.replace(transMatch[0], '').trim(); }

    const photoMatch = content.match(/\[PHOTO\s*:\s*(.*?)\]/i);
    if (photoMatch) {
        fakePhotoContent = photoMatch[1].trim();
        stickerUrl = 'https://i.postimg.cc/MHKmwm1N/tu-pian-yi-bei-xiao-mao-chi-diao.jpg';
        content = content.replace(photoMatch[0], '').trim();
        msgType = 'image';
    }

    const stickerMatch = content.match(/\[STICKER\s*:\s*(.*?)\]/);
    if (stickerMatch) {
        const url = stickerMatch[1].trim();
        if ((session.settings.activeStickerIds || []).includes(url)) {
            stickerUrl = url; content = content.replace(stickerMatch[0], '').trim();
            if (!content) msgType = 'image';
        } else {
            content = content.replace(stickerMatch[0], '').trim();
        }
    }

    const transferMatch = content.match(/\[TRANSFER\s*:\s*(\d+(\.\d+)?)\s*(?:,\s*(.*))?\]/i);
    if (transferMatch) {
        msgType = 'transfer';
        transfer = {
            amount: parseFloat(transferMatch[1]).toFixed(2),
            remark: transferMatch[3] ? transferMatch[3].trim() : '',
            status: 'pending',
            timestamp: Date.now() // [新增]
        };
        content = '[转账]';
    }

    const quoteMatch = content.match(/\[QUOTE:(.*?)\]/);
    if (quoteMatch) { quote = { name: session.settings.userName || '我', content: quoteMatch[1] }; if (!isRecall) content = content.replace(quoteMatch[0], ''); }

    const osMatch = content.match(/【(.*?)】/s);
    if (osMatch) { os = osMatch[1]; if (!isRecall) content = content.replace(/【.*?】/s, ''); }
    else if (content.includes('【')) { const p = content.split('【'); if (!isRecall) content = p[0]; os = p[1] || '...'; }

    if (os) os = os.replace(/^(心声|OS|Inner)[:：]?\s*/i, '').trim();

    if (!isRecall && msgType === 'text') content = content.trim();
    if (!content && translation) { content = translation; translation = null; }

    return { content, os, quote, isRecall, originalContent, stickerUrl, msgType, translation, fakePhotoContent, transfer };
};

const updateMessage = (session, index, parsed) => {
    if (!session.messages[index]) session.messages[index] = { role: 'assistant', content: '' };
    const msg = session.messages[index];
    
    if (parsed.isRecall) {
        Object.assign(msg, { role: 'system', content: '对方撤回消息', isRecall: true, originalContent: parsed.originalContent });
        delete msg.quote; delete msg.os; delete msg.image; delete msg.translation; delete msg.fakePhotoContent; delete msg.transfer;
    } else {
        msg.type = parsed.msgType;
        msg.content = parsed.content;
        if (parsed.stickerUrl) msg.image = parsed.stickerUrl; else if (msg.type !== 'image') delete msg.image;
        if (parsed.fakePhotoContent) msg.fakePhotoContent = parsed.fakePhotoContent;
        if (parsed.translation) msg.translation = parsed.translation;
        if (parsed.os) msg.os = parsed.os;
        if (parsed.quote) msg.quote = parsed.quote; else delete msg.quote;
        if (parsed.transfer) msg.transfer = parsed.transfer;
    }
};

const buildSystemPrompt = (session) => {
    let p = "【重要指令】你正在进行角色扮演。请严格遵守人设。\n【强制要求】\n1. **每一条回复**都必须包含【心声】。\n2. 心声必须放在回复的最开头，用【】包裹。\n";
    if (!session.settings.enableLongText) {
        p += "【排版约束】\n1. 严禁发送长段落。\n2. **必须**使用双换行符 `\\n\\n` 分割不同句子。\n3. 每个 `\\n\\n` 会被识别为气泡分割点。\n";
    }
    try {
        const wbs = JSON.parse(safeStorage.getItem('ai_phone_worldbooks_v2') || '[]');
        const active = wbs.filter(b => b.type === 'book' && (session.settings.activeWorldbooks || []).includes(b.id));
        if (active.length) { p += "【世界观】\n"; active.forEach(b => p += `- ${b.title}: ${b.content}\n`); }
    } catch(e) {}
    if (session.settings.systemPrompt) p += `【Char设定】\n${session.settings.systemPrompt}\n`;
    if (session.settings.userPersona) p += `【User设定】\n${session.settings.userPersona}\n`;
    const stickers = getActiveStickers(store.stickers, session.settings.activeStickerIds || []);
    if (stickers.length) {
        p += "【表情包】发送格式: `[STICKER: 链接]`\n";
        stickers.forEach(s => p += `- ${s.name}: ${s.url}\n`);
    }
    p += "【照片】格式: `[PHOTO: 描述]`\n";
    p += "【转账功能】\n- 给用户转账：`[TRANSFER: 金额, 备注]`\n- 收取用户转账：回复内容中包含 `[CMD:RECEIVE]`\n- 退还用户转账：回复内容中包含 `[CMD:RETURN]`\n(注意：CMD指令不会显示给用户，系统会自动执行)\n\n";
    return p;
};

export const createSession = (s) => { 
    if(!s.settings) s.settings={}; if(!s.settings.fontSize) s.settings.fontSize=13; 
    store.sessions.unshift(s); 
};
export const deleteSession = (id) => { const i = store.sessions.findIndex(s=>s.id===id); if(i>-1) store.sessions.splice(i,1); };
export const updateSession = (s) => { const i = store.sessions.findIndex(x=>x.id===s.id); if(i>-1) store.sessions[i] = {...s}; };

export const sendUserMessage = ({ sessionId, text, quote, image, type = 'text', fakePhotoContent = null, transfer = null }) => {
    const s = store.sessions.find(x => x.id === sessionId);
    if (!s) return;
    
    // [新增] User 发起转账时记录时间
    if (transfer && !transfer.timestamp) transfer.timestamp = Date.now();

    s.messages.push({ 
        role: 'user', 
        type, 
        content: text||'', 
        quote, 
        image: image||null, 
        fakePhotoContent, 
        transfer, 
        showTranslation: false 
    });
    s.lastMessage = type === 'transfer' ? '[转账]' : (text || '[图片]'); 
    s.lastTime = Date.now();
};

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const checkTransferCommand = (text, session) => {
    if (!text) return text;
    
    while (text.includes('[CMD:RECEIVE]')) {
        const target = [...session.messages].reverse().find(m => m.role === 'user' && m.type === 'transfer' && m.transfer && m.transfer.status === 'pending');
        if (target) {
            target.transfer.status = 'received';
            session.messages.push({ 
                role: 'assistant', 
                type: 'transfer', 
                content: '[已收款]',
                transfer: {
                    amount: target.transfer.amount,
                    status: 'received',
                    remark: '已收款',
                    timestamp: Date.now() // [新增]
                }
            });
        }
        text = text.replace('[CMD:RECEIVE]', '');
    }
    
    while (text.includes('[CMD:RETURN]')) {
        const target = [...session.messages].reverse().find(m => m.role === 'user' && m.type === 'transfer' && m.transfer && m.transfer.status === 'pending');
        if (target) {
            target.transfer.status = 'returned';
            session.messages.push({ 
                role: 'assistant',
                type: 'transfer', 
                content: '[已退还]',
                transfer: {
                    amount: target.transfer.amount,
                    status: 'returned',
                    remark: '已退还',
                    timestamp: Date.now() // [新增]
                }
            });
        }
        text = text.replace('[CMD:RETURN]', '');
    }
    
    return text;
};

export const generateAiMessage = async ({ sessionId, text, quote, image, type = 'text', fakePhotoContent = null, transfer = null }) => {
    const session = store.sessions.find(s => s.id === sessionId);
    if (!session) return;
    
    if (text || image || type === 'transfer') {
        sendUserMessage({ sessionId, text, quote, image, type, fakePhotoContent, transfer });
    }

    const profiles = JSON.parse(safeStorage.getItem('ai_phone_profiles') || '[]');
    const config = profiles.find(p => p.id == safeStorage.getItem('ai_phone_active_id'));
    if (!config || !config.apiKey) { 
        store.notification = { show: true, title: '配置错误', content: '无 API Key', avatar: generateAvatar('!', 'ai'), sessionId: null };
        setTimeout(() => store.notification.show = false, 3000); return;
    }

    session.isGenerating = true;
    let currentMsgIndex = session.messages.length;
    let buffer = "";

    try {
        const history = session.messages.slice(-20, -1).map(m => {
            let c = m.content;
            if (m.type === 'transfer' && m.transfer) c = `(发起转账: ${m.transfer.amount}元, 备注: ${m.transfer.remark})`;
            if (m.fakePhotoContent) c = `(发送照片: ${m.fakePhotoContent})`;
            if (m.role==='user' && m.quote) c = `(引用: "${m.quote.content}")\n${c}`;
            if (!m.fakePhotoContent && m.image && m.image.startsWith('data:')) return { role: m.role, content: [{type:"text",text:c||"图片"},{type:"image_url",image_url:{url:m.image}}] };
            return { role: m.role, content: c||'(空)' };
        });

        const res = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
            body: JSON.stringify({
                model: config.model || 'gpt-3.5-turbo',
                messages: [{ role: 'system', content: buildSystemPrompt(session) }, ...history],
                temperature: 0.7, stream: config.stream !== false, max_tokens: 2500
            })
        });

        if (!res.ok) throw new Error((await res.json()).error?.message || res.status);

        if (config.stream !== false) {
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            
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
                                let part = buffer.slice(0, splitIndex).trim();
                                buffer = buffer.slice(splitIndex + 2); 

                                if (part) {
                                    part = checkTransferCommand(part, session);
                                    if (part.trim()) {
                                        if (!session.messages[currentMsgIndex]) {
                                            session.messages.push({ role: 'assistant', content: '' });
                                        }
                                        updateMessage(session, currentMsgIndex, parseMessageContent(part, session));
                                        currentMsgIndex++;
                                        currentMsgIndex = session.messages.length; 
                                        await wait(100); 
                                    }
                                }
                                splitIndex = buffer.indexOf('\n\n');
                            }
                        } catch (e) {}
                    }
                }
            }
            if (buffer.trim()) {
                let part = buffer;
                part = checkTransferCommand(part, session);
                if (part.trim()) {
                    if (!session.messages[currentMsgIndex]) {
                        session.messages.push({ role: 'assistant', content: '' });
                    }
                    updateMessage(session, currentMsgIndex, parseMessageContent(part, session));
                }
            }

        } else {
            const data = await res.json();
            const fullContent = data.choices[0].message.content || '';
            const parts = fullContent.split('\n\n');

            for (let p of parts) {
                if (!p.trim()) continue;
                p = checkTransferCommand(p, session);
                if (!p.trim()) continue;

                session.messages.push({ role: 'assistant', content: '' });
                currentMsgIndex = session.messages.length - 1; 
                updateMessage(session, currentMsgIndex, parseMessageContent(p, session));
                const delay = Math.min(3000, Math.max(800, p.length * 50));
                await wait(delay);
            }
        }

        const last = session.messages[session.messages.length-1];
        if (last) session.lastMessage = last.type === 'transfer' ? '[转账]' : (last.content || '(无内容)');
        
        if (store.currentViewingSessionId !== sessionId) {
            store.notification = { show: true, title: session.name, content: session.lastMessage, avatar: session.avatar, sessionId };
            setTimeout(() => store.notification.show = false, 4000);
        }

    } catch (e) {
        const err = `[错误] ${e.message}`;
        session.messages.push({ role: 'assistant', content: err });
    } finally {
        session.messages = session.messages.filter(m => {
            if (m.role === 'user') return true;
            const hasContent = m.content && m.content.trim().length > 0;
            const hasImage = !!m.image;
            const hasOs = m.os && m.os.trim().length > 0;
            const hasTransfer = !!m.transfer;
            return hasContent || hasImage || hasOs || hasTransfer;
        });
        session.isGenerating = false;
    }
};
