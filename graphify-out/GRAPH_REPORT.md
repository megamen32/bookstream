# Graph Report - .  (2026-08-23)

## Corpus Check
- 306 files · ~426,360 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1968 nodes · 4543 edges · 178 communities (93 shown, 85 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.65)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Code module 0
- Code module 1
- Code module 2
- Code module 3
- Code module 4
- Code module 5
- Code module 6
- Code module 7
- Code module 8
- Code module 9
- Code module 10
- Code module 11
- Code module 12
- Code module 13
- Code module 14
- Code module 15
- Code module 16
- Code module 17
- Code module 18
- Code module 19
- Code module 20
- Code module 21
- Code module 22
- Code module 23
- Code module 24
- Code module 25
- Code module 26
- Code module 27
- Code module 28
- Code module 29
- Code module 30
- Code module 31
- Code module 32
- Code module 33
- Code module 34
- Code module 35
- Code module 36
- Code module 37
- Code module 38
- Code module 39
- Code module 40
- Code module 41
- Code module 42
- Code module 43
- Code module 44
- Code module 45
- Code module 46
- Code module 47
- Code module 48
- Code module 49
- Code module 50
- Code module 51
- Code module 52
- Code module 53
- Code module 54
- Code module 55
- Code module 56
- Code module 57
- Code module 58
- Code module 59
- Code module 60
- Code module 61
- Code module 62
- Code module 63
- Code module 64
- Code module 65
- Code module 66
- Code module 67
- Code module 68
- Code module 69
- Code module 70
- Code module 71
- Code module 72
- Code module 73
- Code module 74
- Code module 75
- Code module 76
- Code module 77
- Code module 78
- Code module 79
- Code module 80
- Code module 81
- Code module 82
- Code module 83
- Code module 84
- Code module 85
- Code module 87
- Code module 88
- Code module 89
- Code module 90
- Code module 91
- Code module 92
- Code module 93
- Code module 94
- Code module 95
- Code module 96
- Code module 97
- Code module 98
- Code module 99
- Code module 100
- Code module 101
- Code module 102
- Code module 103
- Code module 104
- Code module 105
- Code module 106
- Code module 107
- Code module 108
- Code module 109
- Code module 110
- Code module 111
- Code module 112
- Code module 113
- Code module 114
- Code module 115
- Code module 116
- Code module 117
- Code module 118
- Code module 119
- Code module 120
- Code module 121
- Code module 122
- Code module 123
- Code module 124
- Code module 125
- Code module 126
- Code module 127
- Code module 128
- Code module 129
- Code module 130
- Code module 131
- Code module 132
- Code module 133
- Code module 134
- Code module 135
- Code module 136
- Code module 137
- Code module 138
- Code module 139
- Code module 140
- Code module 141
- Code module 142
- Code module 143
- Code module 144
- Code module 145
- Code module 146
- Code module 147
- Code module 148
- Code module 149
- Code module 150
- Code module 151
- Code module 152
- Code module 153
- Code module 154
- Code module 155
- Code module 156
- Code module 157
- Code module 158
- Code module 159
- Code module 160
- Code module 161
- Code module 162
- Code module 163
- Code module 164
- Code module 165
- Code module 166
- Code module 173
- Code module 174

## God Nodes (most connected - your core abstractions)
1. `cn()` - 257 edges
2. `getAdminSessionReader()` - 55 edges
3. `useReaderStore` - 40 edges
4. `Button()` - 30 edges
5. `sortCommentsByTop()` - 29 edges
6. `useToast()` - 27 edges
7. `ReaderComment` - 25 edges
8. `buildQuoteReadHref()` - 24 edges
9. `splitImportedHtmlIntoSections()` - 23 edges
10. `ReaderPage()` - 22 edges

## Surprising Connections (you probably didn't know these)
- `AdminLinkDeviceCard()` --references--> `qrcode`  [EXTRACTED]
  src/components/admin/AdminLinkDeviceCard.tsx → package.json
- `Carousel()` --references--> `react`  [EXTRACTED]
  src/components/ui/carousel.tsx → package.json
