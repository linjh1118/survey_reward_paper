#!/usr/bin/env python3
"""
提取综述论文相关的论文数据
Extract papers related to the survey paper chapters
"""

import json
import os
import glob
from collections import defaultdict
import re

# 定义三个章节的关键词
CHAPTER_KEYWORDS = {
    "test_time_scaling": {
        "name": "Test-Time Scaling",
        "keywords": [
            # Test-time 相关
            "test-time", "test time", "inference-time", "inference time",
            # Scaling 相关
            "scaling", "scale", "scaling law", "compute scaling",
            # Test-time training/adaptation
            "test-time training", "test-time adaptation", "test-time fine-tuning",
            "test time training", "test time adaptation", "test time fine-tuning",
            # Test-time compute
            "test-time compute", "inference compute", "compute at inference",
            # 推理时优化
            "inference optimization", "runtime optimization",
            # 思维链相关
            "chain of thought", "reasoning at test time", "multi-step reasoning",
            # 搜索和采样
            "search at inference", "beam search", "sampling strategies",
            "monte carlo tree search", "MCTS",
            # o1相关
            "o1", "strawberry", "reasoning model",
            # 验证和自我改进
            "self-verification", "self-correction", "iterative refinement"
        ]
    },
    "reward_model_rl": {
        "name": "Reward Model for RL", 
        "keywords": [
            # Reward model 核心
            "reward model", "reward modeling", "reward function",
            # RLHF相关
            "RLHF", "reinforcement learning from human feedback",
            "human feedback", "preference learning",
            # PPO和RL算法
            "PPO", "proximal policy optimization", "policy gradient",
            "reinforcement learning", "policy optimization",
            # 偏好和比较
            "preference", "comparison", "ranking", "pairwise",
            # Constitutional AI
            "constitutional AI", "RLAIF", "AI feedback",
            # 价值对齐
            "alignment", "value alignment", "human alignment",
            # 奖励黑客
            "reward hacking", "goodhart's law", "optimization pressure",
            # 具体方法
            "DPO", "direct preference optimization", "SLiC", "LIMA",
            "InstructGPT", "ChatGPT training"
        ]
    },
    "reward_model_benchmark": {
        "name": "Reward Model Benchmark",
        "keywords": [
            # Benchmark核心
            "benchmark", "evaluation", "dataset", "testbed",
            # Reward model评估
            "reward model evaluation", "preference dataset", 
            "human preference", "annotation",
            # 具体benchmark
            "helpfulness", "harmlessness", "honesty",
            "truthfulness", "factuality", "safety",
            # 评估指标
            "correlation", "agreement", "consistency", "reliability",
            "inter-annotator agreement", "kappa", "accuracy",
            # 数据集
            "Anthropic HH", "OpenAI summarization", "WebGPT",
            "StackLLaMA", "Alpaca", "Vicuna",
            # 评估任务
            "summarization", "dialogue", "question answering",
            "code generation", "mathematical reasoning",
            # 多维度评估
            "multi-dimensional", "aspect-based", "fine-grained",
            "rubric", "criteria", "dimension"
        ]
    }
}

def load_jsonl_file(file_path):
    """加载JSONL文件"""
    papers = []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    papers.append(json.loads(line))
    except Exception as e:
        print(f"Error loading {file_path}: {e}")
    return papers

def extract_keywords_from_text(text, keywords):
    """从文本中提取关键词匹配"""
    text_lower = text.lower()
    matched_keywords = []
    
    for keyword in keywords:
        # 使用正则表达式进行词边界匹配，避免部分匹配
        pattern = r'\b' + re.escape(keyword.lower()) + r'\b'
        if re.search(pattern, text_lower):
            matched_keywords.append(keyword)
    
    return matched_keywords

def categorize_paper(paper, chapter_keywords):
    """根据关键词将论文分类到章节"""
    title = paper.get('title', '')
    summary = paper.get('summary', '')
    
    # 组合标题和摘要进行匹配
    full_text = f"{title} {summary}"
    
    paper_categories = {}
    
    for chapter_id, chapter_info in chapter_keywords.items():
        matched_keywords = extract_keywords_from_text(full_text, chapter_info['keywords'])
        if matched_keywords:
            paper_categories[chapter_id] = {
                'chapter_name': chapter_info['name'],
                'matched_keywords': matched_keywords,
                'score': len(matched_keywords)  # 匹配关键词数量作为相关性分数
            }
    
    return paper_categories

