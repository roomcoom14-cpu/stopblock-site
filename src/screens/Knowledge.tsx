/**
 * База знаний: список статей → просмотр статьи.
 * Контент статичный (src/data/knowledge.ts), бэкенд не участвует.
 */
import type { ScreenCtx } from "../App";
import { ARTICLES, getArticle, type KnowledgeBlock } from "../data/knowledge";
import { Alert, Header } from "../ui";

function BlockView({ block }: { block: KnowledgeBlock }) {
  if (block.kind === "h") return <h3 className="article__h">{block.text}</h3>;
  if (block.kind === "list")
    return (
      <ul className="article__list">
        {(block.items ?? []).map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
  if (block.kind === "note")
    return <Alert kind="info">{block.text}</Alert>;
  return <p className="article__p">{block.text}</p>;
}

/** Экран статьи (по id из маршрута). */
export function ArticleView({ ctx, id }: { ctx: ScreenCtx; id: string }) {
  const { back } = ctx;
  const article = getArticle(id);

  if (!article) {
    return (
      <>
        <Header title="База знаний" onBack={back} />
        <Alert kind="error">Статья не найдена.</Alert>
      </>
    );
  }

  return (
    <>
      <Header title={article.title} onBack={back} />
      <div className="card article">
        {article.blocks.map((block, i) => (
          <BlockView key={i} block={block} />
        ))}
      </div>
    </>
  );
}

/** Экран со списком статей. */
export function Knowledge({ ctx }: { ctx: ScreenCtx }) {
  const { back, go } = ctx;

  return (
    <>
      <Header title="База знаний" onBack={back} />
      <p className="hint" style={{ margin: "0 2px 10px" }}>
        Как устроен сервис, что делать при проблемах и на чём основаны наши
        протоколы — коротко и без воды.
      </p>
      <div className="menu-list">
        {ARTICLES.map((a) => (
          <button
            key={a.id}
            className="menu-row"
            onClick={() => go({ name: "article", id: a.id })}
          >
            <span className="menu-row__icon">{a.icon}</span>
            <span className="menu-row__body">
              <span className="menu-row__title">{a.title}</span>
              <span className="menu-row__desc">{a.summary}</span>
            </span>
            <span className="menu-row__chevron">›</span>
          </button>
        ))}
      </div>
    </>
  );
}
