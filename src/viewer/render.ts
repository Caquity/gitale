import type { ViewerSnapshot, ViewerTreeNode } from "./read-model.js";

export function renderViewerHtml(snapshot: ViewerSnapshot): string {
  const children = new Map<string | null, ViewerTreeNode[]>();
  for (const node of snapshot.tree) {
    const siblings = children.get(node.parentNodeId) ?? [];
    siblings.push(node);
    children.set(node.parentNodeId, siblings);
  }
  const treeHtml = (children.get(null) ?? [])
    .map((node) => renderTreeNode(node, children))
    .join("");
  const selected = snapshot.selectedNode;
  const detailHtml = selected === null ? renderEmptyState() : renderNode(selected, snapshot);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Gitale Story Checkpoint Workspace</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; background: #f6f3ed; color: #27251f; }
    header { padding: 1.4rem 2rem; border-bottom: 1px solid #d8d0c2; background: #fffdf8; }
    .layout { display: grid; grid-template-columns: minmax(16rem, 24rem) 1fr; min-height: calc(100vh - 5rem); }
    aside { padding: 1.5rem; border-right: 1px solid #d8d0c2; background: #faf8f2; }
    main { padding: 2rem clamp(1.5rem, 5vw, 5rem); max-width: 55rem; }
    .tree, .tree ul { list-style: none; margin: 0; padding-left: 1rem; }
    .tree { padding-left: 0; }
    .tree li { margin: .45rem 0; }
    .node-link { display: inline-block; padding: .45rem .6rem; border: 1px solid #a69e91; border-radius: .5rem; color: inherit; text-decoration: none; background: #fffdf8; }
    .node-link.status-candidate { border-style: dashed; }
    .node-link.status-abandoned { opacity: .55; }
    .node-link.current-path { box-shadow: 0 0 0 2px #b8955a inset; }
    .node-link.selected { background: #efe0bc; }
    .status { border-radius: 999px; padding: .16rem .5rem; font-size: .8rem; }
    .status-candidate { border: 1px dashed #806a40; }
    .status-accepted { border: 1px solid #4d6c50; }
    .status-abandoned { opacity: .6; text-decoration: line-through; }
    .story-artifact { background: #fffdf8; border: 1px solid #d8d0c2; border-radius: .8rem; padding: clamp(1rem, 4vw, 2.5rem); }
    .story-content { white-space: pre-wrap; font: 1.15rem/1.8 Georgia, serif; margin: 1rem 0 2rem; }
    .node-details { display: grid; grid-template-columns: max-content 1fr; gap: .65rem 1rem; }
    .revision-history { margin-top: 2rem; border-top: 1px solid #d8d0c2; padding-top: 1rem; }
    .revision-history ol { margin: 0; padding-left: 1.5rem; }
    .revision-history li { margin: .5rem 0; }
    .revision-history a { color: inherit; }
    .revision-current { color: #4d6c50; font-weight: 600; }
    .revision-selected { color: #8a6c38; }
    dt { color: #766e61; } dd { margin: 0; }
    code { display: block; overflow-wrap: anywhere; padding: .8rem; background: #f0ece3; border-radius: .4rem; }
    .eyebrow { color: #8a6c38; letter-spacing: .12em; font-size: .75rem; }
    @media (max-width: 700px) { .layout { display: block; } aside { border-right: 0; border-bottom: 1px solid #d8d0c2; } }
  </style>
</head>
<body>
  <header><strong>Gitale</strong><span> · 本地只读故事产物</span></header>
  <div class="layout">
    <aside><h2>故事路线</h2><ul class="tree">${treeHtml}</ul>
      <p><span class="status status-candidate">candidate</span> 新生成</p>
      <p><span class="status status-accepted">accepted</span> 当前采用</p>
      <p><span class="status status-abandoned">abandoned</span> 保留但放弃</p>
    </aside>
    <main>${detailHtml}</main>
  </div>
  <script>
    (() => {
      const events = new EventSource("/events");
      events.addEventListener("workspace-change", () => window.location.reload());
    })();
  </script>
</body>
</html>`;
}

function renderTreeNode(
  node: ViewerTreeNode,
  children: Map<string | null, ViewerTreeNode[]>,
): string {
  const classes = ["node-link", `status-${node.status}`];
  if (node.isCurrentPath) classes.push("current-path");
  if (node.isSelected) classes.push("selected");
  const nested = (children.get(node.nodeId) ?? [])
    .map((child) => renderTreeNode(child, children))
    .join("");
  return `<li><a class="${classes.join(" ")}" href="/?node=${encodeURIComponent(node.nodeId)}">${escapeHtml(node.nodeId)} <small>${escapeHtml(node.status)}</small></a>${nested ? `<ul>${nested}</ul>` : ""}</li>`;
}

function renderNode(
  node: NonNullable<ViewerSnapshot["selectedNode"]>,
  snapshot: ViewerSnapshot,
): string {
  const selectedRevision = snapshot.selectedRevision;
  const revisionLabel =
    selectedRevision === null ? "" : ` · 修订 #${selectedRevision.revisionNumber}`;
  const historyHtml = renderRevisionHistory(node.nodeId, snapshot);
  return `<section class="story-artifact" data-node-id="${escapeHtml(node.nodeId)}">
    <p class="eyebrow">STORY ARTIFACT</p>
    <h2>故事正文${revisionLabel}</h2>
    <article class="story-content">${escapeHtml(node.storyContent)}</article>
    <dl class="node-details">
      <dt>创作意图</dt><dd>${escapeHtml(node.userIntent)}</dd>
      <dt>父节点</dt><dd>${escapeHtml(node.parentNodeId ?? "根节点")}</dd>
      <dt>状态</dt><dd><span class="status status-${escapeHtml(node.status)}">${escapeHtml(node.status)}</span></dd>
    </dl>
    <p>从此节点继续或 fork：</p>
    <code>${escapeHtml(snapshot.availableInstruction ?? "")}</code>
    ${historyHtml}
  </section>`;
}

function renderRevisionHistory(nodeId: string, snapshot: ViewerSnapshot): string {
  if (snapshot.revisionHistory.length === 0) return "";
  const entries = snapshot.revisionHistory
    .map((revision) => {
      const labels = [
        revision.isCurrent ? '<span class="revision-current">当前版本</span>' : "",
        snapshot.selectedRevision?.revisionNumber === revision.revisionNumber
          ? '<span class="revision-selected">正在查看</span>'
          : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return `<li><a href="/?node=${encodeURIComponent(nodeId)}&amp;revision=${revision.revisionNumber}">修订 #${revision.revisionNumber}</a> · ${escapeHtml(revision.createdAt)}${labels ? ` · ${labels}` : ""}</li>`;
    })
    .join("");
  return `<section class="revision-history" aria-label="修订历史"><h3>修订历史</h3><ol>${entries}</ol></section>`;
}

function renderEmptyState(): string {
  return `<section class="story-artifact empty"><h2>选择一个故事节点</h2><p>故事正文会显示在这里。</p></section>`;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character,
  );
}
