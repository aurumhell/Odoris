"use strict";

(async function () {
    const $ = (id) => document.getElementById(id);
    const PLACEHOLDER = "assets/products/placeholder.svg";
    const categoryNames = {
        movies: "Кино", music: "Музыка", books: "Книги", games: "Игры", hobbies: "Хобби"
    };
    let currentProduct = null;
    let selectedVolume = "";
    let editMode = false;

    function text(id, value) {
        const node = $(id);
        if (node) node.textContent = value == null ? "" : String(value);
    }
    function setHidden(id, hidden) {
        const node = $(id);
        if (node) node.hidden = Boolean(hidden);
    }
    function localEdits(slug) {
        try { return JSON.parse(localStorage.getItem("odorisProductEdits") || "{}")[slug] || {}; }
        catch (_) { return {}; }
    }
    function updateCart(product, redirect) {
        try {
            const cart = JSON.parse(localStorage.getItem("odorisCart") || "[]");
            const volume = selectedVolume || "Объём не выбран";
            const found = cart.find((item) => item.slug === product.slug && item.volume === volume);
            if (found) found.quantity = (Number(found.quantity) || 1) + 1;
            else cart.push({ slug: product.slug, name: product.name, volume, quantity: 1 });
            localStorage.setItem("odorisCart", JSON.stringify(cart));
            const badge = document.querySelector('a[href="corzina.html"] .counter-badge');
            if (badge) badge.textContent = String(cart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0));
            text("perfume-action-message", "Аромат добавлен в корзину.");
            if (redirect) window.location.href = "corzina.html";
        } catch (error) {
            console.error("ODORIS cart:", error);
            text("perfume-action-message", "Не удалось обновить корзину в этом браузере.");
        }
    }
    function renderVolumes(product) {
        const host = $("perfume-volume-options");
        const block = $("perfume-volume-block");
        if (!host || !block) return;
        host.replaceChildren();
        const volumes = Array.isArray(product.volumeOptions) ? product.volumeOptions : [];
        if (!volumes.length && product.volume) {
            const span = document.createElement("span");
            span.className = "perfume-volume-empty";
            span.textContent = product.volume;
            host.appendChild(span);
            selectedVolume = "";
            return;
        }
        if (!volumes.length) {
            const span = document.createElement("span");
            span.className = "perfume-volume-empty";
            span.textContent = "Варианты объёма уточняются";
            host.appendChild(span);
            selectedVolume = "";
            return;
        }
        selectedVolume = volumes[0];
        volumes.forEach((volume, index) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "perfume-volume-option" + (index === 0 ? " is-selected" : "");
            button.textContent = volume;
            button.setAttribute("aria-pressed", index === 0 ? "true" : "false");
            button.addEventListener("click", () => {
                selectedVolume = volume;
                host.querySelectorAll("button").forEach((item) => {
                    const active = item === button;
                    item.classList.toggle("is-selected", active);
                    item.setAttribute("aria-pressed", active ? "true" : "false");
                });
            });
            host.appendChild(button);
        });
    }
    function renderNotes(product) {
        const host = $("perfume-notes-content");
        if (!host) return;
        host.replaceChildren();
        const pyramid = product.notesPyramid || {};
        const groups = [
            ["Верхние ноты", pyramid.top],
            ["Сердце", pyramid.heart],
            ["База", pyramid.base]
        ].filter((entry) => Array.isArray(entry[1]) && entry[1].length);
        if (groups.length) {
            const grid = document.createElement("div");
            grid.className = "perfume-note-pyramid";
            groups.forEach(([label, notes]) => {
                const block = document.createElement("div");
                block.className = "perfume-note-group";
                const heading = document.createElement("strong");
                heading.textContent = label;
                const p = document.createElement("p");
                p.textContent = notes.join(", ");
                block.append(heading, p);
                grid.appendChild(block);
            });
            host.appendChild(grid);
            return;
        }
        const notes = Array.isArray(product.keyNotes) ? product.keyNotes : [];
        if (!notes.length) {
            host.textContent = "Ноты аромата будут добавлены.";
            return;
        }
        const label = document.createElement("p");
        label.textContent = "Основные ноты:";
        const list = document.createElement("ul");
        list.className = "perfume-note-list";
        notes.forEach((note) => {
            const li = document.createElement("li");
            li.textContent = note;
            list.appendChild(li);
        });
        host.append(label, list);
    }
    function renderCharacteristics(product) {
        const host = $("perfume-characteristics-content");
        if (!host) return;
        host.replaceChildren();
        const c = product.characteristics || {};
        const fields = [
            ["Семейство", c.family || product.family], ["Характер", c.character],
            ["Сладость", c.sweetness], ["Свежесть", c.freshness],
            ["Цветочность", c.floral], ["Древесность", c.woody],
            ["Шлейф", c.trail], ["Впечатление", c.impression],
            ["Сезон", c.season], ["Время", c.time], ["Стиль", c.style]
        ].filter((entry) => entry[1]);
        if (!fields.length) {
            host.textContent = "Характеристики аромата будут добавлены.";
            return;
        }
        const grid = document.createElement("div");
        grid.className = "perfume-characteristics";
        fields.forEach(([label, value]) => {
            const p = document.createElement("p");
            const strong = document.createElement("strong");
            strong.textContent = label + ": ";
            p.append(strong, document.createTextNode(String(value)));
            grid.appendChild(p);
        });
        host.appendChild(grid);
    }
    function renderRelated(product, products) {
        const grid = $("perfume-related-grid");
        if (!grid) return;
        grid.replaceChildren();
        let related = Array.isArray(product.relatedSlugs)
            ? product.relatedSlugs.map((slug) => products.find((item) => item.slug === slug)).filter(Boolean)
            : [];
        if (!related.length) related = products.filter((item) => item.slug !== product.slug).slice(0, 4);
        related = related.filter((item) => item.slug !== product.slug).slice(0, 4);
        if (!related.length) {
            const p = document.createElement("p");
            p.className = "perfume-related-empty";
            p.textContent = "Рекомендации скоро появятся.";
            grid.appendChild(p);
            return;
        }
        related.forEach((item) => {
            const a = document.createElement("a");
            a.className = "perfume-related-card";
            a.href = "product.html?slug=" + encodeURIComponent(item.slug);
            const imageWrap = document.createElement("div");
            imageWrap.className = "perfume-related-image";
            const img = document.createElement("img");
            img.src = item.image || PLACEHOLDER;
            img.alt = "Флакон " + (item.name || "аромата");
            img.onerror = () => { img.src = PLACEHOLDER; };
            imageWrap.appendChild(img);
            const name = document.createElement("p");
            name.className = "perfume-related-name";
            name.textContent = item.name || "Аромат ODORIS";
            const price = document.createElement("p");
            price.className = "perfume-related-price";
            price.textContent = item.price || "Цена уточняется";
            a.append(imageWrap, name, price);
            grid.appendChild(a);
        });
    }
    function setEditing(enabled) {
        editMode = enabled;
        document.body.classList.toggle("is-editing", editMode);
        ["perfume-description", "perfume-notes-content", "perfume-characteristics-content"].forEach((id) => {
            const node = $(id);
            if (node) node.contentEditable = editMode ? "true" : "false";
        });
        const button = $("perfume-edit-button");
        if (button) {
            button.setAttribute("aria-label", editMode ? "Завершить редактирование" : "Редактировать описание");
            button.title = editMode ? "Завершить редактирование" : "Редактировать";
        }
        text("perfume-edit-status", editMode ? "Режим редактирования. После изменений нажмите «Сохранить изменения»." : "");
    }
    function saveEdits() {
        if (!currentProduct) return;
        try {
            const store = JSON.parse(localStorage.getItem("odorisProductEdits") || "{}");
            store[currentProduct.slug] = {
                description: $("perfume-description").innerText.trim(),
                notesHtml: $("perfume-notes-content").innerHTML,
                characteristicsHtml: $("perfume-characteristics-content").innerHTML
            };
            localStorage.setItem("odorisProductEdits", JSON.stringify(store));
            setEditing(false);
            text("perfume-edit-status", "Изменения сохранены в этом браузере.");
        } catch (error) {
            console.error("ODORIS product save:", error);
            text("perfume-edit-status", "Не удалось сохранить изменения.");
        }
    }
    function applySavedEdits(product) {
        const saved = localEdits(product.slug);
        if (saved.description) text("perfume-description", saved.description);
        if (saved.notesHtml) $("perfume-notes-content").innerHTML = saved.notesHtml;
        if (saved.characteristicsHtml) $("perfume-characteristics-content").innerHTML = saved.characteristicsHtml;
    }

    try {
        const slug = new URLSearchParams(window.location.search).get("slug");
        if (!slug) throw new Error("В адресе страницы не указан slug аромата.");
        const response = await fetch("data/fragrances.json", { cache: "no-store" });
        if (!response.ok) throw new Error("Не удалось загрузить базу ароматов: " + response.status);
        const products = await response.json();
        if (!Array.isArray(products)) throw new Error("База ароматов должна быть JSON-массивом.");
        const product = products.find((item) => item && item.slug === slug);
        if (!product) throw new Error("Аромат «" + slug + "» не найден в базе.");
        currentProduct = product;
        document.title = (product.name || "Аромат") + " — ODORIS";
        text("product-breadcrumb-name", product.name || "Аромат");
        const category = categoryNames[product.interestCategory] || "Каталог";
        const categoryLink = $("product-category-link");
        if (categoryLink) {
            categoryLink.textContent = category;
            categoryLink.href = product.interestCategory ? "interests.html#" + product.interestCategory : "collection.html";
        }
        text("perfume-brand", product.brand || "ODORIS");
        text("perfume-name", product.name || "Аромат");
        text("perfume-subtitle", product.titleRu || product.fullName || "");
        text("perfume-description", product.description || "Описание аромата будет добавлено.");
        if (product.price) {
            text("perfume-price", product.price);
            setHidden("perfume-price", false);
        } else {
            text("perfume-price", "Стоимость уточняется");
            setHidden("perfume-price", false);
        }
        if (product.article) {
            text("perfume-article", "Артикул: " + product.article);
            setHidden("perfume-article", false);
        }
        if (product.ratingCount) {
            text("perfume-rating-count", product.ratingCount);
            setHidden("perfume-rating", false);
        }
        const img = $("perfume-image");
        if (img) {
            img.src = product.image || PLACEHOLDER;
            img.alt = "Флакон " + (product.name || "парфюма");
            img.onerror = function () {
                if (product.imageUrl && img.src !== product.imageUrl) img.src = product.imageUrl;
                else img.src = PLACEHOLDER;
            };
        }
        renderVolumes(product);
        renderNotes(product);
        renderCharacteristics(product);
        renderRelated(product, products);
        setHidden("perfume-editorial-note", !product.interestCategory);
        applySavedEdits(product);

        $("perfume-edit-button").addEventListener("click", () => setEditing(!editMode));
        $("perfume-save-button").addEventListener("click", saveEdits);
        $("perfume-cart-button").addEventListener("click", () => updateCart(product, false));
        $("perfume-buy-button").addEventListener("click", () => updateCart(product, true));

        setHidden("product-loading", true);
        setHidden("perfume-detail", false);
    } catch (error) {
        console.error("ODORIS product page:", error);
        setHidden("product-loading", true);
        setHidden("product-not-found", false);
        const message = $("product-not-found").querySelector("p");
        if (message) message.textContent = error.message + " Запустите сайт через локальный сервер и проверьте data/fragrances.json.";
    }
})();
