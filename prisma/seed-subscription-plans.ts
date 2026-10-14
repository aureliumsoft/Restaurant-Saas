import type { PrismaClient, SubscriptionPlan } from '@prisma/client';

/** Same separator as lib/menu/bilingual-text (avoid importing app path aliases in seed). */
const SEP = '&&&&';

type CatalogSeed = {
  id: string;
  plan: SubscriptionPlan;
  name: string;
  price: number;
  priceLabel: string;
  description: string;
  features: string[];
};

function bi(en: string, es: string): string {
  return `${en} ${SEP} ${es}`;
}

/**
 * Seeds all public pricing plans (Free → Custom).
 * Names / labels / features use `&&&&` for English + Spanish.
 * Upserts on `plan` so `prisma db seed` / reset refreshes copy.
 */
export async function seedSubscriptionPlans(prisma: PrismaClient) {
  const plans: CatalogSeed[] = [
    {
      id: 'subcat_free',
      plan: 'FREE',
      name: bi('Free', 'Gratis'),
      price: 0,
      priceLabel: bi('€0/mo', '0 €/mes'),
      description: bi(
        'Trial / starter restaurant — core catalog and POS with tight limits.',
        'Prueba / inicio — catálogo básico y TPV con límites estrictos.'
      ),
      features: [
        bi('Dashboard (7 days only)', 'Panel (solo 7 días)'),
        bi('POS with limited fulfillment', 'TPV con cumplimiento limitado'),
        bi('Up to 5 categories / 3 variations / 15 products', 'Hasta 5 categorías / 3 variaciones / 15 productos'),
        bi('1 branch maximum', 'Máximo 1 sucursal'),
        bi('Order transactions only', 'Solo transacciones de pedidos'),
        bi('Reports: week & month presets', 'Informes: presets semana y mes'),
        bi('KDS, inventory, website & kiosk require upgrade', 'KDS, inventario, web y kiosco requieren mejora'),
      ],
    },
    {
      id: 'subcat_basic',
      plan: 'BASIC',
      name: bi('Basic', 'Básico'),
      price: 29,
      priceLabel: bi('€29/mo', '29 €/mes'),
      description: bi(
        'Small venue — adds KDS and slightly higher catalog limits.',
        'Local pequeño — añade KDS y límites de catálogo algo mayores.'
      ),
      features: [
        bi('Everything useful in Free, plus KDS', 'Lo útil de Gratis, más KDS'),
        bi('Dashboard 7D / 14D / 30D', 'Panel 7D / 14D / 30D'),
        bi('Up to 15 categories / 5 variations / 35 products', 'Hasta 15 categorías / 5 variaciones / 35 productos'),
        bi('Manual expenses', 'Gastos manuales'),
        bi('2 users & 2 roles', '2 usuarios y 2 roles'),
        bi('1 branch maximum', 'Máximo 1 sucursal'),
        bi('Website, kiosk & inventory still upgrade', 'Web, kiosco e inventario siguen siendo mejora'),
      ],
    },
    {
      id: 'subcat_growth',
      plan: 'GROWTH',
      name: bi('Growth', 'Crecimiento'),
      price: 79,
      priceLabel: bi('€79/mo', '79 €/mes'),
      description: bi(
        'Growing venue — website, configuration, and more catalog capacity.',
        'Negocio en crecimiento — web, configuración y más capacidad de catálogo.'
      ),
      features: [
        bi('Website included & accessible', 'Sitio web incluido y accesible'),
        bi('Full configuration module', 'Módulo de configuración completo'),
        bi('Up to 30 categories / 7 variations / 100 products', 'Hasta 30 categorías / 7 variaciones / 100 productos'),
        bi('2 branches', '2 sucursales'),
        bi('5 users & 5 roles', '5 usuarios y 5 roles'),
        bi('1 online payment method', '1 método de pago online'),
        bi('Delivery on POS; KDS included', 'Delivery en TPV; KDS incluido'),
      ],
    },
    {
      id: 'subcat_scale',
      plan: 'SCALE',
      name: bi('Scale', 'Escala'),
      price: 149,
      priceLabel: bi('€149/mo', '149 €/mes'),
      description: bi(
        'Multi-branch ops — inventory, layout, kiosk, and order display unlocked.',
        'Operación multi-sucursal — inventario, diseño, kiosco y pantalla de pedidos.'
      ),
      features: [
        bi('Full dashboard analytics', 'Analítica completa del panel'),
        bi('Inventory, menu layout & order display', 'Inventario, diseño de menú y pantalla de pedidos'),
        bi('Website & kiosk platforms', 'Plataformas web y kiosco'),
        bi('Unlimited products; 60 categories / 10 variations', 'Productos ilimitados; 60 categorías / 10 variaciones'),
        bi('5 branches', '5 sucursales'),
        bi('15 users & 15 roles', '15 usuarios y 15 roles'),
        bi('1 online payment method; terminal still upgrade', '1 pago online; terminal sigue siendo mejora'),
      ],
    },
    {
      id: 'subcat_pro',
      plan: 'PRO',
      name: bi('Pro', 'Pro'),
      price: 249,
      priceLabel: bi('€249/mo', '249 €/mes'),
      description: bi(
        'Full product access with soft caps on branches and team size.',
        'Acceso completo al producto con límites suaves de sucursales y equipo.'
      ),
      features: [
        bi('All modules unlocked', 'Todos los módulos desbloqueados'),
        bi('Unlimited catalog (categories, variations, products)', 'Catálogo ilimitado (categorías, variaciones, productos)'),
        bi('Online payments & terminal payments', 'Pagos online y terminal'),
        bi('Mobile app included', 'App móvil incluida'),
        bi('Up to 10 branches', 'Hasta 10 sucursales'),
        bi('Up to 30 users & 30 roles', 'Hasta 30 usuarios y 30 roles'),
        bi('Priority-ready operations stack', 'Stack operativo listo para prioridad'),
      ],
    },
    {
      id: 'subcat_custom',
      plan: 'CUSTOM',
      name: bi('Custom', 'Personalizado'),
      price: 0,
      priceLabel: bi('Request quote', 'Solicitar presupuesto'),
      description: bi(
        'Pick modules with checkboxes; request to buy — we email the admin like a demo request.',
        'Elige módulos con casillas; solicita compra — enviamos email al admin como una demo.'
      ),
      features: [
        bi('Checkbox module selection', 'Selección de módulos con casillas'),
        bi('Unchecked limited modules use Basic limits', 'Módulos limitados sin marcar usan límites Básico'),
        bi('Checked selection modules get full access', 'Módulos de selección marcados tienen acceso total'),
        bi('Request to buy (not instant checkout)', 'Solicitar compra (no pago instantáneo)'),
        bi('Sales-assisted onboarding', 'Alta asistida por ventas'),
        bi('Tailored to your restaurant', 'Adaptado a tu restaurante'),
      ],
    },
  ];

  for (const p of plans) {
    await prisma.$executeRaw`
      INSERT INTO "SubscriptionCatalog" (
        "id", "plan", "name", "price", "priceLabel", "description", "features", "createdAt", "updatedAt"
      )
      VALUES (
        ${p.id},
        ${p.plan}::"SubscriptionPlan",
        ${p.name},
        ${p.price},
        ${p.priceLabel},
        ${p.description},
        ${p.features}::text[],
        now(),
        now()
      )
      ON CONFLICT ("plan") DO UPDATE SET
        "id" = EXCLUDED."id",
        "name" = EXCLUDED."name",
        "price" = EXCLUDED."price",
        "priceLabel" = EXCLUDED."priceLabel",
        "description" = EXCLUDED."description",
        "features" = EXCLUDED."features",
        "updatedAt" = now()
    `;
  }

  // Remove legacy STARTER catalog row if somehow still present as orphan text (post-migration should be gone).
  console.log(`[seed] Upserted ${plans.length} subscription plans (FREE…CUSTOM, EN&&&&ES)`);
}
