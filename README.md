# sabit-shaiholla.github.io

Personal website built with Hugo (PaperMod), deployed to GitHub Pages via GitHub Actions.

## Knowledge Graph embeddings (optional)

The `/graph/` page combines tag-based links with semantic similarity edges computed from
[Gemini embeddings](https://ai.google.dev/gemini-api/docs/embeddings) (`scripts/embed_graph.py`).

### GitHub Actions (CI)

1. Create a key in Google AI Studio.
2. Add it as a repository secret named **`GEMINI_API_KEY`**
   (Settings → Secrets and variables → Actions).
3. Push — the workflow runs `scripts/embed_graph.py` before `hugo build`.
   The key is never written to the repo or the built site; only similarity edge
   weights end up in the public `static/graph/embeddings.json`.

### Local development

```bash
echo "GEMINI_API_KEY=your_key_here" > .env   # gitignored
python3 scripts/embed_graph.py
hugo server
```

### How it works

- Embeddings are cached in `scripts/embeddings-cache.json` (committed) keyed by content hash,
  so the API is only called for new/changed content — safe to commit, contains no secrets.
- Post pairs with cosine similarity ≥ 0.45 (max 6 per post) become "semantic edges",
  rendered as dashed links in the graph. Combined with shared-tag edges, the
  community detection uses the hybrid weights.
- If `embeddings.json` is missing or stale, the graph falls back to tag-based links only,
  and the CI embedding step is non-fatal so a missing key never blocks a deploy.

### Skill areas

`data/skills.json` defines curated skill hubs (RAG & Retrieval, Agentic Systems,
LLM Evaluation, …). The graph template links posts to skills by tag/category overlap,
and community detection is seeded by these hubs so clusters carry the skill's name
and color. Skill descriptions are embedded with the same Gemini model so skills sit
in the right semantic neighborhood.

### Semantic layout

`embed_graph.py` also writes a 2D PCA projection of every node's embedding
(`positions` in `embeddings.json`). The "semantic layout" toggle on the graph page
pins nodes to these embedding-space coordinates instead of the force simulation.
