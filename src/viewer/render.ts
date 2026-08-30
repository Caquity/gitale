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
    body { display: flex; flex-direction: column; height: 100vh; margin: 0; overflow: hidden; background: #f6f3ed; color: #27251f; }
    header { flex: 0 0 auto; padding: 1.4rem 2rem; border-bottom: 1px solid #d8d0c2; background: #fffdf8; }
    .layout { display: grid; grid-template-columns: minmax(16rem, 24rem) minmax(0, 1fr); min-height: 0; flex: 1 1 auto; }
    aside { min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 1.5rem; border-right: 1px solid #d8d0c2; background: #faf8f2; }
    main { min-width: 0; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 2rem clamp(1.5rem, 5vw, 5rem); max-width: 55rem; }
    .tree, .tree ul { list-style: none; margin: 0; padding: 0; }
    .tree { padding-left: .2rem; }
    .tree ul { margin-left: .7rem; padding-left: 1.15rem; border-left: 2px solid #d8d0c2; }
    .tree li { position: relative; margin: .3rem 0; }
    .tree ul > li::before { content: ""; position: absolute; top: 1.05rem; left: -1.15rem; width: 1.05rem; border-top: 2px solid #d8d0c2; }
    .node-link { display: flex; align-items: center; gap: .5rem; min-width: 0; padding: .4rem .45rem; border-radius: .45rem; color: inherit; text-decoration: none; }
    .node-link:hover, .node-link:focus-visible { background: #f0e9da; outline: none; }
    .node-link.status-abandoned { opacity: .55; }
    .node-link.current-path { background: #f3ead4; }
    .node-link.selected { background: #e8d6ad; box-shadow: 0 0 0 1px #b8955a inset; }
    .graph-dot { flex: 0 0 auto; width: .7rem; height: .7rem; border: 2px solid #806a40; border-radius: 50%; background: #faf8f2; }
    .node-link.status-accepted .graph-dot { border-color: #4d6c50; background: #4d6c50; }
    .node-link.status-abandoned .graph-dot { border-color: #8c8274; background: #8c8274; }
    .node-link.status-candidate .graph-dot { border-style: dashed; }
    .node-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .node-link small { flex: 0 0 auto; margin-left: auto; color: #766e61; font-size: .72rem; }
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
    @media (max-width: 700px) { .layout { display: flex; flex-direction: column; } aside { flex: 0 0 38vh; border-right: 0; border-bottom: 1px solid #d8d0c2; } main { flex: 1 1 auto; } }
  </style>
</head>
<body>
  <header><strong>Gitale</strong><span> · 本地只读故事产物</span></header>
  <div class="layout">
    <aside id="story-sidebar"><h2>故事路线</h2><ul class="tree">${treeHtml}</ul>
      <p><span class="status status-candidate">candidate</span> 新生成</p>
      <p><span class="status status-accepted">accepted</span> 当前采用</p>
      <p><span class="status status-abandoned">abandoned</span> 保留但放弃</p>
    </aside>
    <main id="story-main">${detailHtml}</main>
  </div>
  <script>
    (() => {
      const sidebar = document.querySelector("#story-sidebar");

      const renderLocation = async (href, push) => {
        try {
          const response = await fetch(href, { headers: { Accept: "text/html" } });
          if (!response.ok) throw new Error("Viewer navigation failed");
          const nextDocument = new DOMParser().parseFromString(await response.text(), "text/html");
          const nextSidebar = nextDocument.querySelector("#story-sidebar");
          const nextMain = nextDocument.querySelector("#story-main");
          const currentMain = document.querySelector("#story-main");
          if (!sidebar || !nextSidebar || !nextMain || !currentMain) throw new Error("Viewer layout unavailable");
          const sidebarScrollTop = sidebar.scrollTop;
          sidebar.innerHTML = nextSidebar.innerHTML;
          sidebar.scrollTop = sidebarScrollTop;
          currentMain.replaceWith(nextMain);
          document.title = nextDocument.title;
          if (push) {
            const nextUrl = new URL(href, window.location.href);
            window.history.pushState({}, "", nextUrl.pathname + nextUrl.search);
          }
        } catch {
          window.location.assign(href);
        }
      };

      document.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
        if (!(target instanceof HTMLAnchorElement)) return;
        const nextUrl = new URL(target.href, window.location.href);
        if (nextUrl.origin !== window.location.origin || nextUrl.pathname !== "/") return;
        event.preventDefault();
        void renderLocation(nextUrl.href, true);
      });
      window.addEventListener("popstate", () => void renderLocation(window.location.href, false));
      const events = new EventSource("/events");
      events.addEventListener("workspace-change", () => void renderLocation(window.location.href, false));
      const selected = document.querySelector(".node-link.selected");
      if (selected && new URLSearchParams(window.location.search).has("node")) {
        requestAnimationFrame(() => selected.scrollIntoView({ block: "nearest" }));
      }
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
  return `<li><a class="${classes.join(" ")}" href="/?node=${encodeURIComponent(node.nodeId)}" data-node-id="${escapeHtml(node.nodeId)}" aria-label="查看节点 ${escapeHtml(node.nodeId)}"><span class="graph-dot" aria-hidden="true"></span><span class="node-label">${escapeHtml(node.title)}</span><small>${escapeHtml(node.status)}</small></a>${nested ? `<ul>${nested}</ul>` : ""}</li>`;
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
