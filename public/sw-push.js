// Service worker só para Web Push — não faz cache nem funciona offline.
//
// Fica em /public porque precisa ser servido na raiz do site: o alcance de
// um service worker é a pasta onde ele está e tudo abaixo dela.

self.addEventListener("push", (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = {};
  }
  const titulo = dados.title || "Aurora Studio";
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: dados.body || "",
      icon: "/icon.svg",
      tag: dados.tag,
      data: { href: dados.href || "/admin" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || "/admin";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
      for (const cliente of lista) {
        if (cliente.url.includes(href) && "focus" in cliente) return cliente.focus();
      }
      if (lista.length > 0 && "focus" in lista[0]) {
        lista[0].navigate(href);
        return lista[0].focus();
      }
      return self.clients.openWindow(href);
    })
  );
});