- `useCarousel()` --references--> `react`  [EXTRACTED]
  src/components/ui/carousel.tsx → package.json
- `FormItem()` --references--> `react`  [EXTRACTED]
  src/components/ui/form.tsx → package.json
- `useFormField()` --references--> `react`  [EXTRACTED]
  src/components/ui/form.tsx → package.json

## Import Cycles
- None detected.

## Communities (178 total, 85 thin omitted)

### Community 0 - "Code module 0"
Cohesion: 0.05
Nodes (100): Author, Book, BookCoverPage(), Chapter, copyTextToClipboard(), formatChapterLabel(), formatDurationLabel(), PublicBookStats (+92 more)

### Community 1 - "Code module 1"
Cohesion: 0.07
Nodes (54): POST(), buildImageCandidates(), buildImportedBookPreview(), BuildImportedBookPreviewOptions, buildMetadataExcerpt(), cleanupQuotedMetadata(), collapseWhitespace(), coverCandidateScore() (+46 more)

### Community 2 - "Code module 2"
Cohesion: 0.06
Nodes (38): AccordionContent(), AccordionItem(), AccordionTrigger(), AlertDialogOverlay(), Avatar(), AvatarFallback(), AvatarImage(), BreadcrumbEllipsis() (+30 more)

### Community 3 - "Code module 3"
Cohesion: 0.09
Nodes (42): POST(), PreparedChapterEngagement, RouteParams, POST(), ReaderLlmMutationBody, GET(), POST(), ReaderMutationBody (+34 more)

### Community 4 - "Code module 4"
Cohesion: 0.08
Nodes (40): buildBibliographyItemsByNumber(), GET(), mapReaderAnnotation(), mapServerProgress(), RouteParams, BookData, ReaderChapterListItem, ReaderParagraph (+32 more)

### Community 5 - "Code module 5"
Cohesion: 0.10
Nodes (32): AdminLoginPage(), BookRoutingData, Comment, CommentsPage(), filters, FilterStatus, AdminLibraryPage(), Book (+24 more)

### Community 6 - "Code module 6"
Cohesion: 0.05
Nodes (40): bun-types, eslint, eslint-config-next, devDependencies, bun-types, eslint, eslint-config-next, @playwright/test (+32 more)

### Community 7 - "Code module 7"
Cohesion: 0.08
Nodes (36): AdminSidebarNav(), MobileSidebarTrigger(), navItems, SidebarNavProps, Separator(), Sidebar(), SidebarContent(), SidebarContext (+28 more)

### Community 8 - "Code module 8"
Cohesion: 0.10
Nodes (33): AnnotationUpdateDetail, buildReplyQuote(), ChapterAfterword(), ChapterAfterwordProps, ChapterQuote, dedupeComments(), dedupeQuotes(), formatCount() (+25 more)

### Community 9 - "Code module 9"
Cohesion: 0.12
Nodes (33): GET(), POST(), AnnotationAnchorStatus, assignParagraphStableKeys(), buildChapterTextIndex(), buildNewStableKey(), buildStaleAnchor(), buildTrigrams() (+25 more)

### Community 10 - "Code module 10"
Cohesion: 0.10
Nodes (25): buildAfterwordComments(), FeedResponse, loadBookmarks(), mergeSections(), prependUniqueComment(), ReaderPage(), RestoreRequest, saveBookmarks() (+17 more)

### Community 11 - "Code module 11"
Cohesion: 0.13
Nodes (34): ALLOWED_ATTRS, ALLOWED_TAGS, appendLeadingSection(), assignSectionMetadata(), BLOCK_UNWRAP_TAGS, buildSectionAnchorHtml(), collapseWhitespace(), createNormalizationContext() (+26 more)

### Community 12 - "Code module 12"
Cohesion: 0.16
Nodes (20): Message, User, AdminLinkDevicePageContent(), normalizeLinkCode(), AdminSettingsPayload, Author, ReaderMetaResponse, AdminLinkCodePayload (+12 more)

