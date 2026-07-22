# TK CREATIVE — Каталог библиотек (флипбук)

Интерактивный каталог с перелистыванием страниц, звуком и анимацией.
React + Vite. 38 страниц из PDF отрендерены в `public/pages/`.

## Локальный запуск

```bash
npm install
npm run dev        # откроется http://localhost:5173
```

Сборка:

```bash
npm run build      # результат в папке dist/
npm run preview    # предпросмотр собранной версии
```

## Управление

- Стрелки ← / → или кнопки по краям — листать
- Ползунок внизу — перейти к любой странице
- 🔊 — включить/выключить звук перелистывания
- ⤢ — полный экран
- На телефоне листается свайпом, показывается по одной странице

## Деплой на GitHub Pages (автоматически)

1. Создайте репозиторий на GitHub и запушьте туда этот проект:
   ```bash
   git init
   git add .
   git commit -m "TK CREATIVE flipbook"
   git branch -M main
   git remote add origin https://github.com/ВАШ_ЛОГИН/ВАШ_РЕПО.git
   git push -u origin main
   ```
2. В репозитории: **Settings → Pages → Build and deployment → Source** выберите **GitHub Actions**.
3. Готово. При каждом пуше в `main` сайт пересобирается и публикуется
   (workflow лежит в `.github/workflows/deploy.yml`).

Адрес по умолчанию: `https://ВАШ_ЛОГИН.github.io/ВАШ_РЕПО/`

## Свой домен

`vite.config.js` уже использует `base: './'` — относительные пути,
поэтому сайт работает и на поддомене GitHub, и на корне вашего домена.
Ничего менять не нужно.

Чтобы привязать домен:
1. **Settings → Pages → Custom domain** — впишите домен (например `catalog.tkholding.kz`).
2. У регистратора домена добавьте CNAME-запись на `ВАШ_ЛОГИН.github.io`.
3. Включите **Enforce HTTPS**.

## Обновить страницы каталога

Если поменяется PDF — перегенерируйте картинки и положите в `public/pages/`
с именами `page-01.jpg … page-NN.jpg`. Если число страниц изменится,
поправьте `TOTAL_PAGES` в `src/App.jsx`.

Команда для рендера из PDF (нужен `poppler-utils`):
```bash
pdftoppm -jpeg -r 150 -jpegopt quality=85 TK.pdf public/pages/page
```
