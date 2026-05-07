/**
 * Seed script for Bookstream
 * Creates test data: author, books, chapters, variants, paragraphs, comments, reactions
 * Idempotent — safe to run multiple times
 */

import { db } from './db'

const AUTHOR_SLUG = 'alex'

const chapterContent: Record<string, string[]> = {
  // Book 1: Евангелие от Иуды
  'gospel-of-judas-ch1': [
    '<p>Эта книга родилась из долгих размышлений о природе предательства и верности. Многие века Иуда Искариот считался воплощением зла, предателем, который продал своего учителя за тридцать сребреников. Но что, если мы посмотрим на эту историю с другой стороны? Что, если Иуда был не предателем, а самым верным учеником, который выполнил самую трудную и страшную миссию?</p>',
    '<p>Исторические контексты первого века нашей эры были невероятно сложными. Иудея находилась под властью Римской империи, и в обществе бушевали политические страсти. Мессианские ожидания были на пике — люди ждали спасителя, который избавит их от римского гнёта. В этом бурлящем котле идей и надежд появился Иисус из Назарета, и вместе с ним — двенадцать человек, решивших последовать за ним до конца.</p>',
    '<p>Гностические тексты, обнаруженные в 1945 году в Наг-Хаммади, открыли нам совершенно неожиданную перспективу. Евангелие от Иуды, один из самых удивительных документов этой находки, представляет Иуду не как злодея, а как единственного ученика, по-настоящему понявшего учение Христа. В этом тексте Иуда получает от Иисуса тайные знания, недоступные остальным апостолам.</p>',
    '<p>Современные библеисты и историки продолжают спорить о подлинности и значении этого текста. Одни видят в нём ценнейший источник для понимания раннего христианства, другие — лишь фантазию гностической секты. Но независимо от исторической достоверности, этот документ заставляет нас задуматься о самом понятии предательства. Где проходит граница между предательством и высшей формой преданности?</p>',
    '<p>В этой книге я предлагаю читателю вместе со мной пройти этот непростой путь переосмысления. Мы будем опираться на исторические источники, богословские трактаты и, конечно, на сам текст Евангелия от Иуды. Цель — не переписать историю, а расширить наше понимание одного из самых драматичных эпизодов мировой культуры.</p>',
    '<p>Я благодарю всех, кто помогал мне в работе над этим текстом: коллег-историков, богословов и, конечно, мою семью за бесконечное терпение. Особая благодарность профессору Андрею Кравцову, чьи лекции о гностицизме впервые пробудили мой интерес к этой теме много лет назад.</p>',
  ],

  'gospel-of-judas-ch2': [
    '<p>Коридор был тёмным, как ночь без звёзд. Стены из тёсаного камня смыкались с обеих сторон, и единственным источником света был тусклый огарок свечи, которую Иуда держал в дрожащей руке. Каждый шаг отдавался эхом, множась и искажаясь, пока не становился невозможно понять, приближается ли кто-то или это лишь игра воображения.</p>',
    '<p>Он шёл уже много часов, или, возможно, всего несколько минут — в этой кромешной тьме время теряло смысл. Верхний город Иерусалима был полон тайных ходов и подземных галерей, вырытых ещё во времена царя Соломона. Иуда знал некоторые из них, но этот коридор был ему незнаком. Кто-то привёл его сюда, и этот кто-то знал, что делает.</p>',
    '<p>Воздух был тяжёлым и затхлым, пропитанным запахом сырости и чего-то ещё, более неприятного. На стенах местами проступали странные символы — древние письмена, которые Иуда не мог разобрать. Его учитель говорил, что в подземельях Иерусалима скрыты тайные комнаты, где хранятся знания, переданные людям ангелами ещё до Великого Потопа.</p>',
    '<p>Внезапно коридор расширился, и Иуда оказался в круглой зале. Потолок был настолько высоким, что терялся во мраке. В центре залы стоял каменный стол, а на нём лежал свиток. Свеча почти догорела, но было достаточно света, чтобы разглядеть знакомые чернила. Это был свиток, который учитель показывал ему только один раз, в ту ночь у Галилейского моря.</p>',
    '<p>Иуда подошёл к столу и взял свиток в руки. Пергамент был холодным на ощупь, как будто только что принесли из ледника. Он развернул его и начал читать. Слова были знакомыми, но теперь, в этом странном месте, они обрели совершенно новый смысл. Каждый иероглиф, каждая буква пульсировала какой-то скрытой энергией, и Иуда чувствовал, как знания проникают прямо в его сознание, минуя обычные каналы восприятия.</p>',
    '<p>Он читал о времени, которое придет после, о мире, который будет создан из пепла старого. О том, что предательство — это не конец, а начало, что жертва необходима для перерождения. И с каждой прочитанной строчкой его сердце становилось всё тяжелее, но одновременно — всё спокойнее. Он начинал понимать.</p>',
    '<p>Где-то вдалеке послышался звук шагов. Кто-то шёл к нему по коридору. Иуда завернул свиток и спрятал его под плащ. Свеча погасла, и тьма поглотила всё. Он стоял неподвижно, ожидая. И в этой абсолютной черноте он впервые почувствовал, что больше не боится. Потому что теперь он знал, что должен делать.</p>',
  ],

  'gospel-of-judas-ch3': [
    '<p>Свет появился внезапно, как будто кто-то раздвинул тяжёлые занавески. Утреннее солнце заливало двор Храма золотым потоком, и на мгновение всё вокруг засияло так ярко, что Иуда зажмурился. Когда он снова открыл глаза, мир показался ему другим — более мягким, более терпимым, почти прощающим.</p>',
    '<p>Он стоял у колонны, наблюдая за тем, как люди приходят и уходят. Торговцы меняли монеты, фарисеи спорили о законе, римские солдаты равнодушно смотрели по сторонам. Жизнь шла своим чередом, как шла всегда, и никто из этих людей не подозревал, какие события разворачиваются прямо перед их глазами. Иуда думал о том, как тонка грань между обыденностью и чудом.</p>',
    '<p>Накануне учитель говорил им о Царствии Небесном. «Царствие Божие внутрь вас есть», — повторял он. И ученики переглядывались, не понимая. Но Иуда понимал. Он понял раньше всех, хотя учитель и не говорил ему этого прямо. Это было одно из тех знаний, которые не передаются словами — они проникают в тебя, как вода сквозь песок, и становятся частью тебя навсегда.</p>',
    '<p>Он вспомнил, как они сидели вместе на крыше дома в Вифании, и Лазарь рассказывал о своём возвращении из мира мёртвых. «Там нет ни света, ни тьмы, — говорил Лазарь, — есть только покой и ожидание. Я чувствовал, как кто-то зовёт меня, и этот голос был похож на голос матери, которую я не помню». Иисус тогда улыбнулся и ничего не сказал, но Иуда заметил слезу в его глазах.</p>',
    '<p>Теперь, стоя в лучах утреннего солнца, Иуда осознал, что надежда — это не то, что ждёт нас в будущем. Надежда — это то, что уже здесь, внутри каждого из нас. Она не требует доказательств, не нуждается в обещаниях. Она просто есть, как свет, который всегда возвращается после самой длинной ночи. И в этом заключалась самая большая тайна его учителя.</p>',
    '<p>Он опустил руку в карман и коснулся свитка. Переступления — это тоже путь к истине. И пусть мир судит его так, как сочтёт нужным. Он знает правду. И этой правды достаточно.</p>',
  ],

  // Book 2: Метро 2033: Разбор
  'metro-2033-ch1': [
    '<p>Роман «Метро 2033» Дмитрия Глуховского стал одним из самых значимых явлений российской фантастики XXI века. Опубликованный впервые в 2005 году, он мгновенно покорил читателей и породил целую медиафраншизу, включающую игры, комиксы и продолжения. Но что делает эту книгу такой особенной? Почему спустя почти два десятилетия она продолжает находить отклик у новых поколений читателей?</p>',
    '<p>Действие романа разворачивается в московском метро после ядерной войны 2013 года. Выжившие люди превратили станции в города-государства, каждая из которых выработала свою идеологию и систему ценностей. Красная Линия — коммунизм, Четвёртый Рейх — фашизм, Ганза — капитализм. Это зеркальное отражение человеческой истории, сжатое до масштаба подземных тоннелей.</p>',
    '<p>Главный герой, Артём, — молодой стрелок с станции ВДНХ, отправляется в опасное путешествие через всю систему метро, чтобы предупредить остальные станции о появлении загадочных Чёрных, мутировавших существ, угрожающих последнему оплоту человечества. Этот квестовый сюжет overlay на глубокую философскую подоплёку: что делает человека человеком в условиях абсолютного отчуждения и страха?</p>',
    '<p>В этом разборе мы подробно рассмотрим ключевые темы романа, проанализируем его структуру и повествовательные приёмы, а также попытаемся понять, почему «Метро 2033» стало не просто развлечением, а настоящим культурным феноменом, определившим жанр постапокалиптики в России на годы вперёд.</p>',
    '<p>Стоит отметить, что Глуховский начал писать роман в возрасте всего восемнадцати лет, и эта юношеская энергия ощущается на каждой странице. Книга не претендует на литературную безупречность, но зато обладает редкой искренностью и неутомимой фантазией, которые с лихвой компенсируют любые стилистические погрешности.</p>',
  ],

  'metro-2033-ch2': [
    '<p>Мир московского метро после ядерной войны — это не просто декорация, а полноправный персонаж романа. Глуховский создал невероятно детализированную карту подземного мира, где каждая станция живёт своей жизнью, имеет свою историю, свою культуру и своих демонов. Больше ста станций, соединённых сотнями километров тоннелей, образуют лабиринт, в котором можно потеряться буквально и метафорически.</p>',
    '<p>Станция ВДНХ, дом Артёма, — одна из самых северных станций на Калужско-Рижской линии. Её жители живут в постоянном страхе перед Чёрными — существами, которые появляются из тьмы и уводят людей без следа. Эта атмосфера надвигающейся катастрофы задает тон всему повествованию и заставляет читателя сопереживать героям с первых страниц.</p>',
    '<p>Поляна, крупнейший торговый узел метро, — это шумный, хаотичный мир, где сталкиваются все культуры и идеологии. Здесь можно найти всё: от консервированной тушёнки и фильтров для противогазов до запрещённых книг и боеприпасов. Поляна — это метафора глобального рынка, помноженная на условия катастрофического дефицита.</p>',
    '<p>Особого внимания заслуживает станция «Библиотека имени Ленина», расположенная на поверхности. Это одно из самых страшных мест в романе — библиотека, overrun 图书馆, захваченная мутантами, где книги стали ловушкой для неосторожных путников. Глуховский использует этот образ, чтобы задать важный вопрос: не превратилось ли само знание в угрозу для человечества?</p>',
    '<p>Поверхность в мире «Метро 2033» — это абсолютное табу. Радиация, мутанты и аномалии сделали её непригодной для жизни. Но именно туда отправляются самые смелые сталкеры в поисках припасов и артефактов. Контраст между безопасным, но удушающим подземным миром и смертельно опасной, но свободной поверхностью — один из центральных мотивов романа.</p>',
    '<p>Мир метро — это мир в миниатюре, где сохраняются все пороки и добродетели человечества, но в экстремальных условиях. Глуховский показывает, что даже на грани вымирания люди продолжают воевать друг с другом за идеи, территорию и ресурсы. Возможно, в этом и заключается главный парадокс и главный урок романа.</p>',
  ],
}