### Community 13 - "Code module 13"
Cohesion: 0.09
Nodes (27): AnnotationPopover(), AnnotationPopoverProps, clamp(), estimateChapterHeight(), EstimateChapterHeightInput, ChapterSkeleton(), ChapterSkeletonProps, BookChapterManifestItem (+19 more)

### Community 14 - "Code module 14"
Cohesion: 0.11
Nodes (26): @prisma/client, @prisma/client, buildLegacyCommentAnnotationId(), buildLegacyQuoteAnnotationId(), loadVariantIdsByChapterAndType(), migrateLegacyComments(), normalizeText(), prisma (+18 more)

### Community 15 - "Code module 15"
Cohesion: 0.11
Nodes (25): AdminSettingsPayload, AdminUploadPage(), BOOK_ACCEPTED_EXTENSIONS, buildBookPreviewPath(), COVER_ACCEPTED_EXTENSIONS, COVER_ACCEPTED_MIME_TYPES, formatFileSize(), getExtension() (+17 more)

### Community 16 - "Code module 16"
Cohesion: 0.07
Nodes (29): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+21 more)

### Community 17 - "Code module 17"
Cohesion: 0.12
Nodes (18): ProtectedAdminLayout(), POST(), POST(), AdminShell(), AdminSessionReader, createAdminSessionValue(), getAdminSessionCookieOptions(), getAdminSessionReaderFromValue() (+10 more)

### Community 18 - "Code module 18"
Cohesion: 0.11
Nodes (23): BookTextEditorProps, EditorSaveStatus, EditorToolbarProps, ALLOWED_ATTRIBUTES, ALLOWED_TAGS, getSaveStatusLabel(), MATH_SYMBOL_GROUPS, sanitizeEditorHtml() (+15 more)

### Community 19 - "Code module 19"
Cohesion: 0.10
Nodes (23): AdminSettingsPayload, BookData, BookEditorPage(), BookStatsResponse, buildVariantTabs(), Chapter, ChapterStatsSummary, ChapterVariant (+15 more)

### Community 20 - "Code module 20"
Cohesion: 0.16
Nodes (26): normalizeShareText(), truncateShareText(), BOOK_CARD_DIMENSIONS, buildBackgroundStyle(), buildBookShareSvg(), buildCoverImageMarkup(), buildMomentShareSvg(), buildShareBackground() (+18 more)

### Community 21 - "Code module 21"
Cohesion: 0.14
Nodes (23): extractImageUrlsFromSection(), preloadSectionImages(), FeedPreviewStats, FeedPreviewTopQuote, FeedSectionData, buildChapterPreloadQueue(), ChapterLoaderState, createIdleScheduler() (+15 more)

### Community 22 - "Code module 22"
Cohesion: 0.17
Nodes (20): buildBibliographyItemsByNumber(), GET(), getDraftAccessReaderId(), normalizeWindowParam(), RouteParams, buildBibliographyItemsByNumber(), canViewDrafts(), GET() (+12 more)

### Community 23 - "Code module 23"
Cohesion: 0.12
Nodes (22): Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle, toastVariants (+14 more)

### Community 24 - "Code module 24"
Cohesion: 0.11
Nodes (18): react, react, Calendar(), CalendarDayButton(), ChartConfig, ChartContainer(), ChartContext, ChartContextProps (+10 more)

### Community 25 - "Code module 25"
Cohesion: 0.22
Nodes (16): POST(), generateMetadata(), loadMoment(), PublicMomentPage(), PublicMomentPageProps, LegacyPublicMomentPage(), LegacyPublicMomentPageProps, LegacyPublicBookPage() (+8 more)

### Community 26 - "Code module 26"
Cohesion: 0.13
Nodes (22): buildCommentBody(), buildParagraphTargets(), buildQuoteText(), cleanupMistakenDemoBooks(), clearSeedData(), deleteBookGraph(), DEMO_BOOK_SLUGS, loadCurrentBooks() (+14 more)

