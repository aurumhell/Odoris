
async function loadComponent(id, file) {
    try {
        const response = await fetch(file);

        if (!response.ok) {
            throw new Error(`Ошибка загрузки: ${file}`);
        }

        const html = await response.text();
        document.getElementById(id).innerHTML = html;

    } catch (error) {
        console.error(error);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await Promise.all([
        loadComponent("header", "components/header.html"),
        loadComponent("footer", "components/footer.html")
    ]);
});
