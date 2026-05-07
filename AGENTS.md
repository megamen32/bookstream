# Bookstore UI / Product Direction

Bookstore is a modern interactive reading platform.

It should feel closer to Apple TV for books than to a traditional online library.

The browsing experience should be visual, focused, premium, and calm:
one active section at a time, strong hierarchy, beautiful covers, compact previews, smooth transitions, and no noisy catalogue-like grids.

Bookstore is not an old e-library, CMS, PDF viewer, admin panel, or catalogue.
The core experience is Social features. Сalm reading are a secondary layer.

## Product idea

A book is not just a file. It is a living reading space where users can:

- read comfortably;
- switch between text versions;
- select fragments;
- save quotes;
- react to selected text;
- comment on chapters or exact fragments;
- see other readers' comments, quotes, and reactions.

Reading must always stay the main action.

## Core UX principles

1. **Text first**
   The book content is the center. Interface elements must not compete with reading.

2. **Quiet interface**
   Controls should appear only when needed: on selection, tap/click, hover, or explicit menu action.

3. **Two reading modes**
   - Book mode: page-like reading with horizontal page switching.
   - Feed mode: Telegra.ph-like vertical scrolling.

   Do not overcomplicate the difference. The main distinction is navigation direction.

4. **Contextual social layer**
   Quotes, comments, and reactions should be attached to text fragments or chapters.
   They should feel like a layer over the book, not like a noisy social network.

5. **Minimal but polished**
   Minimalism must not mean empty or generic. The UI should feel modern, premium, readable, and alive.

## Design direction

Use a dark-theme-friendly, modern visual style:

- graphite / black surfaces;
- purple and green accents;
- clean typography;
- generous spacing;
- soft shadows or subtle blur where useful;
- smooth but restrained animation.

Avoid:

- beige old-library clichés;
- Bootstrap/dashboard feeling;
- noisy sidebars;
- always-open heavy panels;
- too many borders;
- crowded toolbars;
- decorative animations that distract from reading.

## Reader behavior

The reader should:

- keep text centered with comfortable line width;
- hide controls while reading;
- show controls through a floating button, center tap/click, or compact overlay;
- support version switching;
- support font/theme/settings controls without covering the text.

## Text selection

Text selection is important.

A selected range may span multiple paragraphs.
Do not collapse it into one paragraph.
Preserve exact start/end positions.

After selection, show contextual actions:

- quote;
- comment;
- react;
- copy/share.

When a user reacts, comments, or quotes, give local visual feedback:
a subtle highlight, marker, or small emoji animation.

## Comments and activity

Support two comment types:

- chapter-level comments;
- fragment-level comments linked to selected text.

At the end of a chapter, comment input should feel lightweight, like Telegram input.

The user should have an activity panel with filters:

- all;
- quotes;
- comments;
- reactions.

This panel is a memory layer, not the main reading UI.

## Component structure

Keep reader UI split into clear components.

Prefer components like:

- `Reader`
- `BookReader`
- `FeedReader`
- `ReaderControls`
- `SelectionToolbar`
- `ActivityPanel`
- `CommentInput`
- `VersionSwitcher`

Avoid one huge page component with all reader logic inside.

## Implementation rule

Prefer simple, stable, readable solutions.

Do not over-engineer.
Do not add impressive-looking features that make reading worse.
Polish the main reading experience first.