### Community 27 - "Code module 27"
Cohesion: 0.16
Nodes (19): books, importBook(), COVER_ACCEPTED_EXTENSIONS, COVER_ACCEPTED_MIME_TYPES, getFileExtension(), isAcceptedCoverFile(), PUT(), COVER_ACCEPTED_EXTENSIONS (+11 more)

### Community 28 - "Code module 28"
Cohesion: 0.15
Nodes (15): DELETE(), RouteParams, GET(), GET(), POST(), PUT(), DELETE(), PUT() (+7 more)

### Community 29 - "Code module 29"
Cohesion: 0.13
Nodes (17): AnnotationResponseItem, StoredSelectionAnnotationRange, clamp(), copyToClipboard(), EMOJI_PICKER_GROUPS, ReactionBurst, SelectionAnnotationRange, TextSelector() (+9 more)

### Community 30 - "Code module 30"
Cohesion: 0.17
Nodes (18): collapseWhitespace(), decodeHtmlEntities(), escapeHtml(), extractBlockFormatting(), extractImageAltText(), extractImportedSectionAnchors(), generateStableKey(), hasReadableMediaHtml() (+10 more)

### Community 31 - "Code module 31"
Cohesion: 0.10
Nodes (21): next, next-auth, next-intl, dependencies, next, next-auth, next-intl, @radix-ui/react-menubar (+13 more)

### Community 32 - "Code module 32"
Cohesion: 0.12
Nodes (15): CornerButtonProps, MODE_LABELS, QuickActionProps, ReaderChromeOverlay, ReaderChromeProps, VariantPresetMeta, ReaderVariantsPanelProps, BUILTIN_INFO (+7 more)

### Community 33 - "Code module 33"
Cohesion: 0.12
Nodes (15): Command(), CommandDialog(), CommandGroup(), CommandInput(), CommandItem(), CommandList(), CommandSeparator(), CommandShortcut() (+7 more)

### Community 34 - "Code module 34"
Cohesion: 0.14
Nodes (17): buildDocxImportOptions(), DOCX_ALIGNMENT_STYLE_MAP, ImportedDocxIndent, ImportedDocxParagraph, MammothOptions, MammothWithTransforms, normalizeStyleMap(), resolveAlignmentStyleId() (+9 more)

### Community 35 - "Code module 35"
Cohesion: 0.18
Nodes (15): BookReader(), BookReaderProps, PageParagraphBlock, Paragraph, PointerGestureState, ReaderPage, PageAnnotations(), PageAnnotationsProps (+7 more)

### Community 36 - "Code module 36"
Cohesion: 0.12
Nodes (13): Chapter, ChapterNavigationProps, DropdownMenu(), DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem() (+5 more)

### Community 37 - "Code module 37"
Cohesion: 0.13
Nodes (7): GET(), PUT(), RouteParams, getAppSettings(), ResolvedAppSettings, updateAppSettings(), globalForPrisma

### Community 38 - "Code module 38"
Cohesion: 0.13
Nodes (17): AnnotationAnchorStatus, annotationBadgeLabel(), AnnotationChapterLike, AnnotationCommentItem, AnnotationCommentRowLike, AnnotationLike, AnnotationQuoteItem, AnnotationQuoteRowLike (+9 more)

### Community 39 - "Code module 39"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 40 - "Code module 40"
Cohesion: 0.22
Nodes (15): GET(), loadAnnotations(), mapAnnotationRow(), POST(), POST(), POST(), GET(), GroupedReaction (+7 more)

### Community 41 - "Code module 41"
Cohesion: 0.19
Nodes (14): DELETE(), estimateTextLengthFromHtml(), GET(), getDraftAccessReaderId(), PUT(), BookUpdateValidationError, buildBookUpdateData(), BuildBookUpdateDataOptions (+6 more)

### Community 42 - "Code module 42"
Cohesion: 0.15
Nodes (14): UserSettingsPage(), CommentComposer(), CommentComposerProps, VARIANT_CLASSES, VARIANT_LABELS, createEmptyReactions(), DEFAULT_EMOJIS, ReactionBar() (+6 more)

