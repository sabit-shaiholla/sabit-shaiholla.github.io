// Word Cloud Implementation with TF-IDF and Catppuccin Mocha
// Dependencies: d3, d3-cloud

class WordCloud {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.width = this.container.offsetWidth;
        this.height = this.container.offsetHeight;
        this.data = [];

        // Catppuccin Mocha Palette
        this.colors = [
            '#f5e0dc', '#f2cdcd', '#f5c2e7', '#cba6f7', '#f38ba8',
            '#eba0ac', '#fab387', '#f9e2af', '#a6e3a1', '#94e2d5',
            '#89dceb', '#74c7ec', '#89b4fa', '#b4befe'
        ];

        this.stopWords = new Set([
            "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "as", "at",
            "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
            "can", "did", "do", "does", "doing", "don", "down", "during",
            "each", "few", "for", "from", "further",
            "had", "has", "have", "having", "he", "her", "here", "hers", "herself", "him", "himself", "his", "how",
            "i", "if", "in", "into", "is", "it", "its", "itself",
            "just", "me", "more", "most", "my", "myself",
            "no", "nor", "not", "now", "of", "off", "on", "once", "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own",
            "s", "same", "she", "should", "so", "some", "such",
            "t", "than", "that", "the", "their", "theirs", "them", "themselves", "then", "there", "these", "they", "this", "those", "through", "to", "too",
            "under", "until", "up", "very",
            "was", "we", "were", "what", "when", "where", "which", "while", "who", "whom", "why", "will", "with", "would",
            "you", "your", "yours", "yourself", "yourselves",
            "one", "two", "three", "four", "five", "first", "second", "third", "also", "like", "use", "using", "used", "get", "got", "make", "made"
        ]);

        this.init();
    }

    async init() {
        try {
            const res = await fetch('/wordcloud/index.json');
            if (!res.ok) throw new Error("Failed to load content for index");

            const rawData = await res.json();
            const words = this.processTFIDF(rawData);
            this.render(words);

            // Handle resize
            window.addEventListener('resize', () => {
                this.width = this.container.offsetWidth;
                this.height = this.container.offsetHeight;
                this.container.innerHTML = '';
                this.render(words);
            });

        } catch (e) {
            console.error("Word Cloud Error:", e);
            this.container.innerHTML = `<div style="text-align:center; padding-top: 20%; color: #f38ba8;">Failed to load word cloud data.</div>`;
        }
    }

    processTFIDF(docs) {
        // 1. Tokenize and Count
        const docTerms = docs.map(doc => {
            const tokens = doc.text.toLowerCase()
                .replace(/[^a-z0-9\s-]/g, "") // Remove punctuation
                .split(/\s+/)
                .filter(w => w.length > 2 && !this.stopWords.has(w) && !/^\d+$/.test(w));

            const counts = {};
            tokens.forEach(t => counts[t] = (counts[t] || 0) + 1);
            return { id: doc.link, counts: counts, total: tokens.length };
        });

        // 2. Compute TF and IDF
        const allTerms = new Set();
        docTerms.forEach(d => Object.keys(d.counts).forEach(t => allTerms.add(t)));

        const N = docs.length;
        const finalScores = {};

        allTerms.forEach(term => {
            // IDF: log(N / df) where df is number of docs containing term
            let df = 0;
            docTerms.forEach(d => { if (d.counts[term]) df++; });
            const idf = Math.log(1 + (N / (df || 1))); // Adjusted IDF to avoid infinity

            // TF-IDF Sum: Sum of (tf * idf) across all docs for this term
            // We want global importance, so we sum the scores or avg them. 
            // Summing highlights words that appear importantly in many documents.
            let totalScore = 0;
            docTerms.forEach(doc => {
                if (doc.counts[term]) {
                    const tf = doc.counts[term] / doc.total;
                    totalScore += (tf * idf);
                }
            });

            finalScores[term] = totalScore;
        });

        // 3. Convert to Array and Sort
        const sortedWords = Object.entries(finalScores)
            .map(([text, size]) => ({ text, size }))
            .sort((a, b) => b.size - a.size)
            .slice(0, 100); // Top 100 words

        // 4. Normalize Sizes for D3
        if (sortedWords.length > 0) {
            const minSize = sortedWords[sortedWords.length - 1].size;
            const maxSize = sortedWords[0].size;
            const fontScale = d3.scaleSqrt().domain([minSize, maxSize]).range([14, 60]);

            return sortedWords.map(w => ({ ...w, size: fontScale(w.size) }));
        }
        return [];
    }

    render(words) {
        const layout = d3.layout.cloud()
            .size([this.width, this.height])
            .words(words)
            .padding(5)
            .rotate(() => (~~(Math.random() * 2) * 90))
            .font("JetBrains Mono") // Use site font
            .fontSize(d => d.size)
            .on("end", this.draw.bind(this));

        layout.start();
    }

    draw(words) {
        const fill = d3.scaleOrdinal(this.colors);

        d3.select(this.container).append("svg")
            .attr("width", this.width)
            .attr("height", this.height)
            .append("g")
            .attr("transform", "translate(" + this.width / 2 + "," + this.height / 2 + ")")
            .selectAll("text")
            .data(words)
            .enter().append("text")
            .style("font-size", d => d.size + "px")
            .style("font-family", "JetBrains Mono, monospace")
            .style("fill", (d, i) => fill(i))
            .attr("text-anchor", "middle")
            .attr("transform", d => "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")")
            .text(d => d.text)
            .style("cursor", "pointer")
            .style("transition", "all 0.3s ease")
            .on("mouseover", function () {
                d3.select(this)
                    .style("opacity", 1)
                    .style("text-shadow", "0 0 10px rgba(203, 166, 247, 0.5)"); // Glow effect
            })
            .on("mouseout", function () {
                d3.select(this)
                    .style("opacity", 0.9)
                    .style("text-shadow", "none");
            })
            .on("click", (event, d) => {
                // Navigate to search or filter
                // For now, let's just log or maybe redirect to search page if it exists
                window.location.href = `/search/?q=${d.text}`;
            });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new WordCloud('wordcloud-container');
});