def extract_papers_by_chapters(data_dir='data'):
    """从所有数据文件中提取章节相关论文"""
    all_papers = []
    chapter_papers = defaultdict(list)
    
    # 获取所有JSONL文件
    jsonl_files = glob.glob(os.path.join(data_dir, '*.jsonl'))
    # 排除AI增强的文件，只使用原始数据
    jsonl_files = [f for f in jsonl_files if '_AI_enhanced_' not in f]
    
    print(f"找到 {len(jsonl_files)} 个数据文件")
    
    # 处理每个文件
    for file_path in sorted(jsonl_files):
        print(f"处理文件: {file_path}")
        papers = load_jsonl_file(file_path)
        
        for paper in papers:
            # 分类论文
            categories = categorize_paper(paper, CHAPTER_KEYWORDS)
            
            if categories:
                # 为论文添加分类信息
                paper['survey_categories'] = categories
                paper['source_file'] = os.path.basename(file_path)
                
                # 按章节存储
                for chapter_id in categories.keys():
                    chapter_papers[chapter_id].append(paper)
                
                all_papers.append(paper)
    
    return all_papers, dict(chapter_papers)

def save_extracted_data(all_papers, chapter_papers, output_dir='survey_data'):
    """保存提取的数据"""
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # 保存所有相关论文
    with open(os.path.join(output_dir, 'all_survey_papers.jsonl'), 'w', encoding='utf-8') as f:
        for paper in all_papers:
            f.write(json.dumps(paper, ensure_ascii=False) + '\n')
    
    # 按章节保存
    for chapter_id, papers in chapter_papers.items():
        # 按相关性分数排序
        papers.sort(key=lambda x: max(x['survey_categories'][chapter_id]['score'] 
                                    for cat_id in x['survey_categories'] 
                                    if cat_id == chapter_id), reverse=True)
        
        filename = f'{chapter_id}_papers.jsonl'
        with open(os.path.join(output_dir, filename), 'w', encoding='utf-8') as f:
            for paper in papers:
                f.write(json.dumps(paper, ensure_ascii=False) + '\n')
    
    # 生成统计报告
    stats = {
        'total_papers': len(all_papers),
        'chapter_stats': {}
    }
    
    for chapter_id, papers in chapter_papers.items():
        chapter_name = CHAPTER_KEYWORDS[chapter_id]['name']
        stats['chapter_stats'][chapter_id] = {
            'name': chapter_name,
            'count': len(papers),
            'top_keywords': get_top_keywords(papers, chapter_id)
        }
    
    with open(os.path.join(output_dir, 'extraction_stats.json'), 'w', encoding='utf-8') as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
    
    return stats

def get_top_keywords(papers, chapter_id):
    """获取最常匹配的关键词"""
    keyword_counts = defaultdict(int)
    
    for paper in papers:
        if chapter_id in paper.get('survey_categories', {}):
            for keyword in paper['survey_categories'][chapter_id]['matched_keywords']:
                keyword_counts[keyword] += 1
    
    # 返回前10个最常见的关键词
    return sorted(keyword_counts.items(), key=lambda x: x[1], reverse=True)[:10]

def print_statistics(stats):
    """打印统计信息"""
    print("\n" + "="*60)
    print("论文提取统计 / Paper Extraction Statistics")
    print("="*60)
    print(f"总论文数量: {stats['total_papers']}")
    print("\n章节统计:")
    
    for chapter_id, chapter_stats in stats['chapter_stats'].items():
        print(f"\n📚 {chapter_stats['name']}")
        print(f"   论文数量: {chapter_stats['count']}")
        print(f"   热门关键词:")
        for keyword, count in chapter_stats['top_keywords'][:5]:
            print(f"     - {keyword}: {count}")

def main():
    print("开始提取综述论文相关数据...")
    
    # 提取论文
    all_papers, chapter_papers = extract_papers_by_chapters()
    
    if not all_papers:
        print("未找到相关论文。请检查关键词设置。")
        return
    
    # 保存数据
    stats = save_extracted_data(all_papers, chapter_papers)
    
    # 打印统计
    print_statistics(stats)
    
    print(f"\n✅ 提取完成！数据已保存到 survey_data/ 目录")
    print("生成的文件:")
    print("  - all_survey_papers.jsonl: 所有相关论文")
    print("  - test_time_scaling_papers.jsonl: 第一章相关论文")
    print("  - reward_model_rl_papers.jsonl: 第二章相关论文") 
    print("  - reward_model_benchmark_papers.jsonl: 第三章相关论文")
    print("  - extraction_stats.json: 提取统计信息")

if __name__ == "__main__":
    main()
