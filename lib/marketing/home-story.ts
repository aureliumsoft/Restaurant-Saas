export type StoryLang = 'en' | 'es';

export const HOME_STORY = {
  en: {
    sell: {
      eyebrow: 'How it sells',
      title: 'More tickets.',
      titleAccent: 'Same kitchen.',
      items: [
        { n: '01', title: 'Own the guest', line: 'Your web and app. No aggregator cut.' },
        { n: '02', title: 'Catch walk-ins', line: 'QR, kiosk, and POS on one menu.' },
        { n: '03', title: 'Bigger tickets', line: 'Sizes, extras, and offers at tap.' },
        { n: '04', title: 'Faster service', line: 'Kitchen screen and ready board.' },
        { n: '05', title: 'They come back', line: 'Accounts, history, and hours.' },
        { n: '06', title: 'Stay open', line: 'Orders still take if Wi‑Fi drops.' },
      ],
    },
    stations: {
      eyebrow: 'The floor',
      title: 'One menu.',
      titleAccent: 'Six screens.',
      hint: 'Guests order. Staff run service. Same catalog on every screen.',
      guest: 'Guest',
      staff: 'Staff',
      live: 'Live',
      items: [
        {
          code: 'WEB',
          name: 'Website',
          line: 'Order on your brand.',
          body: 'Guests browse, customize, and pay on your domain. No marketplace cut, and the ticket lands in the same kitchen as walk-ins.',
        },
        {
          code: 'APP',
          name: 'Mobile app',
          line: 'Repeat from the phone.',
          body: 'Saved accounts and past orders make the next visit one tap. Same menu, same prices, same kitchen ticket.',
        },
        {
          code: 'KSK',
          name: 'Kiosk',
          line: 'The queue orders itself.',
          body: 'Walk-ins build their own order at the stand. Staff stay on the floor while the queue keeps moving.',
        },
        {
          code: 'POS',
          name: 'POS',
          line: 'Counter, tables, cash.',
          body: 'Take the order at the counter or table — cash, card, or already paid online. One catalog with the rest of the floor.',
        },
        {
          code: 'KDS',
          name: 'Kitchen',
          line: 'Tickets bump live.',
          body: 'Every channel prints as a live ticket. Cooks bump items as they go; nothing is retyped from a receipt.',
        },
        {
          code: 'DSP',
          name: 'Ready board',
          line: 'Pickup without crowding.',
          body: 'Order numbers light up when the bag is ready. Guests wait off the pass instead of stacking at the counter.',
        },
      ],
    },
    path: {
      eyebrow: 'Guest path',
      title: 'What they tap.',
      titleAccent: 'That’s it.',
    },
    floor: {
      eyebrow: 'Day two',
      title: 'The floor',
      titleAccent: 'stays in control.',
      items: [
        { name: 'Offline', line: 'Keep taking orders' },
        { name: 'Receipts', line: 'Print from the browser' },
        { name: 'Cash shift', line: 'Count the locker' },
        { name: 'Table QR', line: 'Dine-in without a waiter' },
        { name: 'Live kitchen', line: 'Tickets as they land' },
        { name: 'Staff roles', line: 'Cashiers stay in POS' },
      ],
    },
  },
  es: {
    sell: {
      eyebrow: 'Cómo vende',
      title: 'Más tickets.',
      titleAccent: 'Misma cocina.',
      items: [
        { n: '01', title: 'Tu cliente', line: 'Tu web y app. Sin comisión.' },
        { n: '02', title: 'Cada visita', line: 'QR, kiosco y TPV. Un menú.' },
        { n: '03', title: 'Ticket mayor', line: 'Tamaños, extras y ofertas.' },
        { n: '04', title: 'Más rápido', line: 'Cocina y panel de listo.' },
        { n: '05', title: 'Vuelven', line: 'Cuenta, historial y horario.' },
        { n: '06', title: 'Siempre abierto', line: 'Pedidos aunque caiga el Wi‑Fi.' },
      ],
    },
    stations: {
      eyebrow: 'La sala',
      title: 'Un menú.',
      titleAccent: 'Seis pantallas.',
      hint: 'El cliente pide. El local sirve. El mismo menú en cada pantalla.',
      guest: 'Cliente',
      staff: 'Equipo',
      live: 'En vivo',
      items: [
        {
          code: 'WEB',
          name: 'Web',
          line: 'Piden en tu marca.',
          body: 'El cliente ve el menú, añade extras y paga en tu dominio. Sin comisión, y el ticket llega a la misma cocina.',
        },
        {
          code: 'APP',
          name: 'App',
          line: 'Repiten desde el móvil.',
          body: 'Cuenta guardada y pedidos anteriores: el siguiente tap es más corto. Mismo menú, mismo precio, mismo ticket.',
        },
        {
          code: 'KSK',
          name: 'Kiosco',
          line: 'La cola se pide sola.',
          body: 'Quien entra arma su pedido en el kiosco. El equipo sigue en sala mientras la cola avanza sola.',
        },
        {
          code: 'POS',
          name: 'TPV',
          line: 'Mostrador, mesas, caja.',
          body: 'Toma el pedido en mostrador o mesa — efectivo, tarjeta o ya pagado online. Un solo catálogo con el resto de la sala.',
        },
        {
          code: 'KDS',
          name: 'Cocina',
          line: 'Tickets en vivo.',
          body: 'Cada canal llega como ticket en vivo. Cocina marca al terminar; nadie reescribe un ticket de papel.',
        },
        {
          code: 'DSP',
          name: 'Listo',
          line: 'Recogida sin aglomerar.',
          body: 'El número se ilumina cuando la bolsa está lista. Esperan lejos del pase, no apilados en el mostrador.',
        },
      ],
    },
    path: {
      eyebrow: 'El cliente',
      title: 'Lo que toca.',
      titleAccent: 'Nada más.',
    },
    floor: {
      eyebrow: 'El segundo día',
      title: 'La sala',
      titleAccent: 'sigue en control.',
      items: [
        { name: 'Offline', line: 'Seguir tomando pedidos' },
        { name: 'Recibos', line: 'Imprimir del navegador' },
        { name: 'Turno', line: 'Contar la caja' },
        { name: 'QR de mesa', line: 'Pedir sin camarero' },
        { name: 'Cocina en vivo', line: 'El ticket llega solo' },
        { name: 'Roles', line: 'El cajero se queda en TPV' },
      ],
    },
  },
} as const;

export type HomeStoryCopy = (typeof HOME_STORY)[StoryLang];

export function storyLangFromI18n(language: string | undefined): StoryLang {
  return language?.toLowerCase().startsWith('es') ? 'es' : 'en';
}
