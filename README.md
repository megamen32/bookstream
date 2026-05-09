# BookStream

**Read. Share. Comment. Think together.**

BookStream is an interactive reading platform where books become living spaces for notes, quotes, comments, discussions, and multiple ways of reading.

It is not just an online library and not just a social network.  
BookStream turns a book into an interactive reading room: text, notes, quotes, comments and discussions live in one place.

> A book remains a book — but becomes alive, social, and modern.

---

## Live demo

**Production:** https://books.bezrabotnyi.com

---

## What is BookStream?

BookStream is a platform for people who do not just consume books, but work with them.

Readers can:

- read books online;
- switch between different reading modes;
- leave comments on text fragments;
- save quotes and notes;
- discuss ideas with other readers;
- continue reading offline;
- return to important fragments later;
- see a book not as a closed file, but as a shared intellectual space.

BookStream is built as a real product surface, not as a pitch deck, demo shell, or temporary prototype.

Product decisions in the app and docs should optimize for real reading, publishing, moderation, and long-term maintainability.

---

## Core features

### Reader

- Clean online book reader
- Minimal reading interface
- Text-first layout
- Comfortable long-form reading
- Reader comments
- Fragment-level interactions
- Quotes and annotations
- Offline reading flow
- Reading progress
- Feed reader virtualization for large texts

### Social reading

- Comments around books and fragments
- Discussions connected to the text
- Shared quotes
- Reader reactions
- Public meaning layer around a book

### Reading modes

BookStream does not force one “correct” way to read.

The reader can choose the depth and rhythm:

- full original text;
- shortened version;
- core summary;
- selected important fragments;
- personal notes and highlights.

### Admin and publishing

- Admin book upload flow
- Book editing
- Device linking flow
- Admin controls
- Reader and content management
- Foundation for moderation workflows

### Offline and device experience

- Offline reader flow
- Device linking
- Reader state preservation
- Reading continuity across sessions

---

## Screenshots

> Screenshots are stored in `docs/screenshots/`.

### Reader

![Reader](docs/screenshots/reader.png)

### Reader comments

![Reader comments](docs/screenshots/comments.png)

### Quotes and annotations

![Quotes and annotations](docs/screenshots/annotations.png)

### Offline reading

![Offline reading](docs/screenshots/offline-reader.png)

### Admin panel

![Admin panel](docs/screenshots/admin.png)

---

## Philosophy

Interactivity is not an extra layer on top of reading.  
It is a new dimension of reading.

Traditional digital reading often reduces a book to a file: open, scroll, close.  
BookStream treats a book differently.

A book can be:

- a text;
- a discussion;
- a collection of quotes;
- a shared reading experience;
- a personal notebook;
- a social layer around meaning.

BookStream makes books great again: not just text, but a living space where readers can think together, argue, share quotes, leave comments, and see how the same text opens differently for different people.

It is an online book club without heavy interfaces, old library feeling, or unnecessary barriers.

---

## Design principles

Design is everything.

BookStream must be:

- clean;
- modern;
- minimal;
- calm;
- fast;
- readable;
- focused on the text.

No overloaded screens.  
No heavy menus.  
No visual noise.  
No unnecessary actions.

The interface should disappear while the user reads — and appear only when it is actually needed.

The main principle:

> The book remains the center.  
> The interface exists only to make reading deeper, easier, and more alive.

---

## Product principles

### Real product, not a demo

This repository is being built as the final product surface.

That means:

- features should be maintainable;
- UI should be usable, not just impressive;
- admin flows matter as much as reader flows;
- moderation and publishing should be treated as core product logic;
- long-term development should be possible without rewriting everything.

### Reader first

The reader experience is the center of the product.

If a feature makes the interface heavier but does not improve reading, it should be questioned.

### Social, but not noisy

BookStream is social, but it is not trying to become a chaotic feed.

The social layer must help the reader understand the book better:

- comments should be connected to meaning;
- quotes should preserve context;
- discussions should grow from the text;
- the book should remain more important than the interface around it.

### Multiple depths of reading

Different people read differently.

Some want the full text.  
Some want the main ideas.  
Some want fragments, notes and discussion.  
Some return to a book many times.

BookStream should support all of these patterns.

---

## Tech stack

- **Next.js**
- **TypeScript**
- **React**
- **Prisma**
- **Playwright**
- **Tailwind CSS**
- **Bun / npm**
- **Caddy**

---

## Project structure

