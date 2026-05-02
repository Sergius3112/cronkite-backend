-- Wipe the article scores cache so unified canonical scoring takes effect immediately.
-- Cached scores from before unification may have been produced by Path 2's old custom
-- prompt rather than the canonical rubric, and would otherwise persist indefinitely.
delete from public.article_scores_cache;
