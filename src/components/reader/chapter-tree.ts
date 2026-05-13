export interface ChapterTreeSource {
  id: string
  title: string
  position: number
  level?: number
  isReadable?: boolean
  firstReadableDescendantId?: string | null
}

export interface ChapterTreeNode extends ChapterTreeSource {
  children: ChapterTreeNode[]
  isContainer: boolean
  firstReadableDescendantId: string | null
}

/**
 * Builds a nested chapter tree from a flat, level-ordered chapter list.
 *
 * Sections with content remain readable. Empty structural headings become
 * containers and point at their first readable descendant when available.
 *
 * @param chapters Flat chapter list ordered by position.
 * @returns Nested tree preserving the original order.
 */
export function buildChapterTree(chapters: ChapterTreeSource[]): ChapterTreeNode[] {
  const roots: ChapterTreeNode[] = []
  const stack: ChapterTreeNode[] = []

  for (const chapter of chapters) {
    const node: ChapterTreeNode = {
      ...chapter,
      children: [],
      isContainer: chapter.isReadable === false,
      firstReadableDescendantId: null,
    }

    const level = Math.max(1, chapter.level ?? 1)
    node.level = level

    while (stack.length > 0 && (stack[stack.length - 1].level ?? 1) >= level) {
      stack.pop()
    }

    const parent = stack[stack.length - 1] || null
    if (parent) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }

    stack.push(node)
  }

  annotateFirstReadableDescendants(roots)
  return roots
}

/**
 * Resolves the first readable section for a chapter id.
 *
 * Containers are mapped to the first readable descendant in their subtree.
 * Readable chapters resolve to themselves.
 *
 * @param chapters Flat chapter list ordered by position.
 * @param chapterId Target chapter id.
 * @returns Readable chapter id or null when the target has no readable section.
 */
export function resolveReadableChapterId(
  chapters: ChapterTreeSource[],
  chapterId: string,
): string | null {
  const tree = buildChapterTree(chapters)
  const lookup = new Map<string, ChapterTreeNode>()
  indexTree(tree, lookup)
  return lookup.get(chapterId)?.firstReadableDescendantId ?? null
}

function annotateFirstReadableDescendants(nodes: ChapterTreeNode[]): string | null {
  let firstReadableDescendantId: string | null = null

  for (const node of nodes) {
    const childReadableId = annotateFirstReadableDescendants(node.children)
    node.firstReadableDescendantId = node.isContainer ? childReadableId : node.id

    if (!firstReadableDescendantId && node.firstReadableDescendantId) {
      firstReadableDescendantId = node.firstReadableDescendantId
    }
  }

  return firstReadableDescendantId
}

function indexTree(nodes: ChapterTreeNode[], lookup: Map<string, ChapterTreeNode>): void {
  for (const node of nodes) {
    lookup.set(node.id, node)
    indexTree(node.children, lookup)
  }
}
