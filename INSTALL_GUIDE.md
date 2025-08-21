# 综述论文系统安装指南

## 快速开始

### 1. 提取论文数据（如果还没有运行过）
```bash
python extract_reward_model_papers.py
```

这将：
- 分析所有 `data/*.jsonl` 文件
- 提取28,598篇相关论文
- 按三个章节分类保存到 `survey_data/` 目录

### 2. 启动网页服务器
由于浏览器安全限制，需要启动本地服务器来访问页面：

```bash
# Python 3
python -m http.server 8000

# 或者使用 Python 2
python -m SimpleHTTPServer 8000

# 或者使用 Node.js
npx http-server

# 或者使用 PHP
php -S localhost:8000
```

### 3. 访问页面
在浏览器中打开：
- 主页: http://localhost:8000/index.html
- 综述页面: http://localhost:8000/index_reward_model.html

## 文件说明

### 核心文件
- `index_reward_model.html` - 综述论文主页面
- `js/reward_model_survey.js` - 前端交互逻辑
- `css/reward_model_survey.css` - 页面样式
- `extract_reward_model_papers.py` - 论文提取脚本

### 数据文件
- `survey_data/all_survey_papers.jsonl` - 所有相关论文（28,598篇）
- `survey_data/test_time_scaling_papers.jsonl` - 第一章论文（8,278篇）
- `survey_data/reward_model_rl_papers.jsonl` - 第二章论文（7,147篇）
- `survey_data/reward_model_benchmark_papers.jsonl` - 第三章论文（24,848篇）
- `survey_data/extraction_stats.json` - 统计信息

## 功能特色

### 📊 数据概览
- **总计**: 28,598篇论文
- **智能分类**: 基于关键词自动分类
- **多章节归属**: 论文可属于多个章节
- **相关性评分**: 根据匹配关键词计算分数

### 🎯 交互功能
- **章节切换**: 点击按钮查看不同章节
- **论文详情**: 完整信息+PDF预览
- **键盘导航**: `←/→` 切换论文，`ESC` 关闭
- **响应式**: 支持手机和平板访问

### 🔍 搜索特性
- **关键词高亮**: 显示匹配的关键词
- **热门词汇**: 每个章节的热门关键词
- **智能排序**: 按相关性分数排序

## 章节内容

### 第一章: Test-Time Scaling
**关键概念**: 测试时计算扩展、推理时优化
**热门关键词**: scale, scaling, test-time, inference time, o1
**论文数量**: 8,278篇

### 第二章: Reward Model for RL  
**关键概念**: 强化学习中的奖励模型、RLHF
**热门关键词**: alignment, reinforcement learning, preference, DPO
**论文数量**: 7,147篇

### 第三章: Reward Model Benchmark
**关键概念**: 奖励模型评估、基准测试
**热门关键词**: dataset, accuracy, evaluation, benchmark
**论文数量**: 24,848篇

## 技术细节

### 关键词匹配
- 使用正则表达式词边界匹配
- 避免部分匹配问题
- 支持大小写不敏感匹配

### 相关性计算
```
相关性分数 = 匹配的关键词数量
```

### 数据更新
重新运行提取脚本即可更新数据：
```bash
python extract_reward_model_papers.py
```

## 故障排除

### 问题1: 页面无法加载数据
**解决**: 确保启动了本地服务器，不能直接用 `file://` 协议

### 问题2: 论文数量为0
**解决**: 检查 `survey_data/` 目录是否存在，运行提取脚本

### 问题3: PDF无法显示
**解决**: 某些PDF可能有跨域限制，这是正常现象

### 问题4: 页面显示不正常
**解决**: 检查浏览器控制台错误，确保所有CSS/JS文件加载成功

## 浏览器兼容性
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 性能建议
- 首次加载可能较慢（需要解析28K+论文）
- 建议使用现代浏览器以获得最佳性能
- 移动端建议使用WiFi网络访问
