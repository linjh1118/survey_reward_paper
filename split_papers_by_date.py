#!/usr/bin/env python3
"""
将大的章节文件按日期拆分成小文件，便于分页加载
"""

import json
import os
from collections import defaultdict

def split_chapter_by_date(chapter_file, output_dir):
    """将章节文件按日期拆分"""
    chapter_id = os.path.basename(chapter_file).replace('_papers.jsonl', '')
    
    # 按日期分组
    papers_by_date = defaultdict(list)
    
    with open(chapter_file, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                try:
                    paper = json.loads(line)
                    source_file = paper.get('source_file', '')
                    if source_file:
                        date = source_file.replace('.jsonl', '')
                        papers_by_date[date].append(paper)
                except Exception as e:
                    print(f"解析失败: {e}")
                    continue
    
    # 创建输出目录
    chapter_output_dir = os.path.join(output_dir, chapter_id)
    os.makedirs(chapter_output_dir, exist_ok=True)
    
    # 按日期保存文件
    for date, papers in papers_by_date.items():
        output_file = os.path.join(chapter_output_dir, f'{date}.jsonl')
        with open(output_file, 'w', encoding='utf-8') as f:
            for paper in papers:
                f.write(json.dumps(paper, ensure_ascii=False) + '\n')
    
    # 生成日期索引文件
    dates = sorted(papers_by_date.keys(), reverse=True)  # 最新日期在前
    date_counts = {date: len(papers_by_date[date]) for date in dates}
    
    index_file = os.path.join(chapter_output_dir, 'dates_index.json')
    with open(index_file, 'w', encoding='utf-8') as f:
        json.dump({
            'dates': dates,
            'counts': date_counts,
            'total': sum(date_counts.values())
        }, f, ensure_ascii=False, indent=2)
    
    print(f"{chapter_id}: {len(dates)}个日期, 总计{sum(date_counts.values())}篇论文")
    return dates, date_counts

def main():
    chapters = [
        'survey_data/test_time_scaling_papers.jsonl',
        'survey_data/reward_model_rl_papers.jsonl', 
        'survey_data/reward_model_benchmark_papers.jsonl'
    ]
    
    output_dir = 'survey_data_by_date'
    
    for chapter_file in chapters:
        print(f"处理 {chapter_file}...")
        split_chapter_by_date(chapter_file, output_dir)
    
    print(f"\n✅ 拆分完成！文件保存在 {output_dir}/ 目录")

if __name__ == "__main__":
    main()