### Community 43 - "Code module 43"
Cohesion: 0.18
Nodes (11): CommentList(), CommentListProps, VariantPresetMeta, Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader() (+3 more)

### Community 44 - "Code module 44"
Cohesion: 0.25
Nodes (16): BIBLIOGRAPHY_HEADINGS, BlockSegment, dedupeItems(), detectBibliography(), DetectedSection, extractBibliographyItems(), extractBlockSegments(), extractId() (+8 more)

### Community 45 - "Code module 45"
Cohesion: 0.21
Nodes (15): createMarkerSpan(), escapeAttribute(), extractBibliographicMarkerNumbers(), extractId(), findFirstBibliographyItemBlockIndex(), HtmlTokenContext, isBibliographyMarkerSpan(), SKIPPED_TAGS (+7 more)

### Community 46 - "Code module 46"
Cohesion: 0.17
Nodes (14): AnnotationFeedCard(), AnnotationFilter, BookLookupItem, BookSummary, buildAnnotationHref(), FILTERS, timeAgo(), truncate() (+6 more)

### Community 47 - "Code module 47"
Cohesion: 0.20
Nodes (11): Author, Book, formatChapterLabel(), HomePage(), BookQuote, BookQuotesPanel(), BookQuotesPanelProps, sortQuotes() (+3 more)

### Community 48 - "Code module 48"
Cohesion: 0.21
Nodes (15): ActivityKind, AnnotationCard(), formatVariantLabel(), kindAccent(), kindIcon(), kindLabel(), kindToTab(), renderAnnotationLink() (+7 more)

### Community 49 - "Code module 49"
Cohesion: 0.12
Nodes (9): ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut(), ContextMenuSubContent() (+1 more)

### Community 50 - "Code module 50"
Cohesion: 0.17
Nodes (13): SettingsPanel(), SettingsPanelProps, THEME_ICONS, WIDTH_LABELS, AccentTheme, LineWidth, ReaderTheme, AccentThemeConfig (+5 more)

### Community 51 - "Code module 51"
Cohesion: 0.37
Nodes (10): ConsumeLinkCodeBody, POST(), AdminLinkCodeResponse, POST(), createAdminLinkCode(), createAdminLinkCodeExpiry(), formatAdminLinkCode(), hashAdminLinkCode() (+2 more)

### Community 52 - "Code module 52"
Cohesion: 0.19
Nodes (10): CreateMomentBody, RouteParams, BookMomentValidationError, createBookMoment(), CreateBookMomentInput, PublicBookAuthor, PublicBookMomentRecord, PublicBookRecord (+2 more)

### Community 53 - "Code module 53"
Cohesion: 0.22
Nodes (10): BookRouteLayoutProps, generateMetadata(), loadBook(), PublicBookImage(), PublicBookImageProps, LegacyPublicBookImage(), LegacyPublicBookImageProps, getPublicBookBySlugs() (+2 more)

### Community 54 - "Code module 54"
Cohesion: 0.20
Nodes (13): Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext(), CarouselOptions (+5 more)

### Community 55 - "Code module 55"
Cohesion: 0.23
Nodes (10): GET(), GET(), POST(), GET(), mapAnnotationComment(), mapAnnotationQuote(), normalizeAnchorStatus(), sortItemsByCreatedAt() (+2 more)

### Community 56 - "Code module 56"
Cohesion: 0.27
Nodes (9): GET(), getDraftAccessReaderId(), POST(), POST(), SetReaderPasswordBody, buildOwnedBookWhere(), ensureReaderAuthorProfile(), generateUniqueAuthorSlug() (+1 more)

### Community 57 - "Code module 57"
Cohesion: 0.30
Nodes (10): annotateFirstReadableDescendants(), buildChapterTree(), ChapterTreeNode, ChapterTreeSource, indexTree(), resolveReadableChapterId(), Chapter, renderChapterTree() (+2 more)

### Community 58 - "Code module 58"
Cohesion: 0.23
Nodes (10): FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext, FormItemContextValue, FormLabel() (+2 more)

