-- Wipe the article scores cache so the new deterministic content retrieval
-- produces fresh, correct scores. Old cached scores were produced when
-- analyse_url_internal relied on Opus's web search for content retrieval —
-- which sometimes returned the wrong article entirely. Those scores are
-- unreliable and must be discarded.
delete from public.article_scores_cache;

-- Also clear the analysis JSONB on existing articles so the next time they're
-- viewed, fresh canonical scoring runs. Title and URL are preserved.
update public.articles
   set analysis = '{}'::jsonb,
       status = 'pending_rescore'
 where status = 'analysed';
