import os
import re
from collections import Counter
from datetime import date
from typing import List

STOPWORDS = {
    'the','and','a','to','of','in','is','it','that','for','on','with','as','this','be',
    'are','was','were','by','an','or','from','at','but','not','have','has','had','they',
    'he','she','him','her','them','their','its','my','your','you','we','our','us','i',
    'me','do','does','did','so','if','there','about','into','more','can','will','just',
    'been','also','when','which','these','than','other','such','no','any','each','few',
    'most','some','what','who','whom','because','why','how'
}

TEMPLATES = [
    "Reflections about {kw} appear frequently, hinting at deep emotional resonance.",
    "The memories often revolve around {kw}, revealing its significance.",
    "Thoughts on {kw} suggest ongoing personal growth and introspection.",
    "Recurring mentions of {kw} underscore its importance in these notes.",
    "Themes of {kw} highlight an underlying connection and purpose."
]


def extract_keywords(text: str, count: int = 5) -> List[str]:
    words = re.findall(r"[A-Za-z']+", text.lower())
    filtered = [w for w in words if w not in STOPWORDS]
    freq = Counter(filtered)
    return [w for w, _ in freq.most_common(count)]


def generate_bullets(keywords: List[str]) -> List[str]:
    bullets = []
    for i, kw in enumerate(keywords):
        template = TEMPLATES[i % len(TEMPLATES)]
        bullets.append(f"- {template.format(kw=kw)}")
    return bullets


def main():
    log_path = os.path.join('memory', 'memory_log.txt')
    summary_path = os.path.join('memory', 'memory_summary.txt')

    if not os.path.exists(log_path):
        print('Error: memory/memory_log.txt does not exist.')
        return

    with open(log_path, 'r', encoding='utf-8') as f:
        content = f.read().strip()

    today = date.today().isoformat()

    with open(summary_path, 'w', encoding='utf-8') as out:
        out.write(f"[{today}] Summary of Memory Log\n\n")
        if not content:
            out.write("No memories to summarize yet.\n")
            return

        keywords = extract_keywords(content)
        bullets = generate_bullets(keywords)
        for bullet in bullets:
            out.write(bullet + "\n")


if __name__ == '__main__':
    main()
