/* ODORIS storefront interactions. */
(() => {
    "use strict";

    const STORAGE = {
        session: "odorisSession",
        users: "odorisUsers",
        cart: "odorisCart",
        favorites: "odorisFavorites",
        addresses: "odorisAddresses",
        activeAddress: "odorisActiveAddress",
        productEdits: "odorisProductEdits"
    };
    const ADMIN_EMAIL = "admin@odoris.ru";
    const ADMIN_PASSWORD = "Odoris2026!";
    const LEGACY_SLUGS = ["autumn-dore", "eclat-verte", "velvet-noir", "rose-de-damas", "solar-ambience", "the-blanc", "brise-marine", "fleur-celeste", "soleil-dor", "rouge-solaire", "bleu-mineral", "nuit-profonde"];
    let products = [];
    let initialized = false;

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

    function read(key, fallback) {
        try {
            const value = localStorage.getItem(key);
            return value == null ? fallback : JSON.parse(value);
        } catch (error) {
            console.warn("ODORIS storage read:", key, error);
            return fallback;
        }
    }

    function write(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error("ODORIS storage write:", key, error);
            return false;
        }
    }

    function session() {
        const value = read(STORAGE.session, null);
        return value && typeof value === "object" ? value : null;
    }

    function isAdmin() {
        return session()?.role === "admin";
    }

    function safeText(value) {
        return String(value == null ? "" : value);
    }

    function slugFromLink(link) {
        try {
            return new URL(link.getAttribute("href"), window.location.href).searchParams.get("slug");
        } catch (_) {
            return null;
        }
    }

    function priceValue(price) {
        const value = Number(String(price || "").replace(/[^0-9]/g, ""));
        return Number.isFinite(value) ? value : 0;
    }

    function money(value) {
        return new Intl.NumberFormat("ru-RU").format(Math.max(0, Number(value) || 0)) + " ₽";
    }

    function currentCart() {
        let cart = read(STORAGE.cart, []);
        if (!Array.isArray(cart)) cart = [];
        if (!cart.length && localStorage.getItem(STORAGE.cart) === null) {
            const legacy = read("odoris-cart", null);
            if (legacy && typeof legacy === "object" && !Array.isArray(legacy)) {
                cart = Object.entries(legacy).map(([index, quantity]) => ({
                    slug: LEGACY_SLUGS[Number(index)], quantity: Number(quantity) || 0, volume: "Стандартный объём"
                })).filter(item => item.slug && item.quantity > 0);
            }
        }
        return cart.filter(item => item && item.slug).map(item => ({
            slug: String(item.slug),
            name: safeText(item.name),
            volume: safeText(item.volume || "Стандартный объём"),
            quantity: Math.max(1, Math.min(99, Number(item.quantity) || 1))
        }));
    }

    function currentFavorites() {
        let values = read(STORAGE.favorites, []);
        if (!Array.isArray(values)) values = [];
        if (!values.length && localStorage.getItem(STORAGE.favorites) === null) {
            const legacy = read("odoris-favorites", []);
            if (Array.isArray(legacy)) values = legacy.map(value => typeof value === "number" ? LEGACY_SLUGS[value] : value).filter(Boolean);
        }
        return Array.from(new Set(values.map(String)));
    }

    function product(slug) {
        return products.find(item => item && item.slug === slug) || null;
    }

    function updateHeader() {
        const user = session();
        const account = $("#header-account-link");
        if (account) {
            account.href = user ? "profile.html" : "auth.html";
            account.title = user ? `Личный кабинет: ${safeText(user.name || user.email)}` : "Войти или зарегистрироваться";
            account.setAttribute("aria-label", account.title);
        }

        const address = getActiveAddress();
        const city = $("[data-current-city]");
        if (city) city.textContent = address?.city || "Выбрать адрес";

        const favoritesLink = $('a.header-action[href="favorite.html"]');
        const cartLink = $('a.header-action[href="corzina.html"]');
        setCounter(favoritesLink, currentFavorites().length);
        setCounter(cartLink, currentCart().reduce((sum, item) => sum + item.quantity, 0));
    }

    function setCounter(link, count) {
        if (!link) return;
        let badge = $(".odoris-counter", link);
        if (!badge) {
            badge = document.createElement("span");
            badge.className = "odoris-counter";
            link.appendChild(badge);
        }
        badge.textContent = String(count);
        badge.hidden = count < 1;
    }

    function addToCart(slug, volume) {
        const item = product(slug);
        if (!item) return false;
        const cart = currentCart();
        const selected = volume || (Array.isArray(item.volumeOptions) && item.volumeOptions[0]) || item.volume || "Стандартный объём";
        const found = cart.find(entry => entry.slug === slug && entry.volume === selected);
        if (found) found.quantity = Math.min(99, found.quantity + 1);
        else cart.push({ slug, name: item.name, volume: selected, quantity: 1 });
        const saved = write(STORAGE.cart, cart);
        updateHeader();
        renderCartPage();
        return saved;
    }

    function toggleFavorite(slug) {
        if (!product(slug)) return false;
        const favorites = currentFavorites();
        const index = favorites.indexOf(slug);
        if (index >= 0) favorites.splice(index, 1);
        else favorites.push(slug);
        write(STORAGE.favorites, favorites);
        updateFavoriteButtons();
        updateHeader();
        renderFavoritesPage();
        return index < 0;
    }

    function createActionIcon(kind) {
        const ns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(ns, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
        const path = document.createElementNS(ns, "path");
        const paths = {
            heart: "M20.8 4.9a5.4 5.4 0 0 0-7.6 0L12 6.1l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6l1.2 1.2L12 21l7.6-7.3 1.2-1.2a5.4 5.4 0 0 0 0-7.6Z",
            cart: "M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 1.9-1.4L21 8H6 M9.5 20h.01 M17.5 20h.01",
            check: "m5 12 4 4L19 6"
        };
        path.setAttribute("d", paths[kind] || paths.cart);
        svg.appendChild(path);
        return svg;
    }

    function setActionIcon(button, kind) {
        if (button) button.replaceChildren(createActionIcon(kind));
    }

    function updateFavoriteButtons() {
        const favorites = currentFavorites();
        $$('[data-store-action="favorite"]').forEach(button => {
            const active = favorites.includes(button.dataset.slug);
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-pressed", String(active));
            setActionIcon(button, "heart");
            button.title = active ? "Убрать из избранного" : "В избранное";
            button.setAttribute("aria-label", button.title);
        });
    }

    function createStoreButton(action, slug, label) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `odoris-icon-action odoris-icon-action--${action}`;
        button.dataset.storeAction = action;
        button.dataset.slug = slug;
        button.setAttribute("aria-label", label);
        button.title = label;
        setActionIcon(button, action === "favorite" ? "heart" : "cart");
        if (action === "favorite") {
            const active = currentFavorites().includes(slug);
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-pressed", String(active));
        }
        return button;
    }

    function decorateProductCards(root = document) {
        $$('a[href*="product.html?slug="]', root).forEach(link => {
            const slug = slugFromLink(link);
            if (!slug || link.closest(".perfume-related-card")) return;
            const host = link.closest(".catalog-card-wrap, .catalog-product, .col-md-2, .hit-card-wrap") || link.parentElement;
            if (!host || $(".odoris-card-actions", host)) return;
            host.classList.add("odoris-card-shell");
            const actions = document.createElement("div");
            actions.className = "odoris-card-actions";
            actions.append(
                createStoreButton("favorite", slug, "В избранное"),
                createStoreButton("cart", slug, "Добавить в корзину")
            );
            host.appendChild(actions);
        });
        updateFavoriteButtons();
    }

    function createProductCard(item, options = {}) {
        const article = document.createElement("article");
        article.className = "odoris-store-card";
        const link = document.createElement("a");
        link.className = "odoris-store-card__link";
        link.href = `product.html?slug=${encodeURIComponent(item.slug)}`;
        const image = document.createElement("img");
        image.src = item.image || "assets/products/placeholder.svg";
        image.alt = `Флакон ${item.name || "аромата"}`;
        image.loading = "lazy";
        image.onerror = () => { image.src = "assets/products/placeholder.svg"; };
        const title = document.createElement("h2");
        title.textContent = item.name || "Аромат ODORIS";
        const subtitle = document.createElement("p");
        subtitle.textContent = item.family || item.brand || "Парфюмерная композиция";
        const price = document.createElement("strong");
        price.textContent = item.price || "Цена уточняется";
        link.append(image, title, subtitle, price);
        const actions = document.createElement("div");
        actions.className = "odoris-store-card__actions";
        actions.append(
            createStoreButton("favorite", item.slug, "Убрать из избранного"),
            createStoreButton("cart", item.slug, "Добавить в корзину")
        );
        article.append(link, actions);
        if (options.removable) {
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "odoris-text-button";
            remove.dataset.storeAction = "favorite";
            remove.dataset.slug = item.slug;
            remove.textContent = "Убрать из избранного";
            article.appendChild(remove);
        }
        return article;
    }

    function renderFavoritesPage() {
        if (!location.pathname.endsWith("favorite.html")) return;
        const host = ensureUtilityHost("favorites");
        if (!host) return;
        host.replaceChildren();
        const list = currentFavorites().map(product).filter(Boolean);
        if (!list.length) {
            host.appendChild(emptyState("♡", "В избранном пока ничего нет", "Сохраняйте ароматы, которые хотите сравнить или к которым планируете вернуться позже."));
            return;
        }
        const grid = document.createElement("div");
        grid.className = "odoris-store-grid";
        list.forEach(item => grid.appendChild(createProductCard(item, { removable: true })));
        host.appendChild(grid);
    }

    function renderCartPage() {
        if (!location.pathname.endsWith("corzina.html")) return;
        const host = ensureUtilityHost("cart");
        if (!host) return;
        host.replaceChildren();
        const cart = currentCart();
        if (!cart.length) {
            host.appendChild(emptyState("◇", "Корзина пока пуста", "Добавьте понравившиеся ароматы из каталога, чтобы вернуться к ним перед оформлением заказа."));
            return;
        }

        const list = document.createElement("div");
        list.className = "odoris-cart-list";
        let total = 0;
        cart.forEach(entry => {
            const item = product(entry.slug);
            if (!item) return;
            const price = priceValue(item.price);
            total += price * entry.quantity;
            const row = document.createElement("article");
            row.className = "odoris-cart-row";
            const img = document.createElement("img");
            img.src = item.image || "assets/products/placeholder.svg";
            img.alt = `Флакон ${item.name}`;
            const info = document.createElement("div");
            info.className = "odoris-cart-row__info";
            const title = document.createElement("a");
            title.href = `product.html?slug=${encodeURIComponent(item.slug)}`;
            title.textContent = item.name;
            const volume = document.createElement("p");
            volume.textContent = entry.volume;
            const quantity = document.createElement("div");
            quantity.className = "odoris-quantity";
            const minus = actionButton("−", "decrease", entry.slug, "Уменьшить количество");
            const count = document.createElement("span");
            count.textContent = String(entry.quantity);
            const plus = actionButton("+", "increase", entry.slug, "Увеличить количество");
            quantity.append(minus, count, plus);
            info.append(title, volume, quantity);
            const amount = document.createElement("strong");
            amount.className = "odoris-cart-row__price";
            amount.textContent = money(price * entry.quantity);
            const remove = actionButton("Удалить", "remove", entry.slug, "Удалить из корзины");
            remove.classList.add("odoris-text-button");
            row.append(img, info, amount, remove);
            list.appendChild(row);
        });

        const summary = document.createElement("div");
        summary.className = "odoris-cart-summary";
        const caption = document.createElement("span");
        caption.textContent = "Итого";
        const amount = document.createElement("strong");
        amount.textContent = money(total);
        summary.append(caption, amount);
        host.append(list, summary);
    }

    function actionButton(label, action, slug, ariaLabel) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.dataset.storeAction = action;
        button.dataset.slug = slug;
        button.setAttribute("aria-label", ariaLabel);
        return button;
    }

    function emptyState(mark, titleText, descriptionText) {
        const section = document.createElement("section");
        section.className = "utility-empty-state";
        const icon = document.createElement("div");
        icon.className = "utility-empty-state__mark";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = mark;
        const title = document.createElement("h2");
        title.textContent = titleText;
        const description = document.createElement("p");
        description.textContent = descriptionText;
        const link = document.createElement("a");
        link.className = "btn btn-primary";
        link.href = "collection.html";
        link.textContent = "Перейти в каталог";
        section.append(icon, title, description, link);
        return section;
    }

    function ensureUtilityHost(kind) {
        const old = $(".utility-empty-state");
        if (old) {
            const host = document.createElement("div");
            host.className = "odoris-utility-content";
            host.id = kind === "cart" ? "odoris-cart-content" : "odoris-favorites-content";
            old.replaceWith(host);
            return host;
        }
        return $(kind === "cart" ? "#odoris-cart-content" : "#odoris-favorites-content");
    }

    function updateCartQuantity(slug, delta) {
        const cart = currentCart();
        const item = cart.find(entry => entry.slug === slug);
        if (!item) return;
        item.quantity = Math.max(0, Math.min(99, item.quantity + delta));
        write(STORAGE.cart, cart.filter(entry => entry.quantity > 0));
        updateHeader();
        renderCartPage();
    }

    function removeCartItem(slug) {
        write(STORAGE.cart, currentCart().filter(item => item.slug !== slug));
        updateHeader();
        renderCartPage();
    }

    function getAddresses() {
        let addresses = read(STORAGE.addresses, null);
        if (Array.isArray(addresses) && addresses.length) return addresses;

        const oldCards = $$(".address-item-card");
        if (oldCards.length) {
            addresses = oldCards.map((card, index) => {
                const rawAddress = $(".address-street", card)?.textContent.trim() || "";
                const match = rawAddress.match(/^г\.?\s*([^,]+),\s*(.*)$/i);
                return {
                    id: `address-${index + 1}`,
                    title: $(".address-title", card)?.textContent.trim() || `Адрес ${index + 1}`,
                    city: match ? match[1].trim() : "Москва",
                    street: match ? match[2].trim() : rawAddress,
                    extra: $(".address-extra", card)?.textContent.trim() || "",
                    isDefault: card.classList.contains("is-main") || index === 0
                };
            });
        } else {
            addresses = [{ id: "home", title: "Домашний адрес", city: "Москва", street: "", extra: "", isDefault: true }];
        }
        if (oldCards.length) write(STORAGE.addresses, addresses);
        return addresses;
    }

    function saveAddresses(addresses) {
        write(STORAGE.addresses, addresses);
        updateHeader();
        renderProfileAddresses();
    }

    function getActiveAddress() {
        const addresses = getAddresses();
        const selectedId = read(STORAGE.activeAddress, null);
        return addresses.find(item => item.id === selectedId) || addresses.find(item => item.isDefault) || addresses[0] || null;
    }

    function openAddressDialog(addressId) {
        const addresses = getAddresses();
        let current = addressId === "__new__" ? null : (addresses.find(item => item.id === addressId) || getActiveAddress());
        let editingId = current?.id || null;
        const overlay = document.createElement("div");
        overlay.className = "odoris-modal-backdrop";
        overlay.innerHTML = `
            <section class="odoris-modal" role="dialog" aria-modal="true" aria-labelledby="odoris-address-title">
                <button type="button" class="odoris-modal-close" aria-label="Закрыть">×</button>
                <p class="odoris-auth-eyebrow">ODORIS · DELIVERY</p>
                <h2 id="odoris-address-title">Адрес доставки</h2>
                <label for="odoris-address-select">Сохранённые адреса</label>
                <select id="odoris-address-select"></select>
                <button type="button" class="odoris-text-button odoris-new-address">＋ Добавить новый адрес</button>
                <form id="odoris-address-form" class="odoris-auth-form">
                    <label for="odoris-address-name">Название</label>
                    <input id="odoris-address-name" name="title" type="text" required maxlength="50">
                    <label for="odoris-address-city">Город</label>
                    <input id="odoris-address-city" name="city" type="text" required maxlength="80">
                    <label for="odoris-address-street">Улица, дом, квартира</label>
                    <input id="odoris-address-street" name="street" type="text" placeholder="Улица, дом, квартира" maxlength="180">
                    <label for="odoris-address-extra">Комментарий курьеру</label>
                    <input id="odoris-address-extra" name="extra" type="text" placeholder="Подъезд, этаж, домофон" maxlength="180">
                    <label class="odoris-check-label"><input id="odoris-address-default" type="checkbox"> Сделать основным адресом</label>
                    <button class="odoris-auth-submit" type="submit">Сохранить адрес</button>
                </form>
                <p class="odoris-auth-message" id="odoris-address-message" role="status"></p>
            </section>`;
        document.body.appendChild(overlay);

        const select = $("#odoris-address-select", overlay);
        const form = $("#odoris-address-form", overlay);
        const field = id => $(`#${id}`, overlay);
        const fill = address => {
            current = address || null;
            editingId = address?.id || null;
            field("odoris-address-name").value = address?.title || "Домашний адрес";
            field("odoris-address-city").value = address?.city || "";
            field("odoris-address-street").value = address?.street || "";
            field("odoris-address-extra").value = address?.extra || "";
            field("odoris-address-default").checked = Boolean(address?.isDefault) || addresses.length === 0;
        };
        const refreshOptions = () => {
            select.replaceChildren();
            addresses.forEach(address => {
                const option = document.createElement("option");
                option.value = address.id;
                option.textContent = `${address.title} — ${address.city}`;
                select.appendChild(option);
            });
            const addOption = document.createElement("option");
            addOption.value = "__new__";
            addOption.textContent = "Новый адрес…";
            select.appendChild(addOption);
            if (editingId && addresses.some(item => item.id === editingId)) select.value = editingId;
            else select.value = "__new__";
        };
        refreshOptions();
        fill(current);
        if (editingId) select.value = editingId;
        else select.value = "__new__";

        const close = () => overlay.remove();
        $(".odoris-modal-close", overlay).addEventListener("click", close);
        overlay.addEventListener("click", event => { if (event.target === overlay) close(); });
        select.addEventListener("change", () => {
            if (select.value === "__new__") fill(null);
            else fill(addresses.find(item => item.id === select.value));
        });
        $(".odoris-new-address", overlay).addEventListener("click", () => {
            fill(null);
            select.value = "__new__";
            field("odoris-address-name").focus();
        });
        form.addEventListener("submit", event => {
            event.preventDefault();
            const data = new FormData(form);
            const next = {
                id: editingId || `address-${Date.now()}`,
                title: String(data.get("title") || "Адрес доставки").trim(),
                city: String(data.get("city") || "").trim(),
                street: String(data.get("street") || "").trim(),
                extra: String(data.get("extra") || "").trim(),
                isDefault: field("odoris-address-default").checked
            };
            if (!next.city) {
                field("odoris-address-message").textContent = "Укажите город.";
                return;
            }
            let updated = addresses.slice();
            if (next.isDefault) updated = updated.map(item => ({ ...item, isDefault: false }));
            const index = updated.findIndex(item => item.id === next.id);
            if (index >= 0) updated[index] = next;
            else updated.push(next);
            if (!updated.some(item => item.isDefault)) updated[0].isDefault = true;
            saveAddresses(updated);
            write(STORAGE.activeAddress, next.id);
            updateHeader();
            close();
        });
    }

    function renderProfileAddresses() {
        const grid = $(".address-grid");
        if (!grid) return;
        const addresses = getAddresses();
        grid.replaceChildren();
        addresses.forEach(address => {
            const card = document.createElement("article");
            card.className = "address-item-card" + (address.isDefault ? " is-main" : "");
            if (address.isDefault) {
                const mark = document.createElement("span");
                mark.className = "main-address-mark";
                mark.textContent = "Основной";
                card.appendChild(mark);
            }
            const title = document.createElement("h3");
            title.className = "address-title";
            title.textContent = address.title;
            const street = document.createElement("p");
            street.className = "address-street";
            street.textContent = [address.city, address.street].filter(Boolean).join(", ") || address.city;
            const extra = document.createElement("p");
            extra.className = "address-extra";
            extra.textContent = address.extra || "Дополнительные сведения не указаны";
            const actions = document.createElement("div");
            actions.className = "address-links";
            const edit = document.createElement("button");
            edit.type = "button";
            edit.className = "link-btn";
            edit.dataset.profileAddressEdit = address.id;
            edit.textContent = "Редактировать";
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "link-btn remove";
            remove.dataset.profileAddressRemove = address.id;
            remove.textContent = "Удалить";
            actions.append(edit, remove);
            if (!address.isDefault) {
                const makeDefault = document.createElement("button");
                makeDefault.type = "button";
                makeDefault.className = "link-btn";
                makeDefault.dataset.profileAddressDefault = address.id;
                makeDefault.textContent = "Сделать основным";
                actions.appendChild(makeDefault);
            }
            card.append(title, street, extra, actions);
            grid.appendChild(card);
        });
        const add = document.createElement("button");
        add.type = "button";
        add.className = "address-new-card";
        add.innerHTML = '<span class="plus-symbol">+</span><span>Добавить новый адрес</span>';
        add.dataset.profileAddressAdd = "true";
        grid.appendChild(add);
    }

    function initProfile() {
        if (!$(".profile-grid")) return;
        const user = session();
        const grid = $(".profile-grid");
        if (!user) {
            grid.hidden = true;
            let notice = $(".odoris-profile-login");
            if (!notice) {
                notice = document.createElement("section");
                notice.className = "odoris-profile-login utility-empty-state";
                notice.innerHTML = '<div class="utility-empty-state__mark">◇</div><h2>Войдите в личный кабинет</h2><p>Для просмотра профиля и управления адресами необходимо авторизоваться.</p><a class="btn btn-primary" href="auth.html">Войти или зарегистрироваться</a>';
                grid.parentElement.insertBefore(notice, grid);
            }
            return;
        }
        grid.hidden = false;
        const admin = user.role === "admin";
        document.body.classList.toggle("odoris-is-admin", admin);
        const ordersStack = $(".orders-stack");
        if (ordersStack && !admin) {
            // Existing order records belong to the admin view; a new customer starts with no orders.
            ordersStack.replaceChildren();
            const empty = document.createElement("div");
            empty.className = "odoris-order-empty";
            empty.setAttribute("role", "status");
            const title = document.createElement("h3");
            title.textContent = "Пока нет заказов";
            const message = document.createElement("p");
            message.textContent = "Когда вы оформите первую покупку, она появится здесь.";
            const link = document.createElement("a");
            link.href = "collection.html";
            link.textContent = "Перейти в каталог";
            empty.append(title, message, link);
            ordersStack.appendChild(empty);
        }
        const name = $(".user-fullname");
        if (name) name.textContent = user.name || user.email;
        const badge = $(".user-badge");
        if (badge) badge.textContent = user.role === "admin" ? "Администратор ODORIS" : "Клиент ODORIS";
        const profile = user.profile || {};
        const nameParts = safeText(user.name).trim().split(/\s+/).filter(Boolean);
        const fName = $("#fName");
        const lName = $("#lName");
        const userEmail = $("#userEmail");
        if (fName) fName.value = profile.firstName || nameParts[0] || "";
        if (lName) lName.value = profile.lastName || nameParts.slice(1).join(" ");
        if (userEmail) userEmail.value = user.email || "";
        if ($("#userPhone")) $("#userPhone").value = profile.phone || "";
        if ($("#birthDate")) $("#birthDate").value = profile.birthDate || "";
        if ($("#preferredCategory") && profile.preferredCategory) $("#preferredCategory").value = profile.preferredCategory;
        const saveButton = $("#personal-data .btn-bordo");
        if (saveButton && !saveButton.dataset.bound) {
            saveButton.dataset.bound = "true";
            saveButton.addEventListener("click", () => {
                const next = session() || {};
                const firstName = $("#fName")?.value.trim() || "";
                const lastName = $("#lName")?.value.trim() || "";
                next.name = [firstName, lastName].filter(Boolean).join(" ") || next.name;
                next.profile = { ...(next.profile || {}), firstName, lastName, phone: $("#userPhone")?.value || "", birthDate: $("#birthDate")?.value || "", preferredCategory: $("#preferredCategory")?.value || "" };
                write(STORAGE.session, next);
                const heading = $(".user-fullname");
                if (heading) heading.textContent = next.name;
                const status = document.createElement("p");
                status.className = "odoris-profile-status";
                status.textContent = "Данные сохранены в этом браузере.";
                saveButton.parentElement.appendChild(status);
                updateHeader();
            });
        }
        renderProfileAddresses();
    }

    function applyAdminProductEdits() {
        const name = $("#perfume-name");
        if (!name) return;
        const slug = new URLSearchParams(location.search).get("slug");
        if (!slug) return;
        const edits = read(STORAGE.productEdits, {})[slug] || {};
        if (edits.productName && name.textContent !== edits.productName) name.textContent = edits.productName;
        const brand = $("#perfume-brand");
        const subtitle = $("#perfume-subtitle");
        const price = $("#perfume-price");
        if (edits.brand && brand && brand.textContent !== edits.brand) brand.textContent = edits.brand;
        if (edits.subtitle && subtitle && subtitle.textContent !== edits.subtitle) subtitle.textContent = edits.subtitle;
        if (edits.productPrice && price && price.textContent !== edits.productPrice) price.textContent = edits.productPrice;
    }

    function initProductAdmin() {
        const detail = $("#perfume-detail");
        if (!detail) return;
        const editButton = $("#perfume-edit-button");
        const saveButton = $("#perfume-save-button");
        const saveRow = $(".perfume-save-row");
        const favorite = document.createElement("button");
        favorite.type = "button";
        favorite.className = "perfume-favorite-button";
        favorite.dataset.storeAction = "favorite";
        favorite.dataset.slug = new URLSearchParams(location.search).get("slug") || "";
        favorite.setAttribute("aria-label", "Добавить аромат в избранное");
        setActionIcon(favorite, "heart");
        const actions = $(".perfume-actions");
        if (actions && !$(".perfume-favorite-button", actions)) actions.appendChild(favorite);

        const admin = isAdmin();
        document.body.classList.toggle("odoris-is-admin", admin);
        if (editButton) editButton.hidden = !admin;
        if (saveRow) saveRow.hidden = !admin;
        if (!admin) {
            ["#perfume-description", "#perfume-notes-content", "#perfume-characteristics-content", "#perfume-name", "#perfume-brand", "#perfume-subtitle", "#perfume-price"].forEach(selector => {
                const node = $(selector);
                if (node) node.contentEditable = "false";
            });
        }

        if (admin) {
            const editableSelectors = ["#perfume-name", "#perfume-brand", "#perfume-subtitle", "#perfume-price"];
            const syncEditing = () => editableSelectors.forEach(selector => {
                const node = $(selector);
                if (node) node.contentEditable = document.body.classList.contains("is-editing") ? "true" : "false";
            });
            const observer = new MutationObserver(syncEditing);
            observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
            syncEditing();
            if (saveButton && !saveButton.dataset.extraBound) {
                saveButton.dataset.extraBound = "true";
                saveButton.addEventListener("click", () => {
                    document.body.dataset.odorisSavingProduct = "true";
                    setTimeout(() => {
                        const slug = new URLSearchParams(location.search).get("slug");
                        if (slug) {
                            const all = read(STORAGE.productEdits, {});
                            all[slug] = {
                                ...(all[slug] || {}),
                                productName: $("#perfume-name")?.textContent.trim() || "",
                                brand: $("#perfume-brand")?.textContent.trim() || "",
                                subtitle: $("#perfume-subtitle")?.textContent.trim() || "",
                                productPrice: $("#perfume-price")?.textContent.trim() || ""
                            };
                            write(STORAGE.productEdits, all);
                        }
                        delete document.body.dataset.odorisSavingProduct;
                    }, 0);
                }, true);
            }
        }

        applyAdminProductEdits();
        setTimeout(applyAdminProductEdits, 350);
        const nameNode = $("#perfume-name");
        if (nameNode) {
            const observer = new MutationObserver(() => {
                if (!document.body.classList.contains("is-editing") && !document.body.dataset.odorisSavingProduct) applyAdminProductEdits();
            });
            observer.observe(nameNode, { childList: true, characterData: true, subtree: true });
            setTimeout(() => observer.disconnect(), 2500);
        }
        updateFavoriteButtons();
    }

    // Russian/English keyboard-layout correction (ЙЦУКЕН <-> QWERTY).
    const EN_LAYOUT = "`qwertyuiop[]asdfghjkl;'zxcvbnm,./";
    const RU_LAYOUT = "ёйцукенгшщзхъфывапролджэячсмитьбю.";
    const EN_TO_RU = new Map();
    const RU_TO_EN = new Map();
    for (let index = 0; index < Math.min(EN_LAYOUT.length, RU_LAYOUT.length); index += 1) {
        EN_TO_RU.set(EN_LAYOUT[index], RU_LAYOUT[index]);
        RU_TO_EN.set(RU_LAYOUT[index], EN_LAYOUT[index]);
    }

    function swapKeyboardLayout(value, mapping) {
        return Array.from(String(value)).map(character => {
            const lower = character.toLowerCase();
            const mapped = mapping.get(lower);
            return mapped ? (character === lower ? mapped : mapped.toUpperCase()) : character;
        }).join("");
    }

    function normalizeSearchText(value) {
        return String(value == null ? "" : value)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/ё/g, "е")
            .replace(/[^\p{L}\p{N}]+/gu, " ")
            .trim();
    }

    function editDistance(left, right, cutoff = 2) {
        if (Math.abs(left.length - right.length) > cutoff) return cutoff + 1;
        let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
        for (let row = 1; row <= left.length; row += 1) {
            const current = [row];
            let rowMinimum = row;
            for (let column = 1; column <= right.length; column += 1) {
                const cost = left[row - 1] === right[column - 1] ? 0 : 1;
                current[column] = Math.min(
                    current[column - 1] + 1,
                    previous[column] + 1,
                    previous[column - 1] + cost
                );
                rowMinimum = Math.min(rowMinimum, current[column]);
            }
            if (rowMinimum > cutoff) return cutoff + 1;
            previous = current;
        }
        return previous[right.length];
    }

    function tokenMatchScore(queryToken, candidateToken, weight) {
        if (candidateToken === queryToken) return weight;
        if (candidateToken.startsWith(queryToken)) return weight * 0.82;
        if (candidateToken.includes(queryToken)) return weight * 0.68;
        if (queryToken.length >= 4) {
            const limit = queryToken.length >= 7 ? 2 : 1;
            const distance = editDistance(queryToken, candidateToken, limit);
            if (distance <= limit) return weight * (distance === 1 ? 0.48 : 0.34);
        }
        return 0;
    }

    function getProductSearchFields(item) {
        const primary = [item.name, item.fullName, item.titleRu, ...(Array.isArray(item.aliases) ? item.aliases : [])]
            .filter(Boolean).join(" ");
        const secondary = [item.brand, item.brandLine, item.family, item.concentration, item.volume,
            item.recommendedFor, item.description, ...(Array.isArray(item.keyNotes) ? item.keyNotes : [])]
            .filter(Boolean).join(" ");
        return { primary: normalizeSearchText(primary), secondary: normalizeSearchText(secondary) };
    }

    function scoreProductSearch(query, item) {
        const forms = [query, swapKeyboardLayout(query, EN_TO_RU), swapKeyboardLayout(query, RU_TO_EN)]
            .map(normalizeSearchText)
            .filter((value, index, all) => value && all.indexOf(value) === index);
        const fields = getProductSearchFields(item);
        const allText = `${fields.primary} ${fields.secondary}`;
        let bestScore = 0;

        forms.forEach(form => {
            const queryTokens = form.split(/\s+/).filter(Boolean);
            if (!queryTokens.length) return;
            const primaryTokens = fields.primary.split(/\s+/).filter(Boolean);
            const secondaryTokens = fields.secondary.split(/\s+/).filter(Boolean);
            let total = 0;
            let matched = 0;

            queryTokens.forEach(token => {
                let bestPrimary = 0;
                let bestSecondary = 0;
                primaryTokens.forEach(candidate => {
                    bestPrimary = Math.max(bestPrimary, tokenMatchScore(token, candidate, 50));
                });
                secondaryTokens.forEach(candidate => {
                    bestSecondary = Math.max(bestSecondary, tokenMatchScore(token, candidate, 24));
                });
                const tokenScore = Math.max(bestPrimary, bestSecondary);
                if (tokenScore > 0) matched += 1;
                total += tokenScore;
            });

            const coverage = matched / queryTokens.length;
            if (coverage < 1 && matched === 0) return;
            if (allText.includes(form)) total += 35;
            if (fields.primary.includes(form)) total += 35;
            if (coverage === 1) total += 24;
            else total *= coverage;
            bestScore = Math.max(bestScore, total);
        });
        return bestScore;
    }

    function searchProducts(query) {
        const normalized = normalizeSearchText(query);
        if (!normalized || normalized.length < 2) return [];
        return products
            .map(item => ({ item, score: scoreProductSearch(query, item) }))
            .filter(entry => entry.score >= 18)
            .sort((left, right) => right.score - left.score || safeText(left.item.name).localeCompare(safeText(right.item.name), "ru"))
            .slice(0, 7)
            .map(entry => entry.item);
    }

    function initSearch() {
        const form = $(".site-header .search-box");
        const input = $("input[type='search']", form || document);
        if (!form || !input || form.dataset.odorisSearchReady === "true") return;
        form.dataset.odorisSearchReady = "true";
        form.classList.add("odoris-search-form");
        input.id = input.id || "odoris-global-search";
        input.setAttribute("aria-autocomplete", "list");
        input.setAttribute("aria-expanded", "false");
        input.setAttribute("aria-controls", "odoris-search-panel");
        input.setAttribute("autocomplete", "off");

        const panel = document.createElement("div");
        panel.className = "odoris-search-panel";
        panel.id = "odoris-search-panel";
        panel.hidden = true;
        panel.setAttribute("role", "listbox");
        panel.setAttribute("aria-label", "Подсказки по товарам");
        form.appendChild(panel);

        let matches = [];
        let activeIndex = -1;
        let timer = 0;

        const closePanel = () => {
            panel.hidden = true;
            input.setAttribute("aria-expanded", "false");
            input.removeAttribute("aria-activedescendant");
            activeIndex = -1;
        };

        const setActive = index => {
            const links = $$(".odoris-search-result", panel);
            if (!links.length) return;
            activeIndex = (index + links.length) % links.length;
            links.forEach((link, itemIndex) => {
                const active = itemIndex === activeIndex;
                link.classList.toggle("is-active", active);
                link.setAttribute("aria-selected", String(active));
            });
            input.setAttribute("aria-activedescendant", links[activeIndex].id);
            links[activeIndex].scrollIntoView({ block: "nearest" });
        };

        const renderPanel = query => {
            panel.replaceChildren();
            matches = searchProducts(query);
            activeIndex = -1;
            if (!query.trim()) {
                closePanel();
                return;
            }
            if (query.trim().length < 2) {
                const hint = document.createElement("p");
                hint.className = "odoris-search-message";
                hint.textContent = "Введите ещё хотя бы один символ";
                panel.appendChild(hint);
            } else if (!matches.length) {
                const empty = document.createElement("p");
                empty.className = "odoris-search-message";
                empty.textContent = "Ничего не найдено. Проверьте название или раскладку клавиатуры.";
                panel.appendChild(empty);
            } else {
                const heading = document.createElement("div");
                heading.className = "odoris-search-heading";
                heading.textContent = matches.length === 1 ? "Найденный аромат" : "Подходящие ароматы";
                panel.appendChild(heading);
                matches.forEach((item, index) => {
                    const link = document.createElement("a");
                    link.className = "odoris-search-result";
                    link.id = `odoris-search-result-${index}`;
                    link.href = `product.html?slug=${encodeURIComponent(item.slug)}`;
                    link.setAttribute("role", "option");
                    link.setAttribute("aria-selected", "false");
                    const image = document.createElement("img");
                    image.src = item.image || "assets/products/placeholder.svg";
                    image.alt = "";
                    image.loading = "lazy";
                    image.onerror = () => { image.src = "assets/products/placeholder.svg"; };
                    const copy = document.createElement("span");
                    copy.className = "odoris-search-result__copy";
                    const title = document.createElement("strong");
                    title.textContent = item.name || item.fullName || "Аромат ODORIS";
                    const detail = document.createElement("span");
                    detail.className = "odoris-search-result__detail";
                    detail.textContent = [item.brand, item.family].filter(Boolean).join(" · ");
                    const price = document.createElement("span");
                    price.className = "odoris-search-result__price";
                    price.textContent = item.price || "Цена уточняется";
                    copy.append(title, detail, price);
                    link.append(image, copy);
                    panel.appendChild(link);
                });
                const footer = document.createElement("div");
                footer.className = "odoris-search-footer";
                footer.textContent = "Поиск по названиям, брендам, нотам и описаниям";
                panel.appendChild(footer);
            }
            panel.hidden = false;
            input.setAttribute("aria-expanded", "true");
        };

        input.addEventListener("input", () => {
            window.clearTimeout(timer);
            timer = window.setTimeout(() => renderPanel(input.value), 45);
        });
        input.addEventListener("focus", () => {
            if (input.value.trim()) renderPanel(input.value);
        });
        input.addEventListener("keydown", event => {
            if (event.key === "ArrowDown" && !panel.hidden) {
                const links = $$(".odoris-search-result", panel);
                if (links.length) {
                    event.preventDefault();
                    setActive(activeIndex < 0 ? 0 : activeIndex + 1);
                }
            } else if (event.key === "ArrowUp" && !panel.hidden) {
                const links = $$(".odoris-search-result", panel);
                if (links.length) {
                    event.preventDefault();
                    setActive(activeIndex <= 0 ? links.length - 1 : activeIndex - 1);
                }
            } else if (event.key === "Escape") {
                closePanel();
            }
        });
        panel.addEventListener("pointerover", event => {
            const link = event.target.closest(".odoris-search-result");
            if (link) setActive($$(".odoris-search-result", panel).indexOf(link));
        });
        panel.addEventListener("keydown", event => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                const links = $$(".odoris-search-result", panel);
                const current = links.indexOf(event.target.closest(".odoris-search-result"));
                if (links.length) {
                    event.preventDefault();
                    const next = event.key === "ArrowDown" ? current + 1 : current - 1;
                    if (next < 0) input.focus();
                    else setActive(Math.min(links.length - 1, next));
                    if (next >= 0) links[Math.min(links.length - 1, next)].focus();
                }
            } else if (event.key === "Escape") {
                closePanel();
                input.focus();
            }
        });
        form.addEventListener("submit", event => {
            const query = input.value.trim();
            if (!query) return;
            const result = matches[activeIndex] || matches[0] || searchProducts(query)[0];
            if (result) {
                event.preventDefault();
                window.location.href = `product.html?slug=${encodeURIComponent(result.slug)}`;
            }
        });
        document.addEventListener("pointerdown", event => {
            if (!form.contains(event.target)) closePanel();
        });
    }

    function showAuthMessage(message, isError = false) {
        const node = $("#odoris-auth-message");
        if (!node) return;
        node.textContent = message;
        node.classList.toggle("is-error", Boolean(isError));
    }

    function bytesToHex(bytes) {
        return Array.from(new Uint8Array(bytes)).map(value => value.toString(16).padStart(2, "0")).join("");
    }

    async function hashPassword(password, saltHex) {
        if (!window.crypto?.subtle) throw new Error("Для регистрации откройте сайт через HTTPS или локальный сервер (localhost).");
        const salt = saltHex ? Uint8Array.from(saltHex.match(/.{1,2}/g).map(value => parseInt(value, 16))) : crypto.getRandomValues(new Uint8Array(16));
        const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
        const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" }, key, 256);
        return { salt: bytesToHex(salt), hash: bytesToHex(bits) };
    }

    function startSession(user) {
        write(STORAGE.session, { name: user.name, email: user.email, role: user.role || "user", profile: user.profile || {} });
        window.location.href = "profile.html";
    }

    function initAuth() {
        const login = $("#odoris-login-form");
        const register = $("#odoris-register-form");
        if (!login || !register) return;
        const tabs = $$('[data-auth-tab]');
        const showTab = name => {
            const registering = name === "register";
            login.hidden = registering;
            register.hidden = !registering;
            tabs.forEach(tab => {
                const active = tab.dataset.authTab === name;
                tab.classList.toggle("is-active", active);
                tab.setAttribute("aria-selected", String(active));
            });
            showAuthMessage("");
        };
        tabs.forEach(tab => tab.addEventListener("click", () => showTab(tab.dataset.authTab)));
        login.addEventListener("submit", async event => {
            event.preventDefault();
            const email = $("#login-email").value.trim().toLowerCase();
            const password = $("#login-password").value;
            if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
                startSession({ name: "Администратор", email, role: "admin" });
                return;
            }
            const users = read(STORAGE.users, []);
            const user = Array.isArray(users) ? users.find(item => item.email === email) : null;
            if (!user) {
                showAuthMessage("Аккаунт не найден. Проверьте данные или зарегистрируйтесь.", true);
                return;
            }
            try {
                const result = await hashPassword(password, user.salt);
                if (result.hash !== user.passwordHash) {
                    showAuthMessage("Неверный адрес электронной почты или пароль.", true);
                    return;
                }
                startSession(user);
            } catch (error) {
                showAuthMessage(error.message || "Не удалось выполнить вход.", true);
            }
        });
        register.addEventListener("submit", async event => {
            event.preventDefault();
            const name = $("#register-name").value.trim();
            const email = $("#register-email").value.trim().toLowerCase();
            const password = $("#register-password").value;
            const confirm = $("#register-password-confirm").value;
            if (password.length < 8) return showAuthMessage("Пароль должен содержать не менее 8 символов.", true);
            if (password !== confirm) return showAuthMessage("Пароли не совпадают.", true);
            const users = read(STORAGE.users, []);
            if (Array.isArray(users) && users.some(item => item.email === email)) return showAuthMessage("Пользователь с такой почтой уже зарегистрирован.", true);
            try {
                const result = await hashPassword(password);
                const user = { name, email, role: "user", salt: result.salt, passwordHash: result.hash, profile: {} };
                const nextUsers = Array.isArray(users) ? users : [];
                nextUsers.push(user);
                write(STORAGE.users, nextUsers);
                startSession(user);
            } catch (error) {
                showAuthMessage(error.message || "Не удалось создать аккаунт.", true);
            }
        });
        const current = session();
        if (current) {
            const note = document.createElement("p");
            note.className = "odoris-auth-signed-in";
            note.textContent = `Вы уже вошли как ${current.name || current.email}.`;
            const link = document.createElement("a");
            link.href = "profile.html";
            link.textContent = "Перейти в личный кабинет";
            note.append(" ", link);
            login.parentElement.insertBefore(note, login);
        }
    }

    function logout() {
        localStorage.removeItem(STORAGE.session);
        window.location.href = "index.html";
    }

    function handleClick(event) {
        const actionButton = event.target.closest("[data-store-action]");
        if (actionButton) {
            event.preventDefault();
            event.stopPropagation();
            const slug = actionButton.dataset.slug;
            switch (actionButton.dataset.storeAction) {
                case "favorite": {
                    toggleFavorite(slug);
                    updateFavoriteButtons();
                    break;
                }
                case "cart":
                    if (addToCart(slug)) {
                        actionButton.classList.add("is-added");
                        setActionIcon(actionButton, "check");
                        setTimeout(() => {
                            if (actionButton.isConnected) {
                                actionButton.classList.remove("is-added");
                                setActionIcon(actionButton, "cart");
                            }
                        }, 1000);
                    }
                    break;
                case "increase": updateCartQuantity(slug, 1); break;
                case "decrease": updateCartQuantity(slug, -1); break;
                case "remove": removeCartItem(slug); break;
            }
            return;
        }

        if (event.target.closest("[data-address-trigger]")) {
            openAddressDialog(getActiveAddress()?.id);
            return;
        }
        if (event.target.closest("[data-profile-address-add]")) {
            openAddressDialog("__new__");
            return;
        }
        const edit = event.target.closest("[data-profile-address-edit]");
        if (edit) {
            openAddressDialog(edit.dataset.profileAddressEdit);
            return;
        }
        const remove = event.target.closest("[data-profile-address-remove]");
        if (remove) {
            const addresses = getAddresses().filter(item => item.id !== remove.dataset.profileAddressRemove);
            if (!addresses.length) addresses.push({ id: `address-${Date.now()}`, title: "Домашний адрес", city: "Москва", street: "", extra: "", isDefault: true });
            if (!addresses.some(item => item.isDefault)) addresses[0].isDefault = true;
            if (read(STORAGE.activeAddress, null) === remove.dataset.profileAddressRemove) write(STORAGE.activeAddress, addresses[0].id);
            saveAddresses(addresses);
            return;
        }
        const makeDefault = event.target.closest("[data-profile-address-default]");
        if (makeDefault) {
            const addresses = getAddresses().map(item => ({ ...item, isDefault: item.id === makeDefault.dataset.profileAddressDefault }));
            write(STORAGE.activeAddress, makeDefault.dataset.profileAddressDefault);
            saveAddresses(addresses);
            return;
        }
        if (event.target.closest(".logout-link a")) {
            event.preventDefault();
            logout();
        }
    }

    async function init() {
        if (initialized) return;
        initialized = true;
        try {
            const response = await fetch("data/fragrances.json", { cache: "no-store" });
            if (response.ok) {
                const data = await response.json();
                products = Array.isArray(data) ? data : [];
            }
        } catch (error) {
            console.warn("ODORIS catalog unavailable:", error);
        }

        getAddresses();
        initSearch();
        updateHeader();
        decorateProductCards();
        initProfile();
        initAuth();
        initProductAdmin();
        renderCartPage();
        renderFavoritesPage();

        document.addEventListener("click", handleClick);
        document.addEventListener("click", event => {
            if (["perfume-cart-button", "perfume-buy-button"].includes(event.target?.id)) setTimeout(updateHeader, 0);
        }, true);

        const cardObserver = new MutationObserver(() => decorateProductCards());
        const grids = [$("#perfume-related-grid"), $("#catalogGrid")].filter(Boolean);
        grids.forEach(grid => cardObserver.observe(grid, { childList: true, subtree: true }));
        window.addEventListener("storage", () => {
            updateHeader();
            updateFavoriteButtons();
            renderCartPage();
            renderFavoritesPage();
            initProfile();
        });
    }

    window.OdorisStore = {
        version: "2.2.0",
        init,
        isAdmin,
        session,
        addToCart,
        toggleFavorite,
        openAddressDialog,
        refresh: updateHeader
    };
})();