async function main() {
  console.log('🌱 Seeding Bookstream database...\n')

  // 1. Create author (upsert)
  console.log('1️⃣  Creating author...')
  const author = await db.author.upsert({
    where: { slug: AUTHOR_SLUG },
    update: {
      name: 'Александр Петров',
      bio: 'Писатель и блогер',
    },
    create: {
      slug: AUTHOR_SLUG,
      name: 'Александр Петров',
      bio: 'Писатель и блогер',
    },
  })
  console.log(`   ✅ Author: ${author.name} (${author.slug})`)

  // 2. Create books
  console.log('\n2️⃣  Creating books...')

  const book1 = await db.book.upsert({
    where: {
      authorId_slug: { authorId: author.id, slug: 'gospel-of-judas' },
    },
    update: {
      title: 'Евангелие от Иуды',
      description: 'Альтернативный взгляд на предательство',
      readingModeDefault: 'feed',
      isPublic: true,
    },
    create: {
      slug: 'gospel-of-judas',
      title: 'Евангелие от Иуды',
      description: 'Альтернативный взгляд на предательство',
      readingModeDefault: 'feed',
      isPublic: true,
      authorId: author.id,
    },
  })
  console.log(`   ✅ Book 1: "${book1.title}" (id: ${book1.id})`)

  const book2 = await db.book.upsert({
    where: {
      authorId_slug: { authorId: author.id, slug: 'metro-2033-review' },
    },
    update: {
      title: 'Метро 2033: Разбор',
      description: 'Глубокий анализ культового романа',
      readingModeDefault: 'book',
      isPublic: true,
    },
    create: {
      slug: 'metro-2033-review',
      title: 'Метро 2033: Разбор',
      description: 'Глубокий анализ культового романа',
      readingModeDefault: 'book',
      isPublic: true,
      authorId: author.id,
    },
  })
  console.log(`   ✅ Book 2: "${book2.title}" (id: ${book2.id})`)

  // 3. Create chapters for Book 1
  console.log('\n3️⃣  Creating chapters for Book 1...')

  const book1Chapters = [
    { title: 'Предисловие', position: 0, contentKey: 'gospel-of-judas-ch1' },
    { title: 'Глава 1. Тёмный коридор', position: 1, contentKey: 'gospel-of-judas-ch2' },
    { title: 'Глава 2. Свет в конце', position: 2, contentKey: 'gospel-of-judas-ch3' },
  ]

  const b1chapters: Array<{ id: string; title: string; position: number }> = []
  for (const ch of book1Chapters) {
    const chapter = await db.chapter.upsert({
      where: {
        bookId_position: { bookId: book1.id, position: ch.position },
      },
      update: { title: ch.title },
      create: {
        bookId: book1.id,
        title: ch.title,
        position: ch.position,
      },
    })
    b1chapters.push(chapter)
    console.log(`   ✅ Chapter: "${ch.title}" (id: ${chapter.id})`)
  }

  // 4. Create chapters for Book 2
  console.log('\n4️⃣  Creating chapters for Book 2...')

  const book2Chapters = [
    { title: 'Введение', position: 0, contentKey: 'metro-2033-ch1' },
    { title: 'Мир метро', position: 1, contentKey: 'metro-2033-ch2' },
  ]

  const b2chapters: Array<{ id: string; title: string; position: number }> = []
  for (const ch of book2Chapters) {
    const chapter = await db.chapter.upsert({
      where: {
        bookId_position: { bookId: book2.id, position: ch.position },
      },
      update: { title: ch.title },
      create: {
        bookId: book2.id,
        title: ch.title,
        position: ch.position,
      },
    })
    b2chapters.push(chapter)
    console.log(`   ✅ Chapter: "${ch.title}" (id: ${chapter.id})`)
  }

  // 5. Create variants and paragraphs for all chapters
  console.log('\n5️⃣  Creating variants and paragraphs...')

  const allChaptersWithContent = [
    ...book1Chapters.map((ch, i) => ({ ...ch, chapterId: b1chapters[i].id })),
    ...book2Chapters.map((ch, i) => ({ ...ch, chapterId: b2chapters[i].id })),
  ]

  for (const ch of allChaptersWithContent) {
    const paragraphs = chapterContent[ch.contentKey]
    const contentHtml = paragraphs.join('\n')

    // Upsert variant
    const variant = await db.chapterVariant.upsert({
      where: {
        chapterId_variantType: { chapterId: ch.chapterId, variantType: 'original' },
      },
      update: { contentHtml },
      create: {
        chapterId: ch.chapterId,
        variantType: 'original',
        contentHtml,
        editedByAuthor: true,
      },
    })

    // Create paragraphs - delete existing and recreate
    await db.paragraph.deleteMany({
      where: { chapterVariantId: variant.id },
    })

    for (let i = 0; i < paragraphs.length; i++) {
      // Extract text from <p>...</p> tags
      const textMatch = paragraphs[i].match(/<p>(.*?)<\/p>/s)
      const text = textMatch ? textMatch[1] : paragraphs[i]

      await db.paragraph.create({
        data: {
          chapterVariantId: variant.id,
          stableKey: `p-${i}`,
          position: i,
          text,
        },
      })
    }

    console.log(`   ✅ Variant + ${paragraphs.length} paragraphs for "${ch.title}"`)
  }

  // 6. Create test comments on Book 1, Chapter 1
  console.log('\n6️⃣  Creating test comments...')

  // Delete existing seed comments first for idempotency
  const existingSeedComments = await db.comment.findMany({
    where: {
      chapterId: b1chapters[0].id,
      username: { in: ['читатель_мария', 'booklover', 'историк_иван'] },
    },
  })
  if (existingSeedComments.length > 0) {
    await db.comment.deleteMany({
      where: {
        id: { in: existingSeedComments.map((c) => c.id) },
      },
    })
  }

  const seedReader1 = await db.reader.upsert({
    where: { id: 'seed-reader-1' },
    update: { currentUsername: 'читатель_мария' },
    create: { id: 'seed-reader-1', currentUsername: 'читатель_мария' },
  })

  const seedReader2 = await db.reader.upsert({
    where: { id: 'seed-reader-2' },
    update: { currentUsername: 'booklover' },
    create: { id: 'seed-reader-2', currentUsername: 'booklover' },
  })

  const seedReader3 = await db.reader.upsert({
    where: { id: 'seed-reader-3' },
    update: { currentUsername: 'историк_иван' },
    create: { id: 'seed-reader-3', currentUsername: 'историк_иван' },
  })

  await db.comment.create({
    data: {
      bookId: book1.id,
      chapterId: b1chapters[0].id,
      readerId: seedReader1.id,
      username: 'читатель_мария',
      body: 'Замечательная вводная глава! Очень интересно изложена история находки в Наг-Хаммади. Жду с нетерпением продолжения.',
      status: 'active',
    },
  })

  await db.comment.create({
    data: {
      bookId: book1.id,
      chapterId: b1chapters[0].id,
      readerId: seedReader2.id,
      username: 'booklover',
      body: 'Согласна с автором — нам нужно перестать смотреть на Иуду через призму традиционного осуждения. Каждый заслуживает быть понятым.',
      status: 'active',
    },
  })

  await db.comment.create({
    data: {
      bookId: book1.id,
      chapterId: b1chapters[0].id,
      readerId: seedReader3.id,
      username: 'историк_иван',
      body: 'Небольшая поправка: текст из Наг-Хаммади датируется III-IV веком, а не I веком. Однако это не умаляет его значения для понимания раннехристианских течений.',
      status: 'active',
    },
  })

  console.log('   ✅ 3 comments created for Book 1, Chapter 1')

  // 7. Create test reactions on some paragraphs
  console.log('\n7️⃣  Creating test reactions...')

  // Get the first chapter's variant and some paragraphs
  const firstVariant = await db.chapterVariant.findFirst({
    where: { chapterId: b1chapters[0].id, variantType: 'original' },
    include: { paragraphs: { orderBy: { position: 'asc' } } },
  })

  if (firstVariant && firstVariant.paragraphs.length > 0) {
    const p0 = firstVariant.paragraphs[0]
    const p2 = firstVariant.paragraphs.length > 2 ? firstVariant.paragraphs[2] : p0
    const p4 = firstVariant.paragraphs.length > 4 ? firstVariant.paragraphs[4] : p0

    // Delete existing seed reactions for idempotency
    await db.reaction.deleteMany({
      where: {
        paragraphId: { in: [p0.id, p2.id, p4.id] },
        readerId: { in: [seedReader1.id, seedReader2.id, seedReader3.id] },
      },
    })

    // Reaction on paragraph 0
    await db.reaction.create({
      data: {
        paragraphId: p0.id,
        chapterVariantId: firstVariant.id,
        readerId: seedReader1.id,
        emoji: '❤️',
      },
    })
    await db.reaction.create({
      data: {
        paragraphId: p0.id,
        chapterVariantId: firstVariant.id,
        readerId: seedReader2.id,
        emoji: '❤️',
      },
    })

    // Reaction on paragraph 2
    await db.reaction.create({
      data: {
        paragraphId: p2.id,
        chapterVariantId: firstVariant.id,
        readerId: seedReader1.id,
        emoji: '🔥',
      },
    })
    await db.reaction.create({
      data: {
        paragraphId: p2.id,
        chapterVariantId: firstVariant.id,
        readerId: seedReader3.id,
        emoji: '💡',
      },
    })

    // Reaction on paragraph 4
    await db.reaction.create({
      data: {
        paragraphId: p4.id,
        chapterVariantId: firstVariant.id,
        readerId: seedReader2.id,
        emoji: '👍',
      },
    })
    await db.reaction.create({
      data: {
        paragraphId: p4.id,
        chapterVariantId: firstVariant.id,
        readerId: seedReader3.id,
        emoji: '👏',
      },
    })

    console.log('   ✅ 6 reactions created across 3 paragraphs')
  } else {
    console.log('   ⚠️  No paragraphs found for reactions')
  }

  // 8. Seed default variant presets
  console.log('\n8️⃣  Creating variant presets...')

  await db.variantPreset.upsert({
    where: { slug: 'clean' },
    update: {
      label: 'Без воды',
      emoji: '✂️',
      description: '50% текста, максимум смысла. Убрана вода, сохранён нарратив.',
      targetSizePercent: 50,
      position: 1,
      systemPromptTemplate: `Ты — мастер сокращения текста. Сократи исходный текст примерно до 50% ({word_count} слов), сохранив максимум смысла и нарратива.

Принцип: работает закон Парето — примерно 50% текста несут почти весь смысл. Оставь эти 50%, вырежь остальное.

Правила:
- Сократи примерно до {word_count} слов
- Сохрани повествовательный поток — текст читается как связная история, а не конспект
- Убирай: повторы, лишние описания, многословные вступления, watermark-фразы, тривиальные факты
- Оставляй: ключевые события, диалоги, важные факты, авторские наблюдения, сюжетные повороты
- Абзацы: примерно столько же, как в оригинале
- Формат: чистый текст, каждый абзац на новой строке, без markdown/тегов`,
    },
    create: {
      slug: 'clean',
      label: 'Без воды',
      emoji: '✂️',
      description: '50% текста, максимум смысла. Убрана вода, сохранён нарратив.',
      targetSizePercent: 50,
      position: 1,
      systemPromptTemplate: `Ты — мастер сокращения текста. Сократи исходный текст примерно до 50% ({word_count} слов), сохранив максимум смысла и нарратива.

Принцип: работает закон Парето — примерно 50% текста несут почти весь смысл. Оставь эти 50%, вырежь остальное.

Правила:
- Сократи примерно до {word_count} слов
- Сохрани повествовательный поток — текст читается как связная история, а не конспект
- Убирай: повторы, лишние описания, многословные вступления, watermark-фразы, тривиальные факты
- Оставляй: ключевые события, диалоги, важные факты, авторские наблюдения, сюжетные повороты
- Абзацы: примерно столько же, как в оригинале
- Формат: чистый текст, каждый абзац на новой строке, без markdown/тегов`,
    },
  })

  await db.variantPreset.upsert({
    where: { slug: 'essence' },
    update: {
      label: 'Суть',
      emoji: '💡',
      description: '20% текста, дающего 80% смысла. Тикток-пересказ.',
      targetSizePercent: 20,
      position: 2,
      systemPromptTemplate: `Ты — создатель ultra-short саммари. Выжми из текста ядро — 20% ({word_count} слов), которые дают 80% смысла.

Принцип: level "тикток/shorts". Человек читает за 30 секунд и понимает суть.

Правила:
- Сократи примерно до {word_count} слов
- Оставь ТОЛЬКО ядро: главная идея, ключевые факты, выводы
- Один абзац = одна ключевая мысль (макс 2-3 предложения)
- Формат: чистый текст, каждый абзац на новой строке, без markdown/тегов
- Художественный текст → сюжетный скелет + главная мысль
- Аналитический текст → тезисы и выводы`,
    },
    create: {
      slug: 'essence',
      label: 'Суть',
      emoji: '💡',
      description: '20% текста, дающего 80% смысла. Тикток-пересказ.',
      targetSizePercent: 20,
      position: 2,
      systemPromptTemplate: `Ты — создатель ultra-short саммари. Выжми из текста ядро — 20% ({word_count} слов), которые дают 80% смысла.

Принцип: level "тикток/shorts". Человек читает за 30 секунд и понимает суть.

Правила:
- Сократи примерно до {word_count} слов
- Оставь ТОЛЬКО ядро: главная идея, ключевые факты, выводы
- Один абзац = одна ключевая мысль (макс 2-3 предложения)
- Формат: чистый текст, каждый абзац на новой строке, без markdown/тегов
- Художественный текст → сюжетный скелет + главная мысль
- Аналитический текст → тезисы и выводы`,
    },
  })

  console.log('   ✅ 2 variant presets (clean, essence)')
  console.log('\n✅ Seeding complete!')
  console.log(`\n📊 Summary:`)
  console.log(`   Authors: 1`)
  console.log(`   Books: 2`)
  console.log(`   Chapters: 5`)
  console.log(`   Comments: 3`)
  console.log(`   Reactions: 6`)
  console.log(`\n🔑 Key IDs:`)
  console.log(`   Author ID:   ${author.id}`)
  console.log(`   Book 1 ID:   ${book1.id}  (gospel-of-judas)`)
  console.log(`   Book 2 ID:   ${book2.id}  (metro-2033-review)`)
  console.log(`   Ch1 (B1) ID: ${b1chapters[0].id}  (Предисловие)`)
  console.log(`   Ch2 (B1) ID: ${b1chapters[1].id}  (Тёмный коридор)`)
  console.log(`   Ch3 (B1) ID: ${b1chapters[2].id}  (Свет в конце)`)
  console.log(`   Ch1 (B2) ID: ${b2chapters[0].id}  (Введение)`)
  console.log(`   Ch2 (B2) ID: ${b2chapters[1].id}  (Мир метро)`)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
