// Shared ODORIS component and storefront loader.
// Every page that includes this file automatically receives the store module.
(function () {
    "use strict";

    // Prevent the admin pencil from flashing for non-admin visitors before JS initializes.
    if (!document.querySelector("style[data-odoris-admin-guard]")) {
        const guard = document.createElement("style");
        guard.dataset.odorisAdminGuard = "true";
        guard.textContent = `
            #perfume-edit-button, .perfume-save-row { display: none !important; }
            body.odoris-is-admin #perfume-edit-button { display: grid !important; }
            body.odoris-is-admin .perfume-save-row { display: flex !important; }
        `;
        document.head.appendChild(guard);
    }

    async function loadComponent(id, file) {
        const host = document.getElementById(id);
        if (!host) return;
        try {
            const response = await fetch(file);
            if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
            host.innerHTML = await response.text();
        } catch (error) {
            console.error("ODORIS component loading failed:", error);
        }
    }

    function loadStylesheet() {
        if (document.querySelector('link[data-odoris-store-style]')) return Promise.resolve();
        return new Promise(resolve => {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = "css/odoris-store.css?v=2.2.0";
            link.dataset.odorisStoreStyle = "true";
            link.addEventListener("load", resolve, { once: true });
            link.addEventListener("error", () => {
                console.error("ODORIS styles failed to load: css/odoris-store.css?v=2.2.0");
                resolve();
            }, { once: true });
            document.head.appendChild(link);
        });
    }

    function loadStoreScript() {
        if (window.OdorisStore) {
            window.OdorisStore.init();
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            let script = document.querySelector('script[data-odoris-store-script]');
            if (!script) {
                script = document.createElement("script");
                script.src = "js/odoris-store.js?v=2.2.0";
                script.dataset.odorisStoreScript = "true";
                document.body.appendChild(script);
            }
            script.addEventListener("load", () => {
                if (!window.OdorisStore) {
                    reject(new Error("The script loaded but window.OdorisStore was not created."));
                    return;
                }
                window.OdorisStore.init();
                console.info(`ODORIS storefront JS connected (v${window.OdorisStore.version || "unknown"}).`);
                resolve();
            }, { once: true });
            script.addEventListener("error", () => reject(new Error("Не удалось загрузить js/odoris-store.js")), { once: true });
        });
    }

    async function bootstrap() {
        await Promise.all([
            loadComponent("header", "components/header.html"),
            loadComponent("footer", "components/footer.html")
        ]);
        await loadStylesheet();
        try {
            await loadStoreScript();
        } catch (error) {
            console.error("ODORIS storefront initialization failed:", error);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
    } else {
        bootstrap();
    }
})();
