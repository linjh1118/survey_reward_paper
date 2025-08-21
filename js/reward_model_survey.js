let currentChapter = 'all';
let allPapers = {};
let currentFilteredPapers = [];
let currentPaperIndex = 0;
let chapterStats = {};
let loadedChapters = new Set(); // 记录已加载的章节
let chapterDates = {}; // 存储各章节的日期索引
let loadedDates = {}; // 记录各章节已加载的日期 {chapterId: Set([dates])}
let loadingMore = false; // 是否正在加载更多数据

// 章节映射
const CHAPTER_MAP = {
    'test_time_scaling': 'Test-Time Scaling',
    'reward_model_rl': 'Reward Model for RL', 
    'reward_model_benchmark': 'Reward Model Benchmark'
};

// 数据加载函数 - 照搬原版app.js的懒加载思路
async function loadSurveyData() {
    try {
        showLoading(true);
        
        // 只加载统计信息，不预加载论文数据
        const statsResponse = await fetch('survey_data/extraction_stats.json');
        if (!statsResponse.ok) {
            throw new Error(`统计信息加载失败: ${statsResponse.status}`);
        }
        
        const stats = await statsResponse.json();
        chapterStats = stats.chapter_stats;
        
        // 更新计数器
        updateChapterCounts(stats);
        
        // 初始化空的论文数据结构
        allPapers = {
            'all': [],
            'test_time_scaling': [],
            'reward_model_rl': [],
            'reward_model_benchmark': []
        };
        
        // 渲染空状态
        renderPapers();
        showLoading(false);
        
    } catch (error) {
        console.error('加载数据失败:', error);
        showError(`数据加载失败: ${error.message}`);
        showLoading(false);
    }
}

// 加载章节的日期索引
async function loadChapterIndex(chapterId) {
    if (chapterDates[chapterId]) {
        return chapterDates[chapterId];
    }
    
    try {
        const response = await fetch(`survey_data_by_date/${chapterId}/dates_index.json`);
        if (!response.ok) {
            throw new Error(`索引加载失败: ${response.status}`);
        }
        
        const index = await response.json();
        chapterDates[chapterId] = index;
        loadedDates[chapterId] = new Set();
        
        return index;
    } catch (error) {
        console.error(`${chapterId}索引加载失败:`, error);
        throw error;
    }
}

// 按日期分页加载章节数据
async function loadChapterData(chapterId, loadCount = 7) {
    if (chapterId === 'all') {
        return;
    }
    
    try {
        // 先加载索引
        const index = await loadChapterIndex(chapterId);
        
        // 初始化论文数组
        if (!allPapers[chapterId]) {
            allPapers[chapterId] = [];
        }
        
        // 获取还未加载的日期（最新的几天）
        const unloadedDates = index.dates.filter(date => 
            !loadedDates[chapterId].has(date)
        ).slice(0, loadCount);
        
        if (unloadedDates.length === 0) {
            return; // 没有更多数据
        }
        
        console.log(`加载${chapterId}的${unloadedDates.length}天数据:`, unloadedDates);
        
        // 并行加载这些日期的数据
        const loadPromises = unloadedDates.map(async (date) => {
            const response = await fetch(`survey_data_by_date/${chapterId}/${date}.jsonl`);
            if (!response.ok) {
                throw new Error(`${date}数据加载失败: ${response.status}`);
            }
            
            const text = await response.text();
            const papers = parseSurveyJsonlData(text);
            
            // 标记日期已加载
            loadedDates[chapterId].add(date);
            
            return papers;
        });
        
        const dateResults = await Promise.all(loadPromises);
        
        // 合并到章节数据中
        dateResults.forEach(papers => {
            allPapers[chapterId].push(...papers);
        });
        
        // 按日期排序（最新的在前）
        allPapers[chapterId].sort((a, b) => {
            const dateA = a.source_file ? a.source_file.replace('.jsonl', '') : '';
            const dateB = b.source_file ? b.source_file.replace('.jsonl', '') : '';
            return dateB.localeCompare(dateA);
        });
        
        // 更新all数组
        updateAllPapers();
        
        console.log(`${chapterId}加载完成: +${dateResults.flat().length}篇, 总计${allPapers[chapterId].length}篇`);
        
    } catch (error) {
        console.error(`${chapterId}加载失败:`, error);
        throw error;
    }
}