### Community 59 - "Code module 59"
Cohesion: 0.29
Nodes (9): CreateChapterBody, GET(), getDefaultChapterTitle(), POST(), GET(), getOwnedBook(), formatPercent(), getAdminBookStats() (+1 more)

### Community 60 - "Code module 60"
Cohesion: 0.31
Nodes (8): geistMono, geistSans, metadata, RootLayout(), Toaster(), getOgLogoUrl(), buildAbsoluteUrl(), getSiteUrl()

### Community 61 - "Code module 61"
Cohesion: 0.36
Nodes (7): GET(), isFileNotFoundError(), isSafeCoverFileName(), resolveCoverDirectories(), resolveCoverPublicDirectories(), resolveProjectRootFromDatabaseUrl(), ORIGINAL_CWD

### Community 62 - "Code module 62"
Cohesion: 0.25
Nodes (9): clampParagraphStyle(), CommentCard(), CommentCardComment, CommentCardProps, formatRelativeDate(), stringToColor(), VARIANT_LABELS, CommentVoteButton() (+1 more)

### Community 63 - "Code module 63"
Cohesion: 0.22
Nodes (10): BookTextEditor(), ShortcutEvent, Table(), TableBody(), TableCaption(), TableCell(), TableFooter(), TableHead() (+2 more)

### Community 64 - "Code module 64"
Cohesion: 0.33
Nodes (7): formatVariantLabel(), GET(), QuotePayload, RouteParams, GET(), sortQuotesByTop(), limitSyntheticItems()

### Community 65 - "Code module 65"
Cohesion: 0.22
Nodes (9): NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger(), navigationMenuTriggerStyle (+1 more)

### Community 66 - "Code module 66"
Cohesion: 0.28
Nodes (8): createSystemMessage(), createUserMessage(), generateMessageId(), httpServer, io, Message, User, users

### Community 67 - "Code module 67"
Cohesion: 0.25
Nodes (7): BookCoverArtworkProps, CoverImage(), CoverImageProps, FallbackArtwork(), FallbackArtworkProps, getGradient(), GRADIENT_COLORS

### Community 68 - "Code module 68"
Cohesion: 0.22
Nodes (7): Pagination(), PaginationContent(), PaginationEllipsis(), PaginationLink(), PaginationLinkProps, PaginationNext(), PaginationPrevious()

### Community 69 - "Code module 69"
Cohesion: 0.31
Nodes (7): buildTechnicalQuoteUrl(), QuoteCardCreationResult, QuoteCardPayload, QuoteShareDependencies, QuoteShareRequest, QuoteShareResult, shareQuoteSelection()

### Community 70 - "Code module 70"
Cohesion: 0.28
Nodes (8): createReaderStore(), generateReaderId(), generateRussianUsername(), ReaderState, ReaderStore, ReplyQuote, StoredState, Window

### Community 71 - "Code module 71"
Cohesion: 0.43
Nodes (6): PublicMomentImage(), PublicMomentImageProps, LegacyPublicMomentImage(), LegacyPublicMomentImageProps, getPublicBookMomentById(), renderMomentShareCardPng()

### Community 72 - "Code module 72"
Cohesion: 0.48
Nodes (4): POST(), ALLOWED_HOSTS, GoogleDriveImportTarget, resolveGoogleDriveImportTarget()

### Community 73 - "Code module 73"
Cohesion: 0.48
Nodes (3): renderTextWithBibliographyMarkers(), resolveBibliographyMarkerNumbers(), parseBibliographicMarker()

### Community 74 - "Code module 74"
Cohesion: 0.43
Nodes (5): ToggleGroup(), ToggleGroupContext, ToggleGroupItem(), Toggle(), toggleVariants

### Community 75 - "Code module 75"
Cohesion: 0.57
Nodes (5): log_step_end(), log_step_start(), dev.sh script, start_mini_services(), wait_for_service()

### Community 76 - "Code module 76"
Cohesion: 0.33
Nodes (3): main(), mini-services-start.sh script, start.sh script

### Community 77 - "Code module 77"
Cohesion: 0.33
Nodes (4): HOSTNAME, NEXT_TELEMETRY_DISABLED, PORT, bookstream-run.sh script

