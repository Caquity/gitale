import type { ViewerSnapshot, ViewerTreeNode } from "./read-model.js";

export function renderViewerHtml(snapshot: ViewerSnapshot): string {
  const treeHtml = renderWorktreeGraph(snapshot);
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
    .worktree-graph { --lane-width: 1.4rem; position: relative; margin-left: -.2rem; }
    .graph-lines { position: absolute; z-index: 1; inset: 0 auto auto 0; width: var(--graph-width, 0px); height: var(--graph-height, 0px); overflow: visible; pointer-events: none; }
    .graph-line { fill: none; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2.5; opacity: .84; }
    .graph-line.current { stroke-width: 3.5; opacity: 1; }
    .worktree-row { position: relative; min-height: 2.5rem; }
    .node-link { display: grid; grid-template-columns: calc(var(--lane-count) * var(--lane-width)) minmax(0, 1fr) auto; align-items: center; gap: .5rem; min-width: 0; padding: .4rem .45rem; border-radius: .45rem; color: inherit; text-decoration: none; background: transparent; }
    .node-link:hover, .node-link:focus-visible { outline: none; }
    .node-link:hover .node-label, .node-link:focus-visible .node-label { text-decoration: underline; text-decoration-color: #b8955a; text-underline-offset: .2rem; }
    .node-link.status-abandoned { opacity: .55; }
    .node-link.current-path .node-label { font-weight: 600; }
    .node-link.selected .node-label { font-weight: 700; text-decoration: underline; text-decoration-color: #b8955a; text-underline-offset: .2rem; }
    .graph-marker { position: relative; z-index: 2; display: flex; align-items: center; width: 100%; padding-left: calc(var(--lane-index) * var(--lane-width) + .35rem); }
    .graph-dot { flex: 0 0 auto; width: .7rem; height: .7rem; border: 2px solid var(--route-color); border-radius: 50%; background: #faf8f2; }
    .node-link.status-accepted .graph-dot { border-color: var(--route-color); background: var(--route-color); }
    .node-link.status-abandoned .graph-dot { border-color: #8c8274; border-style: dotted; background: transparent; }
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
    .copy-status { position: fixed; z-index: 10; pointer-events: none; padding: .42rem .72rem; border: 3px solid #36543a; border-radius: .4rem; background: #fffdf8; box-shadow: 0 .25rem .8rem rgb(39 37 31 / 28%); color: #29442d; font-size: .86rem; font-weight: 800; letter-spacing: .02em; animation: copy-status-fade 1s ease-out forwards; }
    @keyframes copy-status-fade { from { opacity: 1; } to { opacity: 0; } }
    @media (max-width: 700px) { .layout { display: flex; flex-direction: column; } aside { flex: 0 0 38vh; border-right: 0; border-bottom: 1px solid #d8d0c2; } main { flex: 1 1 auto; } }
  </style>
</head>
<body>
  <header><strong>Gitale</strong><span> · 本地只读故事产物</span></header>
  <div class="layout">
    <aside id="story-sidebar"><h2>故事路线</h2><div class="tree">${treeHtml}</div>
      <p><span class="status status-candidate">candidate</span> 新生成</p>
      <p><span class="status status-accepted">accepted</span> 当前采用</p>
      <p><span class="status status-abandoned">abandoned</span> 保留但放弃</p>
    </aside>
    <main id="story-main">${detailHtml}</main>
  </div>
  <script>
    (() => {
      const sidebar = document.querySelector("#story-sidebar");
      let graphObserver = null;
      let copyStatusTimer = null;
      let latestCopyRequest = 0;

      const drawWorktreeGraph = () => {
        if (graphObserver !== null) graphObserver.disconnect();
        const graph = document.querySelector(".worktree-graph");
        if (!(graph instanceof HTMLElement)) return;
        const rows = [...graph.querySelectorAll(".worktree-row")];
        const svg = graph.querySelector(".graph-lines");
        if (!(svg instanceof SVGElement) || rows.length === 0) {
          if (svg instanceof SVGElement) svg.setAttribute("display", "none");
          return;
        }
        const graphRect = graph.getBoundingClientRect();
        const firstMarker = rows[0]?.querySelector(".graph-marker");
        if (!(firstMarker instanceof HTMLElement)) return;
        const markerRect = firstMarker.getBoundingClientRect();
        const graphWidth = markerRect.right - graphRect.left;
        const graphHeight = graph.scrollHeight;
        graph.style.setProperty("--graph-width", graphWidth + "px");
        graph.style.setProperty("--graph-height", graphHeight + "px");
        svg.setAttribute("viewBox", "0 0 " + graphWidth + " " + graphHeight);
        svg.setAttribute("width", graphWidth.toString());
        svg.setAttribute("height", graphHeight.toString());
        svg.removeAttribute("display");
        const points = rows.map((row) => {
          const dot = row.querySelector(".graph-dot");
          const dotRect = dot?.getBoundingClientRect();
          if (dotRect === undefined) return null;
          return {
            x: dotRect.left + dotRect.width / 2 - graphRect.left,
            y: dotRect.top + dotRect.height / 2 - graphRect.top,
            laneIndex: Number(row.getAttribute("data-lane-index") ?? 0),
            routeColor: row.getAttribute("data-route-color") ?? "#68727A",
            parentRowIndex: Number(row.getAttribute("data-parent-row-index") ?? -1),
            isCurrentPath: row.classList.contains("current-path"),
          };
        });
        if (points.some((point) => point === null)) return;
        const paths = [];
        points.forEach((point, index) => {
          if (point === null || point.parentRowIndex < 0) return;
          const parent = points[point.parentRowIndex];
          if (parent === null || parent === undefined) return;
          const path =
            parent.x === point.x
              ? "M " + parent.x + " " + parent.y + " L " + point.x + " " + point.y
              : "M " + parent.x + " " + parent.y + " L " + point.x + " " + parent.y + " L " + point.x + " " + point.y;
          const current = point.isCurrentPath && parent.isCurrentPath;
          paths.push({
            path,
            color: point.routeColor,
            current,
            laneIndex: point.laneIndex,
            index,
          });
        });
        paths.sort((left, right) => right.laneIndex - left.laneIndex);
        svg.innerHTML = paths
          .map(
            ({ path, color, current }) =>
              '<path class="graph-line' +
                (current ? " current" : "") +
                '" stroke="' +
                color +
                '" d="' +
                path +
                '"></path>',
          )
          .join("");
        if (typeof ResizeObserver !== "undefined") {
          graphObserver = new ResizeObserver(() => drawWorktreeGraph());
          graphObserver.observe(graph);
        }
      };

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
          drawWorktreeGraph();
          if (push) {
            const nextUrl = new URL(href, window.location.href);
            window.history.pushState({}, "", nextUrl.pathname + nextUrl.search);
          }
        } catch {
          window.location.assign(href);
        }
      };

      const copyNodeId = async (nodeId) => {
        try {
          if (typeof navigator.clipboard?.writeText === "function") {
            try {
              await navigator.clipboard.writeText(nodeId);
              return true;
            } catch {
              // Try the compatibility path below when Clipboard API is unavailable or rejected.
            }
          }
          if (typeof document.execCommand !== "function") return false;
          const copyField = document.createElement("text" + "area");
          copyField.value = nodeId;
          copyField.setAttribute("readonly", "");
          copyField.setAttribute("aria-hidden", "true");
          copyField.style.position = "fixed";
          copyField.style.left = "-9999px";
          document.body.append(copyField);
          copyField.focus();
          copyField.select();
          let copied = false;
          try {
            copied = document.execCommand("copy");
          } catch {
            copied = false;
          }
          copyField.remove();
          return copied;
        } catch {
          return false;
        }
      };

      const showCopyStatus = (message, clientX, clientY) => {
        if (copyStatusTimer !== null) {
          window.clearTimeout(copyStatusTimer);
          copyStatusTimer = null;
        }
        const previous = document.querySelector(".copy-status");
        if (previous instanceof HTMLElement) previous.remove();
        const status = document.createElement("div");
        status.className = "copy-status";
        status.setAttribute("role", "status");
        status.setAttribute("aria-live", "polite");
        status.textContent = message;
        const maxLeft = Math.max(8, window.innerWidth - 160);
        const maxTop = Math.max(8, window.innerHeight - 40);
        status.style.left = Math.min(Math.max(clientX + 12, 8), maxLeft) + "px";
        status.style.top = Math.min(Math.max(clientY + 12, 8), maxTop) + "px";
        document.body.append(status);
        copyStatusTimer = window.setTimeout(() => {
          status.remove();
          copyStatusTimer = null;
        }, 1000);
      };

      document.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
        if (!(target instanceof HTMLAnchorElement)) return;
        const nextUrl = new URL(target.href, window.location.href);
        if (nextUrl.origin !== window.location.origin || nextUrl.pathname !== "/") return;
        event.preventDefault();
        const nodeId = target.dataset.nodeId;
        if (target.matches(".node-link[data-node-id]") && nodeId !== undefined) {
          const copyRequest = ++latestCopyRequest;
          void copyNodeId(nodeId).then((copied) => {
            if (copyRequest !== latestCopyRequest) return;
            showCopyStatus(copied ? "ID copied" : "ID copy failed", event.clientX, event.clientY);
          });
        }
        void renderLocation(nextUrl.href, true);
      });
      window.addEventListener("popstate", () => void renderLocation(window.location.href, false));
      const events = new EventSource("/events");
      events.addEventListener("workspace-change", () => void renderLocation(window.location.href, false));
      drawWorktreeGraph();
      const selected = document.querySelector(".node-link.selected");
      if (selected && new URLSearchParams(window.location.search).has("node")) {
        requestAnimationFrame(() => selected.scrollIntoView({ block: "nearest" }));
      }
    })();
  </script>
</body>
</html>`;
}

interface GraphRow {
  readonly node: ViewerTreeNode;
  readonly laneIndex: number;
  readonly routeKey: string;
  readonly parentRowIndex: number | null;
}

const graphPalette = ["#2f6f73", "#a35c24", "#4f6295", "#6f537d", "#52703f"] as const;
const sharedGraphColor = "#777065";

function renderWorktreeGraph(snapshot: ViewerSnapshot): string {
  const children = new Map<string | null, ViewerTreeNode[]>();
  for (const node of snapshot.tree) {
    const siblings = children.get(node.parentNodeId) ?? [];
    siblings.push(node);
    children.set(node.parentNodeId, siblings);
  }
  const rows: GraphRow[] = [];
  let nextLaneIndex = 0;
  const visit = (
    node: ViewerTreeNode,
    laneIndex: number,
    routeKey: string,
    parentRowIndex: number | null,
  ): void => {
    rows.push({ node, laneIndex, routeKey, parentRowIndex });
    const rowIndex = rows.length - 1;
    const siblings = children.get(node.nodeId) ?? [];
    siblings.forEach((child, childIndex) => {
      const childLaneIndex = siblings.length > 1 && childIndex > 0 ? nextLaneIndex++ : laneIndex;
      const childRouteKey = siblings.length > 1 ? `${node.nodeId}:${child.nodeId}` : routeKey;
      visit(child, childLaneIndex, childRouteKey, rowIndex);
    });
  };
  for (const root of children.get(null) ?? []) {
    const rootLaneIndex = nextLaneIndex++;
    visit(root, rootLaneIndex, rootLaneIndex === 0 ? "shared" : `root:${root.nodeId}`, null);
  }

  const routeKeys = [...new Set(rows.map((row) => row.routeKey))];
  let branchColorIndex = 0;
  const routeColor = new Map(
    routeKeys.map((key) => {
      const color =
        key === "shared"
          ? sharedGraphColor
          : graphPalette[branchColorIndex++ % graphPalette.length];
      return [key, color] as const;
    }),
  );
  const laneCount = Math.max(1, nextLaneIndex);
  const rowHtml = rows
    .map((row, rowIndex) => {
      const classes = ["node-link", `status-${row.node.status}`];
      if (row.node.isCurrentPath) classes.push("current-path");
      if (row.node.isSelected) classes.push("selected");
      return `<div class="worktree-row" data-row-index="${rowIndex}" data-parent-row-index="${row.parentRowIndex ?? -1}" data-lane-index="${row.laneIndex}" data-route-color="${escapeHtml(routeColor.get(row.routeKey) ?? sharedGraphColor)}"><a class="${classes.join(" ")}" style="--lane-count:${laneCount};--lane-index:${row.laneIndex};--route-color:${routeColor.get(row.routeKey)}" href="/?node=${encodeURIComponent(row.node.nodeId)}" data-node-id="${escapeHtml(row.node.nodeId)}" aria-label="查看节点 ${escapeHtml(row.node.nodeId)}，状态 ${escapeHtml(row.node.status)}"><span class="graph-marker"><span class="graph-dot" aria-hidden="true"></span></span><span class="node-label">${escapeHtml(row.node.title)}</span></a></div>`;
    })
    .join("");
  return `<div class="worktree-graph" style="--lane-count:${laneCount};--row-count:${rows.length}"><svg class="graph-lines" aria-hidden="true"></svg>${rowHtml}</div>`;
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