// 加载更多数据
async function loadMoreData(chapterId) {
    if (loadingMore || chapterId === 'all') {
        return;
    }
    
    loadingMore = true;
    
    try {
        const container = document.getElementById('paperContainer');
        
        // 添加加载提示
        const loadMoreDiv = document.createElement('div');
        loadMoreDiv.id = 'loadMoreIndicator';
        loadMoreDiv.className = 'loading-container';
        loadMoreDiv.innerHTML = `
            <div class="loading-spinner"></div>
            <p>加载更多论文...</p>
        `;
        container.appendChild(loadMoreDiv);
        
        await loadChapterData(chapterId, 5); // 每次加载5天数据
        
        // 移除加载提示
        const indicator = document.getElementById('loadMoreIndicator');
        if (indicator) {
            indicator.remove();
        }
        
        // 重新渲染
        renderPapers();
        
    } catch (error) {
        console.error('加载更多数据失败:', error);
        
        // 显示错误提示
        const indicator = document.getElementById('loadMoreIndicator');
        if (indicator) {
            indicator.innerHTML = `
                <p>加载失败: ${error.message}</p>
                <button onclick="loadMoreData('${chapterId}')" class="retry-button">重试</button>
            `;
        }
    } finally {
        loadingMore = false;
    }
}

// 解析JSONL数据 - 照搬原版的parseJsonlData思路
function parseSurveyJsonlData(jsonlText) {
    const papers = [];
    const lines = jsonlText.trim().split('\n');
    
    lines.forEach(line => {
        try {
            if (line.trim()) {
                const paper = JSON.parse(line);
                
                // 转换为统一格式，照搬原版的数据结构
                papers.push({
                    id: paper.id,
                    title: paper.title,
                    url: paper.abs || paper.pdf || `https://arxiv.org/abs/${paper.id}`,
                    authors: Array.isArray(paper.authors) ? paper.authors.join(', ') : paper.authors,
                    category: paper.categories,
                    allCategories: paper.categories,
                    summary: paper.summary,
                    details: paper.summary || '',
                    date: paper.source_file ? paper.source_file.replace('.jsonl', '') : 'Unknown',
                    survey_categories: paper.survey_categories,
                    source_file: paper.source_file
                });
            }
        } catch (error) {
            console.error('解析JSON行失败:', error);
        }
    });
    
    return papers;
}

// 更新all数组
function updateAllPapers() {
    const allPapersSet = new Set();
    const allPapersArray = [];
    
    ['test_time_scaling', 'reward_model_rl', 'reward_model_benchmark'].forEach(chapterId => {
        if (allPapers[chapterId]) {
            allPapers[chapterId].forEach(paper => {
                if (!allPapersSet.has(paper.id)) {
                    allPapersSet.add(paper.id);
                    allPapersArray.push(paper);
                }
            });
        }
    });
    
    allPapers['all'] = allPapersArray;
}

// 更新章节计数
function updateChapterCounts(stats) {
    const totalPapersElement = document.getElementById('totalPapers');
    const allCountElement = document.getElementById('allCount');
    
    if (totalPapersElement) {
        totalPapersElement.textContent = stats.total_papers.toLocaleString();
    }
    
    if (allCountElement) {
        allCountElement.textContent = stats.total_papers.toLocaleString();
    }
    
    // 更新各章节计数
    Object.entries(stats.chapter_stats).forEach(([chapterId, chapterData]) => {
        const elementId = getCountElementId(chapterId);
        const countElement = document.getElementById(elementId);
        
        if (countElement) {
            countElement.textContent = chapterData.count.toLocaleString();
        }
    });
}