### Community 79 - "Code module 79"
Cohesion: 0.60
Nodes (5): assertReadableSections(), createDocxFixture(), createPlainDocxFixture(), execFileAsync, writeFixture()

### Community 80 - "Code module 80"
Cohesion: 0.50
Nodes (4): Alert(), AlertDescription(), AlertTitle(), alertVariants

### Community 81 - "Code module 81"
Cohesion: 0.50
Nodes (4): mergeTextRanges(), splitTextByRanges(), TextRange, TextSegment

### Community 82 - "Code module 82"
Cohesion: 0.60
Nodes (3): createDocxFixture(), execFileAsync, writeFixture()

### Community 83 - "Code module 83"
Cohesion: 0.50
Nodes (3): __dirname, eslintConfig, __filename

## Knowledge Gaps
- **497 isolated node(s):** `build.sh script`, `NEXT_TELEMETRY_DISABLED`, `$schema`, `style`, `rsc` (+492 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **85 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Code module 31` to `Code module 128`, `Code module 129`, `Code module 130`, `Code module 131`, `Code module 132`, `Code module 133`, `Code module 6`, `Code module 134`, `Code module 135`, `Code module 136`, `Code module 137`, `Code module 138`, `Code module 139`, `Code module 140`, `Code module 14`, `Code module 141`, `Code module 142`, `Code module 143`, `Code module 144`, `Code module 145`, `Code module 146`, `Code module 147`, `Code module 148`, `Code module 149`, `Code module 24`, `Code module 150`, `Code module 151`, `Code module 152`, `Code module 153`, `Code module 154`, `Code module 155`, `Code module 156`, `Code module 157`, `Code module 158`, `Code module 159`, `Code module 160`, `Code module 161`, `Code module 162`, `Code module 163`, `Code module 164`, `Code module 165`, `Code module 92`, `Code module 93`, `Code module 94`, `Code module 95`, `Code module 96`, `Code module 97`, `Code module 98`, `Code module 99`, `Code module 100`, `Code module 101`, `Code module 102`, `Code module 103`, `Code module 104`, `Code module 105`, `Code module 106`, `Code module 108`, `Code module 109`, `Code module 110`, `Code module 111`, `Code module 112`, `Code module 113`, `Code module 114`, `Code module 115`, `Code module 116`, `Code module 117`, `Code module 118`, `Code module 119`, `Code module 120`, `Code module 121`, `Code module 122`, `Code module 123`, `Code module 124`, `Code module 125`, `Code module 126`, `Code module 127`?**
  _High betweenness centrality (0.205) - this node is a cross-community bridge._
- **Why does `cn()` connect `Code module 2` to `Code module 0`, `Code module 5`, `Code module 7`, `Code module 12`, `Code module 15`, `Code module 18`, `Code module 19`, `Code module 23`, `Code module 24`, `Code module 29`, `Code module 33`, `Code module 36`, `Code module 42`, `Code module 43`, `Code module 46`, `Code module 47`, `Code module 48`, `Code module 49`, `Code module 54`, `Code module 58`, `Code module 62`, `Code module 63`, `Code module 65`, `Code module 67`, `Code module 68`, `Code module 74`, `Code module 80`, `Code module 84`?**
  _High betweenness centrality (0.185) - this node is a cross-community bridge._
- **Why does `react` connect `Code module 24` to `Code module 5`, `Code module 7`, `Code module 74`, `Code module 54`, `Code module 58`, `Code module 31`?**
  _High betweenness centrality (0.146) - this node is a cross-community bridge._
- **What connects `build.sh script`, `NEXT_TELEMETRY_DISABLED`, `$schema` to the rest of the system?**
  _497 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Code module 0` be split into smaller, more focused modules?**
  _Cohesion score 0.051962676962676965 - nodes in this community are weakly interconnected._
- **Should `Code module 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07364114552893045 - nodes in this community are weakly interconnected._
- **Should `Code module 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05576441102756892 - nodes in this community are weakly interconnected._