```text
.
├── db/                    # Database-related files
├── deploy/                # Deployment configuration
├── docs/                  # Documentation and screenshots
├── download/              # Download/import-related logic
├── examples/              # Example integrations
├── mini-services/         # Auxiliary services
├── prisma/                # Prisma schema and migrations
├── public/                # Static assets
├── scripts/               # Utility scripts
├── src/                   # Main application source code
├── tests/                 # Playwright and test coverage
├── Makefile               # Common development commands
├── next.config.ts         # Next.js configuration
├── package.json           # Project dependencies and scripts
└── README.md
```

---

## Quick start

Clone the repository:

```bash
git clone https://github.com/megamen32/bookstream.git
cd bookstream
```

Install dependencies:

```bash
npm install
```

Create environment file:

```bash
cp .env.example .env
```

Run database migrations:

```bash
npx prisma migrate dev
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## Environment variables

Create `.env` from `.env.example`.

Example:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/bookstream"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Actual required variables may depend on the deployment mode and enabled integrations.

---

## Scripts

Common commands:

```bash
npm run dev
```

Run development server.

```bash
npm run build
```

Build production version.

```bash
npm run start
```

Start production server.

```bash
npm run lint
```

Run lint checks.

```bash
npx playwright test
```

Run Playwright tests.

---

## Testing

BookStream includes Playwright coverage for reader and admin flows.

The test suite should protect the most important product paths:

- opening the reader;
- reading text;
- working with comments;
- admin upload/editing flow;
- device linking flow;
- offline reader behavior.

Run tests:

```bash
npx playwright test
```

---

## Roadmap

### Reader

- [x] Basic reader
- [x] Reader comments
- [x] Reader experience refinement
- [x] Offline reader flow
- [x] Feed reader virtualization
- [ ] Reading progress sync
- [ ] Fragment sharing
- [ ] Advanced reading settings
- [ ] Personal reading history

### Notes, quotes and annotations

- [x] Annotation flows
- [x] Quote-related UI foundation
- [ ] Personal quote library
- [ ] Public quote pages
- [ ] Export notes
- [ ] Search inside personal annotations

### Social layer

- [x] Comments UI
- [ ] Public discussions
- [ ] Comment moderation
- [ ] Reader profiles
- [ ] Following readers
- [ ] Book clubs / reading groups

### Publishing and admin

- [x] Upload flow
- [x] Admin editing
- [x] Admin device linking flow
- [x] Reading stats and admin controls
- [ ] Moderation queue
- [ ] Publisher roles
- [ ] Author pages
- [ ] Content versioning

### AI / LLM features

- [ ] Short versions of books
- [ ] Chapter summaries
- [ ] Core 20% reading mode
- [ ] Semantic search across books
- [ ] Personal reading assistant
- [ ] Comment and discussion summarization

### Platform

- [ ] Production monitoring
- [ ] Backup strategy
- [ ] Better deployment documentation
- [ ] Public API foundation
- [ ] Import pipeline improvements

---

## Documentation

Additional documentation lives in `docs/`.

Suggested docs:

```text
docs/
├── architecture.md
├── deployment.md
├── product.md
├── reader.md
├── admin.md
└── screenshots/
```

---

## About the idea

BookStream starts from a simple observation:

Digital books are usually treated as static files.  
But reading is not static.

People underline, argue, compare, quote, remember, forget, return, discuss, and reinterpret.

BookStream makes this process part of the product.

The goal is not to replace the book with a social feed.  
The goal is to add a living layer around the book without destroying the reading experience.

---

## Русская версия

# BookStream

**Читайте. Делитесь. Комментируйте. Думайте вместе.**

BookStream — интерактивная платформа для чтения, где книга становится живым пространством для заметок, цитат, комментариев, обсуждений и разных способов чтения.

Это не просто онлайн-библиотека и не просто социальная сеть.  
BookStream превращает книгу в интерактивную комнату чтения: текст, заметки, цитаты, комментарии и обсуждения живут в одном месте.

> Книга остаётся книгой — но становится живой, социальной и современной.

---

## Демо

**Production:** https://books.bezrabotnyi.com

---

## Что такое BookStream?

BookStream — платформа для людей, которые не просто потребляют книги, а работают с ними.

Читатель может:

- читать книги онлайн;
- выбирать разные режимы чтения;
- оставлять комментарии к фрагментам текста;
- сохранять цитаты и заметки;
- обсуждать идеи с другими читателями;
- продолжать чтение офлайн;
- возвращаться к важным местам;
- воспринимать книгу не как закрытый файл, а как общее интеллектуальное пространство.

BookStream развивается как конечный продукт, а не как презентация, демо-оболочка или временный прототип.

Решения в приложении и документации должны быть ориентированы на реальное чтение, публикацию, модерацию и долгую поддержку.

---

## Основные возможности

### Читалка

- Чистая онлайн-читалка
- Минималистичный интерфейс
- Удобное чтение длинных текстов
- Комментарии читателей
- Взаимодействие с фрагментами текста
- Цитаты и аннотации
- Офлайн-режим чтения
- Прогресс чтения
- Виртуализация ленты для больших текстов

### Социальное чтение

- Комментарии вокруг книг и фрагментов
- Обсуждения, привязанные к тексту
- Общие цитаты
- Реакции читателей
- Социальный слой вокруг смысла книги

### Режимы чтения

BookStream не навязывает один “правильный” способ читать.

Читатель сам выбирает глубину и ритм:

- полный оригинальный текст;
- сокращённая версия;
- краткая суть;
- выбранные важные фрагменты;
- личные заметки и выделения.

### Админка и публикация

- Загрузка книг
- Редактирование книг
- Привязка устройств
- Админские настройки
- Управление читателями и контентом
- Основа для модерации

### Офлайн и устройства

- Офлайн-читалка
- Привязка устройств
- Сохранение состояния чтения
- Продолжение чтения между сессиями

---

## Скриншоты

> Скриншоты лежат в `docs/screenshots/`.

### Читалка

![Reader](docs/screenshots/reader.png)

### Комментарии

![Reader comments](docs/screenshots/comments.png)

### Цитаты и аннотации

![Quotes and annotations](docs/screenshots/annotations.png)

### Офлайн-чтение

![Offline reading](docs/screenshots/offline-reader.png)

### Админка

![Admin panel](docs/screenshots/admin.png)

---

## Философия

Интерактивность — это не дополнение к чтению.  
Это новое измерение чтения.

Обычное цифровое чтение часто превращает книгу в файл: открыть, пролистать, закрыть.  
BookStream относится к книге иначе.

Книга может быть:

- текстом;
- обсуждением;
- набором цитат;
- совместным опытом чтения;
- личным блокнотом;
- социальной оболочкой вокруг смысла.

BookStream делает книги великими снова: не просто текстом, а живым пространством, где читатели могут думать вместе, спорить, делиться цитатами, оставлять комментарии и видеть, как один и тот же текст раскрывается по-разному для разных людей.

Это книжный клуб в интернете — без лишних барьеров, тяжёлых интерфейсов и ощущения старой электронной библиотеки.

---

## Принципы дизайна

Дизайн — это всё.

BookStream должен быть:

- удобным;
- современным;
- минималистичным;
- спокойным;
- быстрым;
- читаемым;
- сфокусированным на тексте.

Никакой перегрузки.  
Никаких тяжёлых меню.  
Никакого визуального шума.  
Никаких лишних действий.

Интерфейс должен исчезать, когда человек читает, и появляться только тогда, когда он действительно нужен.

Главный принцип:

> Книга остаётся центром.  
> Интерфейс нужен только для того, чтобы сделать чтение глубже, удобнее и живее.

---

## Продуктовые принципы

### Реальный продукт, а не демо

Этот репозиторий развивается как конечная поверхность продукта.

Это значит:

- фичи должны быть поддерживаемыми;
- UI должен быть реально удобным, а не просто эффектным;
- админские сценарии так же важны, как читательские;
- модерация и публикация должны рассматриваться как часть ядра продукта;
- проект должен развиваться без полной переписи с нуля.

### Сначала читатель

Читательский опыт — центр продукта.

Если функция делает интерфейс тяжелее, но не улучшает чтение, её нужно ставить под вопрос.

### Социальность без шума

BookStream — социальный продукт, но он не должен превращаться в хаотичную ленту.

Социальный слой должен помогать лучше понимать книгу:

- комментарии должны быть связаны со смыслом;
- цитаты должны сохранять контекст;
- обсуждения должны расти из текста;
- книга должна оставаться важнее интерфейса вокруг неё.

### Разная глубина чтения

Люди читают по-разному.

Кто-то хочет полный текст.  
Кто-то хочет главные идеи.  
Кто-то работает с фрагментами, заметками и обсуждениями.  
Кто-то возвращается к книге много раз.

BookStream должен поддерживать все эти сценарии.

---

## Технологии

- **Next.js**
- **TypeScript**
- **React**
- **Prisma**
- **Playwright**
- **Tailwind CSS**
- **Bun / npm**
- **Caddy**

---

## Структура проекта

```text
.
├── db/                    # Файлы, связанные с базой данных
├── deploy/                # Конфигурация деплоя
├── docs/                  # Документация и скриншоты
├── download/              # Логика загрузки/импорта книг
├── examples/              # Примеры интеграций
├── mini-services/         # Вспомогательные сервисы
├── prisma/                # Prisma schema и миграции
├── public/                # Статические файлы
├── scripts/               # Вспомогательные скрипты
├── src/                   # Основной код приложения
├── tests/                 # Playwright и тесты
├── Makefile               # Основные команды разработки
├── next.config.ts         # Конфигурация Next.js
├── package.json           # Зависимости и scripts
└── README.md
```

---

## Быстрый запуск

Склонировать репозиторий:

```bash
git clone https://github.com/megamen32/bookstream.git
cd bookstream
```

Установить зависимости:

```bash
npm install
```

Создать файл окружения:

```bash
cp .env.example .env
```

Применить миграции:

```bash
npx prisma migrate dev
```

Запустить dev-сервер:

```bash
npm run dev
```

Открыть:

```text
http://localhost:3000
```

---

## Переменные окружения

Создайте `.env` на основе `.env.example`.

Пример:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/bookstream"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Фактический набор переменных зависит от режима деплоя и включённых интеграций.

---

## Команды

Основные команды:

```bash
npm run dev
```

Запуск dev-сервера.

```bash
npm run build
```

Production-сборка.

```bash
npm run start
```

Запуск production-сервера.

```bash
npm run lint
```

Проверка линтером.

```bash
npx playwright test
```

Запуск Playwright-тестов.

---

## Тестирование

В BookStream есть Playwright-покрытие для reader- и admin-сценариев.

Тесты должны защищать ключевые продуктовые пути:

- открытие читалки;
- чтение текста;
- работа с комментариями;
- загрузка и редактирование книг в админке;
- привязка устройств;
- офлайн-чтение.

Запуск тестов:

```bash
npx playwright test
```

---

## Roadmap

### Читалка

- [x] Базовая читалка
- [x] Комментарии читателей
- [x] Улучшение reader experience
- [x] Офлайн-читалка
- [x] Виртуализация ленты
- [ ] Синхронизация прогресса чтения
- [ ] Шеринг фрагментов
- [ ] Расширенные настройки чтения
- [ ] История чтения

### Заметки, цитаты и аннотации

- [x] Базовые annotation flows
- [x] Основа UI для цитат
- [ ] Личная библиотека цитат
- [ ] Публичные страницы цитат
- [ ] Экспорт заметок
- [ ] Поиск по личным аннотациям

### Социальный слой

- [x] UI комментариев
- [ ] Публичные обсуждения
- [ ] Модерация комментариев
- [ ] Профили читателей
- [ ] Подписки на читателей
- [ ] Книжные клубы / группы чтения

### Публикация и админка

- [x] Загрузка книг
- [x] Редактирование книг
- [x] Привязка устройств в админке
- [x] Статистика чтения и admin controls
- [ ] Очередь модерации
- [ ] Роли издателей
- [ ] Страницы авторов
- [ ] Версионирование контента

### AI / LLM

- [ ] Краткие версии книг
- [ ] Саммари глав
- [ ] Режим “20% смысла”
- [ ] Семантический поиск по книгам
- [ ] Персональный помощник по чтению
- [ ] Саммаризация комментариев и обсуждений

### Платформа

- [ ] Production monitoring
- [ ] Backup strategy
- [ ] Улучшенная документация деплоя
- [ ] Основа публичного API
- [ ] Улучшение import pipeline

---

## Документация

Дополнительная документация находится в `docs/`.

Рекомендуемая структура:

```text
docs/
├── architecture.md
├── deployment.md
├── product.md
├── reader.md
├── admin.md
└── screenshots/
```

---

## О замысле

BookStream начинается с простой мысли:

Цифровые книги обычно воспринимаются как статичные файлы.  
Но чтение не статично.

Люди подчёркивают, спорят, сравнивают, цитируют, запоминают, забывают, возвращаются и переосмысляют.

BookStream делает этот процесс частью продукта.

Цель — не заменить книгу социальной лентой.  
Цель — добавить живой слой вокруг книги, не разрушая сам опыт чтения.

---

## License

MIT