function getCountElementId(chapterId) {
    const idMap = {
        'test_time_scaling': 'testTimeCount',
        'reward_model_rl': 'rewardRLCount', 
        'reward_model_benchmark': 'benchmarkCount'
    };
    return idMap[chapterId];
}

// 章节切换 - 分页加载思路
async function switchChapter(chapterId) {
    currentChapter = chapterId;
    
    // 更新按钮状态
    document.querySelectorAll('.chapter-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.chapter === chapterId);
    });
    
    // 显示/隐藏关键词
    updateKeywordsDisplay(chapterId);
    
    // 如果切换到具体章节且未加载，先加载最新数据
    if (chapterId !== 'all' && !loadedChapters.has(chapterId)) {
        const container = document.getElementById('paperContainer');
        container.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <p>加载${CHAPTER_MAP[chapterId]}最新论文...</p>
            </div>
        `;
        
        try {
            await loadChapterData(chapterId, 7); // 首次加载最新7天
            loadedChapters.add(chapterId);
        } catch (error) {
            container.innerHTML = `
                <div class="loading-container">
                    <p>加载失败: ${error.message}</p>
                    <button onclick="switchChapter('${chapterId}')" class="retry-button">重试</button>
                </div>
            `;
            return;
        }
    }
    
    // 重新渲染论文
    renderPapers();
}

// 更新关键词显示
function updateKeywordsDisplay(chapterId) {
    const keywordsContainer = document.getElementById('keywordsContainer');
    const keywordsTags = document.getElementById('keywordsTags');
    
    if (chapterId === 'all') {
        keywordsContainer.style.display = 'none';
        return;
    }
    
    const chapterData = chapterStats[chapterId];
    if (chapterData && chapterData.top_keywords) {
        keywordsContainer.style.display = 'block';
        
        // 生成关键词标签
        keywordsTags.innerHTML = '';
        chapterData.top_keywords.slice(0, 8).forEach(([keyword, count]) => {
            const tag = document.createElement('span');
            tag.className = 'keyword-tag';
            tag.innerHTML = `${keyword} <span class="keyword-count">${count}</span>`;
            keywordsTags.appendChild(tag);
        });
    } else {
        keywordsContainer.style.display = 'none';
    }
}

// 渲染论文列表
function renderPapers() {
    const container = document.getElementById('paperContainer');
    container.innerHTML = '';
    
    const papers = allPapers[currentChapter] || [];
    currentFilteredPapers = [...papers];
    
    // 更新显示计数
    const filteredPapersElement = document.getElementById('filteredPapers');
    if (filteredPapersElement) {
        filteredPapersElement.textContent = papers.length.toLocaleString();
    }
    
    if (papers.length === 0) {
        container.innerHTML = `
            <div class="loading-container">
                <p>该章节暂无相关论文</p>
            </div>
        `;
        return;
    }
    
    // 按相关性分数排序
    papers.sort((a, b) => {
        if (currentChapter === 'all') return 0;
        
        const aScore = a.survey_categories?.[currentChapter]?.score || 0;
        const bScore = b.survey_categories?.[currentChapter]?.score || 0;
        return bScore - aScore;
    });
    
    papers.forEach((paper, index) => {
        const paperCard = createPaperCard(paper, index);
        container.appendChild(paperCard);
    });
    
    // 添加"加载更多"按钮（仅对具体章节）
    if (currentChapter !== 'all' && chapterDates[currentChapter]) {
        const index = chapterDates[currentChapter];
        const loadedCount = loadedDates[currentChapter] ? loadedDates[currentChapter].size : 0;
        const hasMore = loadedCount < index.dates.length;
        
        if (hasMore) {
            const loadMoreButton = document.createElement('div');
            loadMoreButton.className = 'load-more-container';
            loadMoreButton.innerHTML = `
                <button class="load-more-button" onclick="loadMoreData('${currentChapter}')">
                    <span>加载更多论文</span>
                    <small>已加载 ${loadedCount}/${index.dates.length} 天的数据</small>
                </button>
            `;
            container.appendChild(loadMoreButton);
        }
    }
}

// 创建论文卡片
function createPaperCard(paper, index) {
    const card = document.createElement('div');
    card.className = 'paper-card';
    card.dataset.id = paper.id;
    
    // 获取匹配的章节信息
    const relevantChapters = [];
    if (paper.survey_categories) {
        Object.entries(paper.survey_categories).forEach(([chapterId, chapterData]) => {
            relevantChapters.push({
                id: chapterId,
                name: CHAPTER_MAP[chapterId] || chapterData.chapter_name,
                score: chapterData.score,
                keywords: chapterData.matched_keywords.slice(0, 3)
            });
        });
    }
    
    // 排序相关章节（按分数）
    relevantChapters.sort((a, b) => b.score - a.score);
    
    // 生成章节标签
    const chapterTags = relevantChapters.map(chapter => 
        `<span class="chapter-tag" data-chapter="${chapter.id}" title="匹配关键词: ${chapter.keywords.join(', ')}">
            ${chapter.name} (${chapter.score})
        </span>`
    ).join('');
    
    // 处理作者列表
    const authors = Array.isArray(paper.authors) ? paper.authors.join(', ') : paper.authors;
    
    // 格式化日期
    const date = paper.source_file ? paper.source_file.replace('.jsonl', '') : 'Unknown';
    
    card.innerHTML = `
        <div class="paper-card-index">${index + 1}</div>
        <div class="paper-card-header">
            <h3 class="paper-card-title">${paper.title}</h3>
            <p class="paper-card-authors">${authors}</p>
            <div class="paper-card-categories">
                ${chapterTags}
            </div>
        </div>
        <div class="paper-card-body">
            <p class="paper-card-summary">${paper.summary}</p>
            <div class="paper-card-footer">
                <span class="paper-card-date">${date}</span>
                <span class="paper-card-link">查看详情</span>
            </div>
        </div>
    `;
    
    card.addEventListener('click', () => {
        currentPaperIndex = index;
        showPaperDetails(paper, index + 1);
    });
    
    return card;
}

// 显示论文详情
function showPaperDetails(paper, paperIndex) {
    const modal = document.getElementById('paperModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    // 重置模态框滚动位置
    modalBody.scrollTop = 0;
    
    // 设置标题
    modalTitle.innerHTML = `<span class="paper-index-badge">${paperIndex}</span> ${paper.title}`;
    
    // 处理作者
    const authors = Array.isArray(paper.authors) ? paper.authors.join(', ') : paper.authors;
    
    // 处理分类
    const categories = Array.isArray(paper.categories) ? paper.categories.join(', ') : paper.categories;
    
    // 获取相关章节信息
    let chaptersInfo = '';
    if (paper.survey_categories) {
        const relevantChapters = [];
        Object.entries(paper.survey_categories).forEach(([chapterId, chapterData]) => {
            relevantChapters.push({
                name: CHAPTER_MAP[chapterId] || chapterData.chapter_name,
                score: chapterData.score,
                keywords: chapterData.matched_keywords
            });
        });
        
        if (relevantChapters.length > 0) {
            chaptersInfo = `
                <div class="survey-relevance">
                    <h4>综述相关性 / Survey Relevance</h4>
                    ${relevantChapters.map(chapter => `
                        <div class="relevance-item">
                            <strong>${chapter.name}</strong> (相关性分数: ${chapter.score})
                            <div class="matched-keywords">
                                匹配关键词: ${chapter.keywords.join(', ')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    }
    
    const modalContent = `
        <div class="paper-details">
            <p><strong>作者:</strong> ${authors}</p>
            <p><strong>分类:</strong> ${categories}</p>
            <p><strong>来源:</strong> ${paper.source_file || 'Unknown'}</p>
            
            ${chaptersInfo}
            
            <h3>摘要 / Abstract</h3>
            <p class="paper-abstract">${paper.summary}</p>
            
            <div class="pdf-preview-section">
                <div class="pdf-header">
                    <h3>PDF预览 / PDF Preview</h3>
                </div>
                <div class="pdf-container">
                    <iframe src="${paper.pdf}" width="100%" height="800px" frameborder="0"></iframe>
                </div>
            </div>
        </div>
    `;
    
    modalBody.innerHTML = modalContent;
    
    // 更新链接
    document.getElementById('paperLink').href = paper.abs;
    document.getElementById('pdfLink').href = paper.pdf;
    
    // 更新论文位置信息
    const paperPosition = document.getElementById('paperPosition');
    if (paperPosition && currentFilteredPapers.length > 0) {
        paperPosition.textContent = `${currentPaperIndex + 1} / ${currentFilteredPapers.length}`;
    }
    
    // 显示模态框
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// 关闭模态框
function closeModal() {
    const modal = document.getElementById('paperModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// 导航功能
function navigateToPreviousPaper() {
    if (currentFilteredPapers.length === 0) return;
    
    currentPaperIndex = currentPaperIndex > 0 ? currentPaperIndex - 1 : currentFilteredPapers.length - 1;
    const paper = currentFilteredPapers[currentPaperIndex];
    showPaperDetails(paper, currentPaperIndex + 1);
}

function navigateToNextPaper() {
    if (currentFilteredPapers.length === 0) return;
    
    currentPaperIndex = currentPaperIndex < currentFilteredPapers.length - 1 ? currentPaperIndex + 1 : 0;
    const paper = currentFilteredPapers[currentPaperIndex];
    showPaperDetails(paper, currentPaperIndex + 1);
}

// 显示/隐藏加载状态
function showLoading(show) {
    const loadingContainer = document.getElementById('loadingContainer');
    const paperContainer = document.getElementById('paperContainer');
    
    if (show) {
        loadingContainer.style.display = 'flex';
        paperContainer.style.display = 'none';
    } else {
        loadingContainer.style.display = 'none';
        paperContainer.style.display = 'block';
    }
}

// 显示错误信息
function showError(message) {
    const container = document.getElementById('paperContainer');
    container.innerHTML = `
        <div class="loading-container">
            <p style="color: #ff6b6b;">${message}</p>
        </div>
    `;
}

// 格式化日期
function formatDate(dateStr) {
    if (!dateStr) return 'Unknown';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('zh-CN');
    } catch {
        return dateStr;
    }
}

// 事件监听器
function initEventListeners() {
    // 章节按钮
    document.querySelectorAll('.chapter-button').forEach(button => {
        button.addEventListener('click', async () => {
            const chapterId = button.dataset.chapter;
            await switchChapter(chapterId);
        });
    });
    
    // 模态框关闭
    document.getElementById('closeModal').addEventListener('click', closeModal);
    
    // 论文导航
    document.getElementById('prevPaper').addEventListener('click', navigateToPreviousPaper);
    document.getElementById('nextPaper').addEventListener('click', navigateToNextPaper);
    
    // 模态框背景点击关闭
    document.getElementById('paperModal').addEventListener('click', (event) => {
        if (event.target === event.currentTarget) {
            closeModal();
        }
    });
    
    // 键盘快捷键
    document.addEventListener('keydown', (event) => {
        const modal = document.getElementById('paperModal');
        
        if (event.key === 'Escape') {
            if (modal.classList.contains('active')) {
                closeModal();
            }
        } else if (event.key === 'ArrowLeft') {
            if (modal.classList.contains('active')) {
                event.preventDefault();
                navigateToPreviousPaper();
            }
        } else if (event.key === 'ArrowRight') {
            if (modal.classList.contains('active')) {
                event.preventDefault();
                navigateToNextPaper();
            }
        }
    });
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    loadSurveyData();
});
