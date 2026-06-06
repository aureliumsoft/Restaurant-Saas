import { AttributeSelectionType, RecommendationSourceType, RecommendationMultipleMode, SubscriptionPlan, SubscriptionStatus, EmployeeInviteStatus, CatProduct, OrderSourceType } from '@prisma/client';
import { faker } from '@faker-js/faker';
import Decimal from 'decimal.js';



export function fakeUser() {
  return {
    name: faker.person.fullName(),
    username: faker.internet.userName(),
    email: undefined,
    emailVerified: undefined,
    image: undefined,
    password: undefined,
    updatedAt: faker.date.anytime(),
  };
}
export function fakeUserComplete() {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    username: faker.internet.userName(),
    email: undefined,
    emailVerified: undefined,
    image: undefined,
    password: undefined,
    roleId: undefined,
    createdAt: new Date(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeRole() {
  return {
    name: faker.person.fullName(),
    slug: undefined,
    updatedAt: faker.date.anytime(),
  };
}
export function fakeRoleComplete() {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    slug: undefined,
    restaurantId: undefined,
    createdAt: new Date(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakePermission() {
  return {
    name: faker.person.fullName(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakePermissionComplete() {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    roleId: undefined,
    createdAt: new Date(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeRestaurant() {
  return {
    name: faker.person.fullName(),
    slug: faker.lorem.words(5),
    subdomain: faker.lorem.words(5),
    logoUrl: undefined,
    logoKey: undefined,
    mainBannerUrl: undefined,
    themePrimaryColor: undefined,
    updatedAt: faker.date.anytime(),
  };
}
export function fakeRestaurantComplete() {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    slug: faker.lorem.words(5),
    subdomain: faker.lorem.words(5),
    logoUrl: undefined,
    logoKey: undefined,
    mainBannerUrl: undefined,
    themePrimaryColor: undefined,
    menuBannerUrls: [],
    ownerId: faker.string.uuid(),
    createdAt: new Date(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeDiningTable() {
  return {
    name: faker.person.fullName(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeDiningTableComplete() {
  return {
    id: faker.string.uuid(),
    restaurantId: faker.string.uuid(),
    branchId: undefined,
    name: faker.person.fullName(),
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeBranch() {
  return {
    name: faker.person.fullName(),
    address: undefined,
    phone: undefined,
    updatedAt: faker.date.anytime(),
  };
}
export function fakeBranchComplete() {
  return {
    id: faker.string.uuid(),
    restaurantId: faker.string.uuid(),
    name: faker.person.fullName(),
    address: undefined,
    phone: undefined,
    createdAt: new Date(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeRestaurantSubscription() {
  return {
    trialEndsAt: undefined,
    currentPeriodEnd: undefined,
    notes: undefined,
    updatedAt: faker.date.anytime(),
  };
}
export function fakeRestaurantSubscriptionComplete() {
  return {
    id: faker.string.uuid(),
    restaurantId: faker.string.uuid(),
    plan: SubscriptionPlan.STARTER,
    status: SubscriptionStatus.TRIAL,
    trialEndsAt: undefined,
    currentPeriodEnd: undefined,
    notes: undefined,
    createdAt: new Date(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeSubscriptionCatalog() {
  return {
    plan: faker.helpers.arrayElement([SubscriptionPlan.STARTER, SubscriptionPlan.GROWTH, SubscriptionPlan.SCALE] as const),
    name: faker.person.fullName(),
    price: faker.number.int(),
    priceLabel: faker.lorem.words(5),
    description: faker.lorem.words(5),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeSubscriptionCatalogComplete() {
  return {
    id: faker.string.uuid(),
    plan: faker.helpers.arrayElement([SubscriptionPlan.STARTER, SubscriptionPlan.GROWTH, SubscriptionPlan.SCALE] as const),
    name: faker.person.fullName(),
    price: faker.number.int(),
    priceLabel: faker.lorem.words(5),
    description: faker.lorem.words(5),
    features: [],
    createdAt: new Date(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeSubscriptionPayment() {
  return {
    amount: faker.number.float(),
    periodStart: undefined,
    periodEnd: undefined,
    notes: undefined,
    updatedAt: faker.date.anytime(),
  };
}
export function fakeSubscriptionPaymentComplete() {
  return {
    id: faker.string.uuid(),
    restaurantId: faker.string.uuid(),
    restaurantSubscriptionId: undefined,
    amount: faker.number.float(),
    currency: 'EUR',
    paidAt: new Date(),
    periodStart: undefined,
    periodEnd: undefined,
    notes: undefined,
    recordedByUserId: undefined,
    createdAt: new Date(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakePlatformSetting() {
  return {
    key: faker.lorem.words(5),
    value: faker.lorem.words(5),
    updatedAt: faker.date.anytime(),
  };
}
export function fakePlatformSettingComplete() {
  return {
    id: faker.string.uuid(),
    key: faker.lorem.words(5),
    value: faker.lorem.words(5),
    createdAt: new Date(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeDemoRequest() {
  return {
    name: faker.person.fullName(),
    email: faker.internet.email(),
    restaurantName: faker.lorem.words(5),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeDemoRequestComplete() {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    email: faker.internet.email(),
    restaurantName: faker.lorem.words(5),
    createdAt: new Date(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeEmployee() {
  return {
    updatedAt: faker.date.anytime(),
  };
}
export function fakeEmployeeComplete() {
  return {
    id: faker.string.uuid(),
    restaurantId: faker.string.uuid(),
    userId: faker.string.uuid(),
    roleId: faker.string.uuid(),
    createdAt: new Date(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeEmployeeBranchComplete() {
  return {
    employeeId: faker.string.uuid(),
    branchId: faker.string.uuid(),
  };
}
export function fakeEmployeeInvite() {
  return {
    email: faker.internet.email(),
    token: faker.lorem.words(5),
    expiresAt: faker.date.anytime(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeEmployeeInviteComplete() {
  return {
    id: faker.string.uuid(),
    restaurantId: faker.string.uuid(),
    email: faker.internet.email(),
    roleId: faker.string.uuid(),
    branchIds: [],
    token: faker.lorem.words(5),
    status: EmployeeInviteStatus.PENDING,
    invitedById: faker.string.uuid(),
    expiresAt: faker.date.anytime(),
    createdAt: new Date(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeMenuCategory() {
  return {
    name: faker.person.fullName(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeMenuCategoryComplete() {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    restaurantId: faker.string.uuid(),
    showInFront: true,
    createdAt: new Date(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeMenuItem() {
  return {
    name: faker.person.fullName(),
    description: undefined,
    imageUrl: undefined,
    imageKey: undefined,
    price: faker.number.float(),
    salePrice: undefined,
    updatedAt: faker.date.anytime(),
  };
}
export function fakeMenuItemComplete() {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    description: undefined,
    imageUrl: undefined,
    imageKey: undefined,
    price: faker.number.float(),
    salePrice: undefined,
    categoryId: faker.string.uuid(),
    restaurantId: faker.string.uuid(),
    createdAt: new Date(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeRestaurantVariation() {
  return {
    name: faker.person.fullName(),
    shortLabel: undefined,
    updatedAt: faker.date.anytime(),
  };
}
export function fakeRestaurantVariationComplete() {
  return {
    id: faker.string.uuid(),
    restaurantId: faker.string.uuid(),
    name: faker.person.fullName(),
    shortLabel: undefined,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeMenuItemVariation() {
  return {
    name: faker.person.fullName(),
    title: faker.lorem.words(5),
    imageUrl: undefined,
    imageKey: undefined,
    swatchHex: undefined,
    updatedAt: faker.date.anytime(),
  };
}
export function fakeMenuItemVariationComplete() {
  return {
    id: faker.string.uuid(),
    menuItemId: faker.string.uuid(),
    name: faker.person.fullName(),
    title: faker.lorem.words(5),
    imageUrl: undefined,
    imageKey: undefined,
    swatchHex: undefined,
    sortOrder: 0,
    priceDelta: 0,
    restaurantVariationId: undefined,
    createdAt: new Date(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeMenuItemOffer() {
  return {
    updatedAt: faker.date.anytime(),
  };
}
export function fakeMenuItemOfferComplete() {
  return {
    id: faker.string.uuid(),
    baseItemId: faker.string.uuid(),
    offeredItemId: faker.string.uuid(),
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeMenuItemAttributeGroup() {
  return {
    name: faker.person.fullName(),
    multipleMode: undefined,
    freeQuantity: undefined,
    minItems: undefined,
    maxItems: undefined,
    updatedAt: faker.date.anytime(),
  };
}
export function fakeMenuItemAttributeGroupComplete() {
  return {
    id: faker.string.uuid(),
    menuItemId: faker.string.uuid(),
    name: faker.person.fullName(),
    sortOrder: 0,
    selectionType: AttributeSelectionType.SINGLE,
    required: false,
    sourceType: RecommendationSourceType.CATEGORY,
    multipleMode: undefined,
    freeQuantity: undefined,
    minItems: undefined,
    maxItems: undefined,
    linkedCategoryId: undefined,
    linkedProductId: undefined,
    defaultLinkedMenuItemId: undefined,
    productCategoryIds: [],
    useVariationPricing: false,
    createdAt: new Date(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeMenuItemAttributeGroupVariationLimit() {
  return {
    minItems: faker.number.int(),
    maxItems: faker.number.int(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeMenuItemAttributeGroupVariationLimitComplete() {
  return {
    id: faker.string.uuid(),
    groupId: faker.string.uuid(),
    variationId: faker.string.uuid(),
    minItems: faker.number.int(),
    maxItems: faker.number.int(),
    createdAt: new Date(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeCustomer() {
  return {
    name: faker.person.fullName(),
    email: undefined,
    phone: faker.lorem.words(5),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeCustomerComplete() {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    email: undefined,
    phone: faker.lorem.words(5),
    restaurantId: faker.string.uuid(),
    createdAt: new Date(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeOrder() {
  return {
    idempotencyKey: undefined,
    ticketNumber: undefined,
    ticketDate: undefined,
    status: faker.lorem.words(5),
    total: faker.number.float(),
    address: undefined,
    tableLabel: undefined,
    updatedAt: faker.date.anytime(),
  };
}
export function fakeOrderComplete() {
  return {
    id: faker.string.uuid(),
    shortOrderId: '[object Object]',
    idempotencyKey: undefined,
    restaurantId: faker.string.uuid(),
    branchId: undefined,
    customerId: undefined,
    ticketNumber: undefined,
    ticketDate: undefined,
    status: faker.lorem.words(5),
    total: faker.number.float(),
    sourceType: OrderSourceType.OTHER,
    address: undefined,
    taxAmount: 0,
    discountAmount: 0,
    diningTableId: undefined,
    tableLabel: undefined,
    createdAt: new Date(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeOrderItem() {
  return {
    quantity: faker.number.int(),
    price: faker.number.float(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeOrderItemComplete() {
  return {
    id: faker.string.uuid(),
    orderId: faker.string.uuid(),
    menuItemId: faker.string.uuid(),
    quantity: faker.number.int(),
    price: faker.number.float(),
    createdAt: new Date(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeOrderItemModifier() {
  return {
    name: faker.person.fullName(),
    unitPrice: faker.number.float(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeOrderItemModifierComplete() {
  return {
    id: faker.string.uuid(),
    orderItemId: faker.string.uuid(),
    menuItemId: faker.string.uuid(),
    name: faker.person.fullName(),
    unitPrice: faker.number.float(),
    quantity: 1,
    createdAt: new Date(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakePayment() {
  return {
    amount: faker.number.float(),
    status: faker.lorem.words(5),
    method: faker.lorem.words(5),
    updatedAt: faker.date.anytime(),
  };
}
export function fakePaymentComplete() {
  return {
    id: faker.string.uuid(),
    orderId: faker.string.uuid(),
    amount: faker.number.float(),
    status: faker.lorem.words(5),
    method: faker.lorem.words(5),
    createdAt: new Date(),
    updatedAt: faker.date.anytime(),
    restaurantId: undefined,
  };
}
export function fakeProductStock() {
  return {
    name: faker.person.fullName(),
    imageProduct: undefined,
    price: faker.number.float(),
    stock: faker.number.float(),
    cat: faker.helpers.arrayElement([CatProduct.ELECTRO, CatProduct.DRINK, CatProduct.FOOD, CatProduct.FASHION] as const),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeProductStockComplete() {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    imageProduct: undefined,
    price: faker.number.float(),
    stock: faker.number.float(),
    cat: faker.helpers.arrayElement([CatProduct.ELECTRO, CatProduct.DRINK, CatProduct.FOOD, CatProduct.FASHION] as const),
    createdAt: new Date(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeProduct() {
  return {
    sellprice: faker.number.float(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeProductComplete() {
  return {
    id: faker.string.uuid(),
    productId: faker.string.uuid(),
    sellprice: faker.number.float(),
    createdAt: new Date(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeOnSaleProduct() {
  return {
    quantity: faker.number.int(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeOnSaleProductComplete() {
  return {
    id: faker.string.uuid(),
    productId: faker.string.uuid(),
    quantity: faker.number.int(),
    saledate: new Date(),
    transactionId: faker.string.uuid(),
    createdAt: new Date(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeTransaction() {
  return {
    totalAmount: undefined,
    updatedAt: faker.date.anytime(),
  };
}
export function fakeTransactionComplete() {
  return {
    id: faker.string.uuid(),
    restaurantId: undefined,
    sourceType: OrderSourceType.WALK_IN,
    totalAmount: undefined,
    createdAt: new Date(),
    updatedAt: faker.date.anytime(),
    isComplete: false,
  };
}
export function fakeShopData() {
  return {
    tax: undefined,
    name: undefined,
    updatedAt: faker.date.anytime(),
  };
}
export function fakeShopDataComplete() {
  return {
    id: faker.string.uuid(),
    tax: undefined,
    name: undefined,
    createdAt: new Date(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeKitchenTicket() {
  return {
    selectedMinutes: faker.number.int(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeKitchenTicketComplete() {
  return {
    id: faker.string.uuid(),
    restaurantId: faker.string.uuid(),
    orderId: faker.string.uuid(),
    status: 'making',
    selectedMinutes: faker.number.int(),
    startedAt: new Date(),
    createdAt: new Date(),
    updatedAt: faker.date.anytime(),
  };
}
export function fakeKitchenTicketItem() {
  return {
    productName: faker.lorem.words(5),
    quantity: faker.number.int(),
  };
}
export function fakeKitchenTicketItemComplete() {
  return {
    id: faker.string.uuid(),
    kitchenTicketId: faker.string.uuid(),
    productName: faker.lorem.words(5),
    quantity: faker.number.int(),
  };
}
