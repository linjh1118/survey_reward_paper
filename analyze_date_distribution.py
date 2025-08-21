#!/usr/bin/env python3
"""
分析论文数据的日期分布，为分页加载做准备
"""

import json
from collections import defaultdict, Counter

def analyze_chapter_dates(chapter_file):
    """分析单个章节文件的日期分布"""
    date_counts = Counter()
    
    with open(chapter_file, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                try:
                    paper = json.loads(line)
                    source_file = paper.get('source_file', '')
                    if source_file:
                        date = source_file.replace('.jsonl', '')
                        date_counts[date] += 1
                except:
                    continue
    
    return date_counts

def main():
    chapters = {
        'test_time_scaling': 'survey_data/test_time_scaling_papers.jsonl',
        'reward_model_rl': 'survey_data/reward_model_rl_papers.jsonl', 
        'reward_model_benchmark': 'survey_data/reward_model_benchmark_papers.jsonl'
    }
    
    for chapter_id, file_path in chapters.items():
        print(f"\n=== {chapter_id.upper()} ===")
        date_counts = analyze_chapter_dates(file_path)
        
        # 按日期排序
        sorted_dates = sorted(date_counts.items())
        
        print(f"总日期数: {len(sorted_dates)}")
        print(f"总论文数: {sum(date_counts.values())}")
        print(f"平均每日: {sum(date_counts.values()) / len(sorted_dates):.1f}")
        
        # 显示最新的10天
        print(f"\n最新10天:")
        for date, count in sorted_dates[-10:]:
            print(f"  {date}: {count}篇")
        
        # 显示论文数最多的10天
        print(f"\n论文最多的10天:")
        top_dates = sorted(date_counts.items(), key=lambda x: x[1], reverse=True)
        for date, count in top_dates[:10]:
            print(f"  {date}: {count}篇")

if __name__ == "__main__":
    main()
